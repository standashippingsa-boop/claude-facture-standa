import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { corsHeaders } from "@/lib/cors";

/**
 * STANDA COMMERCIAL — DOMÈN KANONIK
 * ══════════════════════════════════
 * PWOBLÈM KI KORIJE: yon kliyan te ka rive (oswa rete) sou URL deplwaman an
 * (*.vercel.app) — sa ekspoze enfrastrikti a epi li kreye yon 2yèm pòt
 * antre piblik. Kounye a tout trafik moun redirije sou domèn ofisyèl la.
 *
 * RÈG:
 *  • Nenpòt host ki PA www.standacommercialsa.com  -> redireksyon 308
 *  • Chemen + paramèt yo konsève (deep link pa pèdi)
 *  • /api/ EKSKLI: ekstansyon Chrome ak entegrasyon yo ka toujou rele
 *    endpoint yo dirèkteman san redireksyon kase otantifikasyon an.
 *  • robots.txt ak sitemap.xml EKSKLI (gade anba).
 *  • Devlopman lokal pa afekte.
 *
 * POUKISA robots.txt AK sitemap.xml PA REDIRIJE
 * ────────────────────────────────────────────
 * Google chèche de fichye sa yo sou CHAK host yon domèn genyen — ak www
 * epi san www. Si nou redirije yo, Google konsidere sitemap la "pa
 * aksesib" epi li refize l ("Invalid URL"). Se de fichye piblik ki pa gen
 * okenn done sansib ladan yo, donk yo ka reponn dirèkteman sou toude host.
 */
const CANONICAL_HOST = "www.standacommercialsa.com";

/**
 * PWOGRAM AFFILIATION — kaptire ?ref=KÒD.
 * ═══════════════════════════════════════════════════════════════════════
 * Yon moun ki klike lyen yon afilye (ex: /inscription?ref=JEAN4821) dwe
 * rete "mache" ak kòd sa a menm si li navige sou plizyè paj anvan l enskri.
 * Nou kenbe l nan yon cookie 30 jou; /api/register-client li l pou mete
 * `referred_by_affiliate_id` sou nouvo kliyan an. Kòd envalid (fòma
 * sispèk) senpleman inyore — pa gen validasyon kont bazdone a isit la
 * (middleware pa touche Supabase), sa fèt kote sèvè a nan wout la.
 */
const REF_COOKIE = "standa_ref";
const REF_RE = /^[A-Z0-9]{3,20}$/i;

/** Ajoute cookie ?ref= la sou repons lan, si prezan e valid. */
function withRef(req: NextRequest, res: NextResponse): NextResponse {
  const ref = req.nextUrl.searchParams.get("ref");
  if (ref && REF_RE.test(ref)) {
    res.cookies.set(REF_COOKIE, ref.toUpperCase(), {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 86400
    });
  }
  return res;
}

/**
 * CORS pou /api/* — gade lib/cors.ts pou detay. Aplike ISIT (yon sèl kote)
 * olye chak wout API jere pwòp header CORS pa li.
 */
function handleApiCors(req: NextRequest): NextResponse {
  const headers = corsHeaders(req, req.nextUrl.pathname);
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";

  // API: pa gen redireksyon domèn (ekstansyon/entegrasyon yo ka gen ansyen
  // URL konfigire) — men CORS aplike pou bloke lòt sit ki eseye li repons yo.
  if (req.nextUrl.pathname.startsWith("/api/")) return handleApiCors(req);

  /*
   * RASIN DOMÈN NAN -> SIT PIBLIK LA
   * ────────────────────────────────
   * standacommercialsa.com dwe montre sit wèb la, pa tablo de bò admin an.
   * Nou fè redireksyon an ISIT, anvan React monte: pa gen flash, pa gen
   * chajman initil, epi règ aksè yo (lib/access.ts) pa bezwen konnen
   * anyen sou rasin lan.
   *
   * Tablo de bò admin an sou /dashboard.
   * 307 (tanporè) espre: si yon jou ou vle chanje sa, navigatè yo ak
   * Google p ap gen ansyen redireksyon an kole nan memwa yo.
   */
  if (req.nextUrl.pathname === "/") {
    const home = req.nextUrl.clone();
    home.pathname = "/accueil";

    // An devlopman, kenbe localhost + pò a. Anliy, sèvi ak domèn ofisyèl la.
    if (!host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
      home.protocol = "https:";
      home.host = CANONICAL_HOST;
      home.port = "";
    }
    return withRef(req, NextResponse.redirect(home, 307));
  }

  // Devlopman lokal: apre redireksyon rasin lan, pa chanje lòt URL yo.
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return withRef(req, NextResponse.next());

  // Deja sou domèn kanonik la
  if (host === CANONICAL_HOST) return withRef(req, NextResponse.next());

  const url = req.nextUrl.clone();
  url.protocol = "https:";
  url.host = CANONICAL_HOST;
  url.port = "";
  return withRef(req, NextResponse.redirect(url, 308));
}

export const config = {
  // Pa kouri sou resous estatik (pèfòmans)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|apple-touch-icon.png|logo.png|robots.txt|sitemap.xml).*)"],
};
