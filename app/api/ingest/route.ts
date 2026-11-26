import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { rateLimit, tooMany, clientIp } from "@/lib/ratelimit";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { safeParsePackage } from "@/lib/validation/shipping";

/**
 * ENDPOINT EKSTANSYON CHROME (V8 Faz 1 — preparasyon)
 * ────────────────────────────────────────────────────
 * Ekstansyon Chrome MCPACK la (pita) ap voye koli yo isit la. Pou kounye a,
 * estrikti a pare men okenn ekstansyon pa deplwaye ankò.
 *
 * Sekirite: chak demann dwe pote yon token valab nan header
 *   Authorization: Bearer <token>
 * Token yo jere nan tab `api_tokens` (admin kreye yo).
 *
 * Anti-doublon: Tracking Number se kle a — koli ki egziste PA re-kreye,
 * se statut/dat/pwa/kontni ki mete ajou sèlman.
 *
 * Chak batch anrejistre nan Journal (received_method = "Extension Chrome").
 */

interface IncomingPkg {
  guia: string;               // Tracking ID (WR...) — KLE INIK
  tracking_number?: string;   // Tracking Number transpòtè (TBA/GFUS/4203...) -> tracking_manual
  customer_code?: string;
  customer_name?: string;
  weight?: number;
  content?: string;
  created_date?: string;
  status_raw?: string;
}

// Yon Guía valab kòmanse pa WR (menm règ ak lib/utils isGuia)
// Plizyè bwat nan menm chajman: MCPACK ajoute -2, -3, -4… nan fen Guía a (WR082600276025-4).
const isGuia = (v?: string) => /^WR\d{6,}(-\d{1,3})?$/i.test(String(v ?? "").trim());
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
  // Rate limiting — ekstansyon: 120 / min pa IP
  const rl = await rateLimit("ingest:" + clientIp(req), 120, 60000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    // 1) Verifikasyon token
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) return NextResponse.json({ ok: false, reason: "Token manquant." }, { status: 401 });

    const db = svc();
    // Nou konpare HASH yo — jeton an klè pa janm estoke (wè migration.sql v11).
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { data: tok } = await db.from("api_tokens")
      .select("id, active").eq("token_hash", tokenHash).maybeSingle();
    if (!tok || !tok.active) return NextResponse.json({ ok: false, reason: "Token invalide." }, { status: 403 });
    await db.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tok.id);

    // 2) Done yo
    const body = await req.json().catch(() => null);
    const items: IncomingPkg[] = Array.isArray(body?.packages) ? body.packages : [];
    if (!items.length) return NextResponse.json({ ok: false, reason: "Aucun colis reçu." }, { status: 400 });
    if (items.length > 500) return NextResponse.json({ ok: false, reason: "Trop de colis en un seul envoi : 500 maximum." }, { status: 400 });

    // 3) Anti-doublon pa GUÍA (WR) — se kle inik la nan sistèm nan
    const guias = items.map((p) => cleanTk(p.guia)).filter(isGuia);
    const { data: exist } = await db.from("packages")
      .select("tracking_number").in("tracking_number", guias);
    const existSet = new Set((exist ?? []).map((e: { tracking_number: string }) => e.tracking_number));

    const now = new Date().toISOString();
    let created = 0, updated = 0, ignored = 0;
    // Chak koli ki sote ak REZON an — san sa, "N ignorés" pa di anyen sou koli ki manke a.
    const skipped: Array<{ guia: string; customer: string; reason: string }> = [];
    const skip = (guia: string, customer: unknown, reason: string) => {
      ignored++;
      skipped.push({ guia: guia || "·", customer: String(customer ?? "").trim(), reason });
    };
    const seen = new Set<string>();
    const newCodes = new Map<string, string>();   // kòd kliyan -> non (koli ki fèk kreye)

    for (const p of items) {
      const guia = cleanTk(p.guia);
      // MODE ZÉRO RISQUE: san yon Guía WR valab, nou pa kreye/modifye anyen
      if (!isGuia(guia)) { skip(guia, p.customer_code, "Guía invalide (doit commencer par WR)"); continue; }
      if (seen.has(guia)) { skip(guia, p.customer_code, "Doublon dans le même envoi"); continue; }
      seen.add(guia);

      // Validation Zod (pwa borné, longè contenu) — un eleman envalid se
      // sote sèlman (ignored++), li PA fè tout batch la echwe.
      const parsed = safeParsePackage(p);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        skip(guia, p.customer_code, `Donnée refusée (${issue?.path.join(".") || "colis"}) : ${issue?.message ?? "invalide"}`);
        continue;
      }
      p.weight = parsed.data.weight;
      p.content = parsed.data.content;

      const code = normalizeMc(p.customer_code);
      // Tracking Number transpòtè: dwe PA yon WR (sinon nou pa mete l)
      const tnum = p.tracking_number && !isGuia(p.tracking_number) ? cleanTk(p.tracking_number) : "";

      if (existSet.has(guia)) {
        // Mete ajou enfo ki chanje sèlman. PA touche statut entèn, pri, ni tracking_manual
        // ki admin ta ka deja antre — sof si li vid epi nou gen youn ki soti MCPACK.
        const patch: Record<string, unknown> = { received_at: now, received_method: "Extension Chrome", src_extension: true };
        if (p.status_raw?.trim()) patch.status_mcpack = p.status_raw.trim();
        if (p.weight != null) patch.weight = p.weight;
        if (p.content) patch.content = p.content;
        // Date « Creado » MCPACK (arrivée à l'adresse de Miami) : corrigée à chaque passage si elle est valide.
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(p.created_date ?? "").trim())) patch.created_date = String(p.created_date).trim();
        if (tnum) {
          // Ranpli tracking_manual SÈLMAN si li vid nan baz la (pa efase sa admin mete)
          const { data: cur } = await db.from("packages")
            .select("tracking_manual").eq("tracking_number", guia).maybeSingle();
          if (cur && !String(cur.tracking_manual ?? "").trim()) patch.tracking_manual = tnum;
        }
        const update = await db.from("packages").update(patch).eq("tracking_number", guia);
        if (update.error) {
          console.error("[ingest:update]", guia, update.error);
          skip(guia, code, `Mise à jour refusée par la base : ${String(update.error.message ?? "erreur").slice(0, 160)}`);
          continue;
        }
        updated++;
      } else {
        const insert = await db.from("packages").insert({
          tracking_number: guia,              // Guía WR = kle inik
          tracking_manual: tnum,              // Tracking Number transpòtè (kolòn separe)
          customer_code: code,
          customer_name: p.customer_name ?? code,
          weight: p.weight ?? 0,
          content: p.content ?? "",
          created_date: p.created_date ?? "",
          status: "Reçu à Miami",
          status_mcpack: p.status_raw?.trim() ?? "",
          received_at: now,
          received_method: "Extension Chrome",
          src_extension: true,
          mcpack_data: { Guia: guia, TrackingNumber: tnum }
        });
        // Un colis non enregistré ne compte pas et ne déclenche aucune alerte.
        if (insert.error) {
          console.error("[ingest:insert]", guia, insert.error);
          skip(guia, code, `Enregistrement refusé par la base : ${String(insert.error.message ?? "erreur").slice(0, 160)}`);
          continue;
        }
        created++;
        if (code && !newCodes.has(code)) newCodes.set(code, String(p.customer_name ?? "").trim() || code);
      }
    }

    // 3b) Kliyan ki pa anrejistre nan sistèm nan: kreye fich li (menm jan ak
    // enpòtasyon Excel la) ak import_new = true -> ti boul wouj nan lis Clients
    // + « Nouveau client » sou paj akèy la. Yon echèk isit pa janm bloke koli yo.
    if (newCodes.size) {
      try {
        const codes = Array.from(newCodes.keys());
        const { data: have } = await db.from("clients").select("customer_code").in("customer_code", codes);
        const known = new Set((have ?? []).map((c: { customer_code: string }) => c.customer_code));
        const stubs = codes.filter((c) => !known.has(c))
          .map((c) => ({ customer_code: c, fullname: newCodes.get(c) || c, import_new: true }));
        if (stubs.length) {
          const res = await db.from("clients").upsert(stubs, { onConflict: "customer_code", ignoreDuplicates: true });
          if (res.error) console.error("[ingest:clients]", res.error);
        }
      } catch (e) { console.error("[ingest:clients]", e); }
    }

    // 4) Journal
    await db.from("journal").insert({
      user_name: "Extension Chrome", action: "Extension Chrome",
      details: `${created} créés, ${updated} mis à jour, ${ignored} ignorés`
        + skipped.slice(0, 8).map((s) => ` | ${s.guia} ${s.customer} : ${s.reason}`).join(""),
      package_ref: "", customer_code: ""
    });

    // 5) Courriel + push « Reçu à Miami » : chaque colis créé entre dans la file
    // d'attente des notifications (trigger sur packages), envoyée chaque minute
    // par /api/notify-dispatch, avec nouveaux essais en cas d'échec.
    const pushSent = 0, emailSent = 0, emailFailed = 0;

    return NextResponse.json({ ok: true, created, updated, ignored, total: items.length, pushSent, emailSent, emailFailed, skipped: skipped.slice(0, 30) });
  } catch (e) {
    // Pa gen detay entèn (non tab, erè Postgres, stack) ki soti bay kliyan an.
    console.error("[ingest]", e);
    return NextResponse.json({ ok: false, reason: "Erreur serveur." }, { status: 500 });
  }
}
