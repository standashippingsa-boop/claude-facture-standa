import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { generateBonRemise } from "@/lib/bonremise";
import type { ClientTarifInfo } from "@/lib/db";
import type { Pkg } from "@/lib/types";

type RouteContext = { params: Promise<{ kind: string; id: string }> };
type Staff = { role: string; pickup_ville_id: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const INVOICE_BUCKET = "invoices";
const BON_BUCKET = "bons-remise";

function tokenOf(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function storedPath(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  // Compatibilité transitoire avec les anciennes lignes qui avaient une URL
  // publique. Les nouvelles lignes conservent uniquement le chemin privé.
  const fromUrl = raw.includes("/invoices/") ? raw.split("/invoices/").pop() ?? "" : raw;
  try {
    const path = decodeURIComponent(fromUrl).replace(/^\/+/, "");
    // Les factures sont stockées à la racine du bucket, tandis que les Bons
    // de remise sont archivés sous `bons/`. Accepter uniquement ces deux
    // formes sûres évite de refuser les vrais PDF tout en excluant `..` et
    // tout chemin arbitraire.
    return /^(?:bons\/)?[A-Za-z0-9._-]+\.pdf$/i.test(path) ? path : "";
  } catch { return ""; }
}

async function agentCanReadInvoice(db: any, staff: Staff, customerCode: string) {
  if (!staff.pickup_ville_id) return false;
  const { data } = await db.from("clients").select("ville_id")
    .eq("customer_code", customerCode).maybeSingle();
  return data?.ville_id === staff.pickup_ville_id;
}

async function agentCanReadBon(db: any, staff: Staff, bon: { id: string; destination: string | null }) {
  if (!staff.pickup_ville_id) return false;
  const zone = await db.from("villes").select("name").eq("id", staff.pickup_ville_id).maybeSingle();
  const zoneName = String(zone.data?.name ?? "").trim().toLocaleLowerCase();
  if (!zoneName) return false;
  // Un Bon n'est accessible à un agent que s'il porte explicitement le nom
  // de sa zone. Une Conduce peut contenir plusieurs villes : l'utiliser comme
  // raccourci exposerait, par exemple, un Bon Port-de-Paix à Gonaïves.
  return String(bon.destination ?? "").trim().toLocaleLowerCase() === zoneName;
}

/**
 * Relais PDF privé. Les URLs Supabase ne sortent jamais de cette route:
 * le fichier est transmis au navigateur seulement après contrôle de session,
 * de rôle et, pour les clients/agents, de propriété de la zone.
 */
export async function GET(req: Request, context: RouteContext) {
  const rl = rateLimit(`secure-document:${clientIp(req)}`, 80, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const { kind, id } = await context.params;
  if ((kind !== "invoice" && kind !== "bon-remise") || !UUID.test(id)) {
    return NextResponse.json({ ok: false, reason: "Document introuvable." }, { status: 404 });
  }

  const config = getSupabaseAdminConfig();
  const token = tokenOf(req);
  if (!config || !token) return NextResponse.json({ ok: false, reason: "Session requise." }, { status: 401 });

  try {
    const db: any = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth } = await db.auth.getUser(token);
    if (!auth.user) return NextResponse.json({ ok: false, reason: "Session invalide." }, { status: 401 });

    const { data: staffRow } = await db.from("staff").select("role, pickup_ville_id")
      .eq("auth_user_id", auth.user.id).maybeSingle();
    const staff = staffRow as Staff | null;

    if (kind === "invoice") {
      const { data: invoice } = await db.from("invoices")
        .select("id, invoice_number, customer_code, pdf_path, pdf_url, has_pdf").eq("id", id).maybeSingle();
      if (!invoice || !invoice.has_pdf) return NextResponse.json({ ok: false, reason: "PDF indisponible." }, { status: 404 });

      let allowed = staff?.role === "admin" || staff?.role === "employe";
      if (staff?.role === "agent_retrait") allowed = await agentCanReadInvoice(db, staff, String(invoice.customer_code ?? ""));
      if (!staff) {
        const { data: client } = await db.from("clients").select("customer_code")
          .eq("auth_user_id", auth.user.id).maybeSingle();
        allowed = client?.customer_code === invoice.customer_code;
      }
      if (!allowed) return NextResponse.json({ ok: false, reason: "Accès refusé." }, { status: 403 });

      const path = storedPath(invoice.pdf_path || invoice.pdf_url);
      if (!path) return NextResponse.json({ ok: false, reason: "PDF indisponible." }, { status: 404 });
      const { data, error } = await db.storage.from(INVOICE_BUCKET).download(path);
      if (error || !data) return NextResponse.json({ ok: false, reason: "PDF indisponible." }, { status: 404 });
      return pdfResponse(data, `Facture-${invoice.invoice_number || id}.pdf`);
    }

    if (!staff) return NextResponse.json({ ok: false, reason: "Accès refusé." }, { status: 403 });
    const { data: bon } = await db.from("bons_remise")
      .select("id, bon_number, destination, pdf_path, created_at").eq("id", id).maybeSingle();
    if (!bon) return NextResponse.json({ ok: false, reason: "Bon de remise introuvable." }, { status: 404 });
    const allowed = staff.role === "admin" || staff.role === "employe"
      || (staff.role === "agent_retrait" && await agentCanReadBon(db, staff, bon));
    if (!allowed) return NextResponse.json({ ok: false, reason: "Accès refusé." }, { status: 403 });

    // PDF archivé : on le renvoie tel quel.
    const archived = storedPath(bon.pdf_path);
    if (archived) {
      const { data } = await db.storage.from(BON_BUCKET).download(archived);
      if (data) return pdfResponse(data, `Bon-remise-${bon.bon_number || id}.pdf`);
    }

    // Anciens Bons (créés avant l'archivage) ou fichier perdu : le PDF est
    // reconstruit à partir des colis rattachés au Bon, avec la date du Bon.
    const rebuilt = await rebuildBonPdf(db, bon, req);
    if (!rebuilt) return NextResponse.json({ ok: false, reason: "Ce Bon ne contient plus aucun colis : PDF indisponible." }, { status: 404 });
    return pdfResponse(new Blob([rebuilt], { type: "application/pdf" }), `Bon-remise-${bon.bon_number || id}.pdf`);
  } catch (error) {
    console.error("[secure-document]", error);
    return NextResponse.json({ ok: false, reason: "Document indisponible." }, { status: 500 });
  }
}

async function rebuildBonPdf(
  db: any,
  bon: { id: string; bon_number: string | null; destination: string | null; created_at: string | null },
  req: Request
): Promise<ArrayBuffer | null> {
  const { data: rows } = await db.from("packages")
    .select("id, tracking_number, tracking_manual, customer_code, customer_name, weight, conduce_id")
    .eq("bon_remise_id", bon.id).order("tracking_number", { ascending: true });
  const pkgs = (rows ?? []) as Array<{ id: string; tracking_number: string; tracking_manual: string | null; customer_code: string; customer_name: string | null; weight: number | null; conduce_id: string | null }>;
  if (!pkgs.length) return null;

  const conduceIds = Array.from(new Set(pkgs.map((p) => p.conduce_id).filter(Boolean))) as string[];
  const codes = Array.from(new Set(pkgs.map((p) => String(p.customer_code ?? "").trim()).filter(Boolean)));
  const [conducesRes, clientsRes, centralRes] = await Promise.all([
    conduceIds.length ? db.from("conduces").select("id, conduce_number").in("id", conduceIds) : { data: [] },
    codes.length ? db.from("clients").select("customer_code, ville:villes(name)").in("customer_code", codes) : { data: [] },
    db.from("app_settings").select("value").eq("key", "central_account_code").maybeSingle()
  ]);
  const conduceNumber = new Map<string, string>(((conducesRes.data ?? []) as Array<{ id: string; conduce_number: string }>).map((c) => [c.id, c.conduce_number]));
  const conduceOf: Record<string, string> = {};
  for (const p of pkgs) if (p.conduce_id && conduceNumber.get(p.conduce_id)) conduceOf[p.id] = conduceNumber.get(p.conduce_id)!;

  const villeByCode = new Map<string, string>();
  for (const c of (clientsRes.data ?? []) as Array<{ customer_code: string; ville: { name?: string } | { name?: string }[] | null }>) {
    const ville = Array.isArray(c.ville) ? c.ville[0] : c.ville;
    if (ville?.name) villeByCode.set(c.customer_code, ville.name);
  }
  // Même forme que le tarifMap du navigateur : le PDF n'utilise que ville.name.
  const tarifMap = new Map<string, unknown>(Array.from(villeByCode, ([code, name]) => [code, { ville: { name } }]));

  let logo: string | null = null;
  try {
    const res = await fetch(new URL("/logo.png", req.url));
    if (res.ok) logo = `data:image/png;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch { /* logo facultatif */ }

  const pdf = await generateBonRemise(pkgs as unknown as Pkg[], tarifMap as Map<string, ClientTarifInfo>, {
    number: String(bon.bon_number ?? "").trim() || undefined,
    destination: String(bon.destination ?? "").trim(),
    conduceOf,
    centralCode: String(centralRes.data?.value ?? "").trim(),
    date: bon.created_at ?? undefined,
    logo,
    save: false
  });
  return pdf.bytes;
}

async function pdfResponse(blob: Blob, filename: string) {
  const content = await blob.arrayBuffer();
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, "-");
  return new NextResponse(content, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=\"${safeName}\"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
