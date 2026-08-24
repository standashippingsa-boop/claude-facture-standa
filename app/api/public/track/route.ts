import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, tooMany, clientIp } from "@/lib/ratelimit";
import {
  MIN_TRACKING_LENGTH, PUBLIC_PACKAGE_COLUMNS,
  normalizePublicTracking, toPublicTracking, RawPublicRow
} from "@/lib/publicdata";

/*
 * STANDA COMMERCIAL — TRACKING PIBLIK (SÈL PÒT SIT LA)
 * ════════════════════════════════════════════════════
 * Se WOUT SA A SÈLMAN ki bay sit wèb piblik la done. Sit la pa gen okenn
 * lòt fason pou l pale ak bazdone a — li pa gen kle Supabase ditou.
 *
 * PRENSIP: LE SIT PIBLIK PA KONNEN BAZDONE A EGZISTE.
 * ───────────────────────────────────────────────────
 * Yon paj piblik ki ta gen kle Supabase la nan navigatè a ta bay chak
 * vizitè yon kle pou frape bazdone a dirèkteman. Isit la, kle a rete SOU
 * SÈVÈ A. Vizitè a resevwa yon repons JSON tou piti — pa yon kle.
 *
 * GAD SEKIRITE (chak youn regle yon atak reyèl)
 * ─────────────────────────────────────────────
 *  1) LIS BLANCH KOLÒN — nou pa janm fè select("*"). Yon nouvo kolòn nan
 *     bazdone a pa ka koule sou sit piblik la pa aksidan.
 *  2) KONSTRIKSYON CHAN PA CHAN — repons lan bati nan lib/publicdata.ts.
 *     Menm si rechèch la ta pote plis done, sèlman chan otorize yo soti.
 *  3) KONT ENUMERASYON — nimewo tracking yo swiv youn apre lòt
 *     (WR102600157921, ...922). San gad, yon robo ta ka pase yo youn apre
 *     lòt epi ranmase done tout kliyan. Donk:
 *        • egalite EGZAK sèlman (pa gen `like`, pa gen rechèch pasyèl)
 *        • lèt/chif sèlman — okenn karaktè jokè pa ka pase
 *        • longè minimòm — "WR" pa ka bay tout koli
 *        • kadans sere: 12 rechèch / minit, 80 / èdtan pa IP
 *  4) ZEWO IDANTITE — pa gen non, kòd kliyan, telefòn, adrès, pri, pwa,
 *     ni kontni. Yon moun ki devine yon nimewo pa aprann pou kiyès li ye.
 *  5) PA KACHE — Cache-Control: no-store. Repons yon moun pa janm sèvi
 *     yon lòt moun.
 *  6) ZEWO DETAY ERÈ — nou pa janm voye mesaj bazdone a bay deyò.
 *
 * Metòd: POST sèlman. Yon GET ak tracking nan URL la ta antre nan istorik
 * navigatè a, nan log yo, epi nan referrer yo — twòp kote pou yon done
 * moun ka sèvi pou vòlè yon koli.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Repons uniform — menm fòm pou tout ka (pa ede yon atakè aprann anyen). */
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex"
    }
  });

export async function POST(req: Request) {
  const ip = clientIp(req);

  // Kadans: 12/minit epi 80/èdtan. Yon moun nòmal chèche 1-3 koli.
  const rlMin = rateLimit(`ptrack:m:${ip}`, 12, 60_000);
  if (!rlMin.ok) return tooMany(rlMin.retryAfter);
  const rlHr = rateLimit(`ptrack:h:${ip}`, 80, 3_600_000);
  if (!rlHr.ok) return tooMany(rlHr.retryAfter);

  let saisie = "";
  try {
    const body = (await req.json()) as { tracking?: unknown };
    saisie = normalizePublicTracking(body?.tracking);
  } catch {
    return json({ ok: false, reason: "Requête invalide." }, 400);
  }

  if (saisie.length < MIN_TRACKING_LENGTH) {
    return json({
      ok: false,
      reason: `Entrez le numéro de suivi complet (au moins ${MIN_TRACKING_LENGTH} caractères).`
    }, 400);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ ok: false, reason: "Service indisponible." }, 503);

  try {
    // Kle sèvis la rete SOU SÈVÈ A. Li pa janm ale nan navigatè a.
    const db = createClient(url, key, { auth: { persistSession: false } });

    // Egalite EGZAK sou de kolòn tracking yo. Okenn rechèch pasyèl.
    const { data, error } = await db
      .from("packages")
      .select(PUBLIC_PACKAGE_COLUMNS)
      .or(`tracking_number.eq.${saisie},tracking_manual.eq.${saisie}`)
      .limit(1);

    if (error) return json({ ok: false, reason: "Service indisponible." }, 503);

    const row = (data ?? [])[0] as RawPublicRow | undefined;
    if (!row) {
      return json({
        ok: true, found: false,
        message: "Aucun colis trouvé avec ce numéro. Vérifiez le numéro, "
               + "ou contactez-nous si votre colis vient d'arriver."
      });
    }

    // Repons lan bati chan pa chan — pa yon kopi objè bazdone a.
    return json({ ok: true, found: true, result: toPublicTracking(row, saisie) });
  } catch {
    return json({ ok: false, reason: "Service indisponible." }, 503);
  }
}

/** GET bloke espre — tracking pa dwe antre nan URL, log ni istorik. */
export function GET() {
  return json({ ok: false, reason: "Méthode non autorisée." }, 405);
}
