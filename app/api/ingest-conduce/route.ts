import { NextResponse } from "next/server";
import { CONDUCE_ARRIVAL_STATUS, shouldPromoteOnConduce } from "@/lib/types";
import { rateLimit, tooMany, clientIp } from "@/lib/ratelimit";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

/**
 * ENDPOINT EKSTANSYON CHROME — IMPORT CONDUCE (Faz 2b — preparasyon)
 * ────────────────────────────────────────────────────────────────
 * Kontrèman ak "otomatizasyon navigasyon" (bot), sa a sipoze yon ekstansyon
 * ki LI paj MCPACK ke itilizatè a DEJA louvri manyèlman (menm modèl ak
 * /api/ingest ki egziste pou koli endividyèl) — pa gen okenn navigasyon
 * otonòm. Itilizatè a chèche/louvri Conduce a sou MCPACK jan l abitye fè;
 * ekstansyon an detekte paj la epi voye done yo isit la.
 *
 * Sekirite: menm token ak /api/ingest — Authorization: Bearer <token>
 * (tab api_tokens).
 *
 * RÈG (Single Source of Truth): Package ki egziste deja pa re-kreye — li jwenn
 * pa Guía (WR) epi LYE ak conduce_id la. Si li pa egziste, li kreye l (menm
 * jan /api/ingest fè), epi lye l ak conduce a. JANM doublon Package.
 */

interface IncomingPkg {
  guia: string;               // Tracking ID (WR...) — KLE INIK
  tracking_number?: string;   // Tracking Number transpòtè
  customer_code?: string;
  customer_name?: string;
  weight?: number;
  content?: string;
  created_date?: string;
  status_raw?: string;
}

const isGuia = (v?: string) => /^WR\d{6,}$/i.test(String(v ?? "").trim());
const cleanTk = (v?: string) => String(v ?? "").trim().replace(/\s+/g, "").toUpperCase();

function svc() {
  const config = getSupabaseAdminConfig();
  if (!config) throw new Error("Configuration serveur incomplète.");
  return createClient(
    config.url,
    config.key,
    { auth: { persistSession: false } }
  );
}

function normalizeMc(raw?: string | null): string {
  const s = String(raw ?? "").trim().replace(/\s+/g, "").toUpperCase();
  if (!s) return "";
  return s.startsWith("MC-") ? s : "MC-" + s.replace(/^MC/, "").replace(/^-+/, "");
}

export async function POST(req: Request) {
  // Rate limiting — conduce: 60 / min pa IP
  const rl = rateLimit("conduce:" + clientIp(req), 60, 60000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    // 1) Verifikasyon token (menm modèl ak /api/ingest)
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) return NextResponse.json({ ok: false, reason: "Token manquant." }, { status: 401 });

    const db = svc();
    const { data: tok } = await db.from("api_tokens")
      .select("id, active").eq("token", token).maybeSingle();
    if (!tok || !tok.active) return NextResponse.json({ ok: false, reason: "Token invalide." }, { status: 403 });
    await db.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tok.id);

    // 2) Done yo
    const body = await req.json().catch(() => null);
    const conduceNumber = String(body?.conduce_number ?? "").trim();
    const office = String(body?.office ?? "").trim();
    const items: IncomingPkg[] = Array.isArray(body?.packages) ? body.packages : [];
    if (!conduceNumber) return NextResponse.json({ ok: false, reason: "Numéro de conduce manquant." }, { status: 400 });
    if (!items.length) return NextResponse.json({ ok: false, reason: "Aucun package reçu." }, { status: 400 });

    // 3) Conduce — jwenn si li egziste, kreye si non (jamè doublon)
    const now = new Date().toISOString();
    let conduce = (await db.from("conduces").select("*").eq("conduce_number", conduceNumber).maybeSingle()).data;
    if (!conduce) {
      const { data: created } = await db.from("conduces").insert({
        conduce_number: conduceNumber, office, imported_by: "Extension Chrome", imported_at: now
      }).select("*").single();
      conduce = created;
    }
    if (!conduce) return NextResponse.json({ ok: false, reason: "Impossible de créer la conduce." }, { status: 500 });

    // 4) Anti-doublon pa GUÍA — menm modèl ak /api/ingest
    const guias = items.map((p) => cleanTk(p.guia)).filter(isGuia);
    const { data: exist } = await db.from("packages")
      .select("tracking_number, conduce_id, status, invoice_id").in("tracking_number", guias);
    const existMap = new Map((exist ?? []).map(
      (e: { tracking_number: string; conduce_id?: string | null; status?: string; invoice_id?: string | null }) =>
        [e.tracking_number, e]));

    let created = 0, updated = 0, linked = 0, ignored = 0, promus = 0;
    const seen = new Set<string>();

    for (const p of items) {
      const guia = cleanTk(p.guia);
      if (!isGuia(guia) || seen.has(guia)) { ignored++; continue; }
      seen.add(guia);
      const code = normalizeMc(p.customer_code);
      const tnum = p.tracking_number && !isGuia(p.tracking_number) ? cleanTk(p.tracking_number) : "";

      if (existMap.has(guia)) {
        // Package egziste deja — mete ajou + lye ak Conduce a (si li poko lye yon lòt kote)
        const prev = existMap.get(guia)!;
        const currentConduceId = prev.conduce_id;
        const patch: Record<string, unknown> = { received_at: now, received_method: "Extension Chrome", src_extension: true };
        if (p.status_raw?.trim()) patch.status_mcpack = p.status_raw.trim();
        if (p.weight != null) patch.weight = p.weight;
        if (p.content) patch.content = p.content;
        if (!currentConduceId) { patch.conduce_id = conduce.id; linked++; }
        // STATUT OTOMATIK: nimewo conduce = lo a rive an Ayiti. Jamè an aryè.
        if (shouldPromoteOnConduce(prev.status, prev.invoice_id)) {
          patch.status = CONDUCE_ARRIVAL_STATUS; promus++;
        }
        await db.from("packages").update(patch).eq("tracking_number", guia);
        updated++;
      } else {
        // Pa egziste — kreye l (menm jan /api/ingest), lye dirèk ak Conduce a
        await db.from("packages").insert({
          tracking_number: guia, tracking_manual: tnum,
          customer_code: code, customer_name: p.customer_name ?? code,
          weight: p.weight ?? 0, content: p.content ?? "",
          created_date: p.created_date ?? "",
          status: CONDUCE_ARRIVAL_STATUS, status_mcpack: p.status_raw?.trim() ?? "",
          received_at: now, received_method: "Extension Chrome", src_extension: true,
          conduce_id: conduce.id,
          mcpack_data: { Guia: guia, TrackingNumber: tnum }
        });
        created++; linked++;
      }
    }

    await db.from("conduces").update({ updated_at: now }).eq("id", conduce.id);

    await db.from("journal").insert({
      user_name: "Extension Chrome", action: "Import Conduce (Extension)",
      details: `Conduce ${conduceNumber} : ${created} créés, ${updated} mis à jour, ${linked} liés, `
             + `${promus} passés en "${CONDUCE_ARRIVAL_STATUS}", ${ignored} ignorés`,
      package_ref: "", customer_code: ""
    });

    return NextResponse.json({ ok: true, conduce_id: conduce.id, created, updated, linked, promus, ignored, total: items.length });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, reason: (e as Error)?.message ?? "Erreur serveur." }, { status: 500 });
  }
}
