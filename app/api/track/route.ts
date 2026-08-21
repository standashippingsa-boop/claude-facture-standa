import { NextResponse } from "next/server";
import { rateLimit, tooMany, clientIp } from "@/lib/ratelimit";
import { createClient } from "@supabase/supabase-js";

/**
 * STANDA COMMERCIAL — TRACKING PIBLIK (/api/track)
 * ═════════════════════════════════════════════════
 * Nenpòt moun (san koneksyon) ka tape yon nimewo tracking epi wè kote koli a ye.
 *
 * ⚠️ PRENSIP SEKIRITE — LI SA A ANVAN OU CHANJE ANYEN ISIT:
 *
 *  1) WOUT SA A KOURI SOU SÈVÈ VERCEL LA SÈLMAN.
 *     Kle sèvis Supabase la (SUPABASE_SERVICE_ROLE_KEY) pa janm rive nan
 *     navigatè vizitè a. Se poutèt sa nou PA janm rele tab `packages` la
 *     dirèkteman depi paj piblik la.
 *
 *  2) SE 6 KOLÒN SÈLMAN KI SOTI NAN BAZDONE A.
 *     tracking_number, tracking_manual, status, weight, created_date, received_at.
 *     Non kliyan, kòd MC, adrès, telefòn, pri, taks, total, fakti — yo pa
 *     menm chaje. Yo pa ka "chape" paske yo pa nan repons SQL la ditou.
 *     ❌ PA JANM ajoute customer_name, customer_code, price_usd, total_usd,
 *        invoice_id, ni mcpack_data nan SELECT la.
 *
 *  3) ANTI-ENUMERASYON (anpeche moun "peche" nan bazdone a):
 *     • omwen MIN_LEN karaktè — pa ka tape "1" epi tonbe sou yon koli
 *     • karaktè jokè SQL (% _) retire — san sa "%" ta bay tout koli yo
 *     • rechèch EGZAK sèlman — pa gen "kòmanse pa", pa gen lis
 *     • yon sèl rezilta maksimòm
 *
 *  4) RATE LIMIT: 10 rechèch pa 5 minit pa IP. Bloke robo, pa deranje moun.
 *
 *  5) METÒD POST, PA GET.
 *     Ak GET, nimewo tracking la ta ekri nan jounal sèvè yo ak nan
 *     header "Referer" lòt sit. Ak POST li rete nan kò demann nan.
 */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** Longè minimòm yon nimewo tracking pou nou aksepte chèche l */
const MIN_LEN = 6;

/** Longè maksimòm (pwoteksyon kont demann demezire) */
const MAX_LEN = 60;

/**
 * Netwaye sa vizitè a tape.
 * Nou kite lèt, chif ak tirè sèlman. Tout lòt bagay (espas, %, _, kòt,
 * karaktè SQL) disparèt. Konsa pa gen okenn fason pou fè rechèch la
 * vin yon "lis tout koli".
 */
function cleanTracking(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, MAX_LEN);
}

export async function POST(req: Request) {
  // ── 1. Rate limit ────────────────────────────────────────────────
  const rl = rateLimit("track:" + clientIp(req), 10, 300000); // 10 / 5 min
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    if (!SERVICE) {
      // Mesaj jeneral — nou pa revele konfigirasyon entèn bay yon vizitè
      return NextResponse.json(
        { ok: false, reason: "Service temporairement indisponible." },
        { status: 503 }
      );
    }

    // ── 2. Li ak netwaye antre a ───────────────────────────────────
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    const q = cleanTracking(body.tracking);

    if (q.length < MIN_LEN) {
      return NextResponse.json({
        ok: false,
        found: false,
        reason: `Entrez un numéro de tracking complet (au moins ${MIN_LEN} caractères).`
      });
    }

    // ── 3. Rechèch sou sèvè a ──────────────────────────────────────
    const svc = createClient(URL_, SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // ⚠️ SELECT la: 6 kolòn, pa youn de plis.
    const COLS = "tracking_number,tracking_manual,status,weight,created_date,received_at";

    // Koli a ka anrejistre swa sou Tracking ID (Guía) MCPACK la,
    // swa sou Tracking Number transpòtè a (UPS/FedEx/USPS...).
    // Nou eseye toude — men EGZAK, san jokè.
    let { data, error } = await svc
      .from("packages")
      .select(COLS)
      .eq("tracking_number", q)
      .limit(1);

    if (!error && (!data || data.length === 0)) {
      const alt = await svc
        .from("packages")
        .select(COLS)
        .eq("tracking_manual", q)
        .limit(1);
      data = alt.data;
      error = alt.error;
    }

    if (error) {
      return NextResponse.json(
        { ok: false, reason: "Service temporairement indisponible." },
        { status: 503 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        ok: true,
        found: false,
        reason: "Aucun colis trouvé avec ce numéro. Vérifiez le numéro et réessayez."
      });
    }

    const p: any = data[0];

    // ── 4. Repons — SÈLMAN sa vizitè a gen dwa wè ──────────────────
    return NextResponse.json({
      ok: true,
      found: true,
      package: {
        tracking_number: p.tracking_number || "",
        tracking_manual: p.tracking_manual || "",
        status: p.status || "",
        weight: Number(p.weight ?? 0),
        created_date: p.created_date || "",
        received_at: p.received_at || null
      }
    });
  } catch {
    return NextResponse.json(
      { ok: false, reason: "Service temporairement indisponible." },
      { status: 503 }
    );
  }
}

/**
 * GET bloke espre. Wè nòt #5 anwo a: nou pa vle nimewo tracking nan URL.
 * Si yon moun louvri /api/track nan navigatè l, li jwenn mesaj sa a.
 */
export async function GET() {
  return NextResponse.json(
    { ok: false, reason: "Méthode non autorisée." },
    { status: 405 }
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
