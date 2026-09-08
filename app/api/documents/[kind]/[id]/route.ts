import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";

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
    return /^[A-Za-z0-9._-]+\.pdf$/i.test(path) ? path : "";
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
  if (String(bon.destination ?? "").trim().toLocaleLowerCase() === zoneName) return true;

  const links = await db.from("bon_remise_conduces").select("conduce_id").eq("bon_remise_id", bon.id);
  const conduceIds = (links.data ?? []).map((row: { conduce_id: string }) => row.conduce_id).filter(Boolean);
  if (!conduceIds.length) return false;
  const packages = await db.from("packages").select("customer_code").in("conduce_id", conduceIds);
  const codes = Array.from(new Set((packages.data ?? []).map((row: { customer_code: string }) => row.customer_code).filter(Boolean)));
  if (!codes.length) return false;
  const clients = await db.from("clients").select("ville_id").in("customer_code", codes);
  return (clients.data ?? []).some((row: { ville_id: string | null }) => row.ville_id === staff.pickup_ville_id);
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
      .select("id, bon_number, destination, pdf_path").eq("id", id).maybeSingle();
    if (!bon?.pdf_path) return NextResponse.json({ ok: false, reason: "PDF indisponible." }, { status: 404 });
    const allowed = staff.role === "admin" || staff.role === "employe"
      || (staff.role === "agent_retrait" && await agentCanReadBon(db, staff, bon));
    if (!allowed) return NextResponse.json({ ok: false, reason: "Accès refusé." }, { status: 403 });

    const { data, error } = await db.storage.from(BON_BUCKET).download(storedPath(bon.pdf_path));
    if (error || !data) return NextResponse.json({ ok: false, reason: "PDF indisponible." }, { status: 404 });
    return pdfResponse(data, `Bon-remise-${bon.bon_number || id}.pdf`);
  } catch (error) {
    console.error("[secure-document]", error);
    return NextResponse.json({ ok: false, reason: "Document indisponible." }, { status: 500 });
  }
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
