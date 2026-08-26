import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";

  // Devlopman lokal: pa touche
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return NextResponse.next();

  // Deja sou domèn kanonik la
  if (host === CANONICAL_HOST) return NextResponse.next();

  // API: pa redirije (ekstansyon/entegrasyon yo ka gen ansyen URL konfigire)
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.protocol = "https:";
  url.host = CANONICAL_HOST;
  url.port = "";
  return NextResponse.redirect(url, 308);
}

export const config = {
  // Pa kouri sou resous estatik (pèfòmans)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|apple-touch-icon.png|logo.png|robots.txt|sitemap.xml).*)"],
};
