/**
 * CORS — sèl sit nou an (+ ekstansyon Chrome pou wout ingest) ka rele API a.
 * ═══════════════════════════════════════════════════════════════════════
 * Enpòtan pou konprann: yon demann "same-origin" (sit la ki rele pwòp API
 * pa li) navigatè a otorize l DEJA, san okenn header CORS — sa se konpòtman
 * natif navigatè yo, CORS pa bloke sa. Header yo anba a sèvi pou EMPÊCHER
 * yon LÒT sit ki fè yon vizitè viv nan navigatè li li chaje yon paj ki rele
 * API nou an epi li LI repons lan (vòl done, "CSRF" pa fetch).
 *
 * App mobil yo (Capacitor, wè capacitor.config.ts): yo chaje domèn ofisyèl
 * la DIREKTEMAN (server.url), donk demann yo se same-origin tou — pa gen
 * okenn orijin "capacitor://" apa pou jere isit la.
 *
 * Sèl orijin ki VRÈMAN etranje epi ki dwe rive kanmenm: ekstansyon Chrome
 * MCPACK la (/api/ingest, /api/ingest-conduce) — li deja pwoteje ak yon
 * token Bearer separe, CORS isit la se sèlman pou navigatè a kite JS
 * ekstansyon an LI repons lan.
 */
const SITE_ORIGIN = "https://www.standacommercialsa.com";

const DEV_ORIGINS = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);

/** Chemen ki gen dwa aksepte yon orijin ekstansyon Chrome (token Bearer obligatwa anplis). */
const EXTENSION_PATHS = ["/api/ingest", "/api/ingest-conduce"];

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

function extensionOriginAllowed(origin: string): boolean {
  const allowed = process.env.ALLOWED_EXTENSION_ORIGIN?.trim() ?? "";
  return !!allowed && origin === allowed;
}

function isAllowedOrigin(origin: string, pathname: string): boolean {
  if (!origin) return false;
  if (origin === SITE_ORIGIN) return true;
  if (isDev() && DEV_ORIGINS.has(origin)) return true;
  if (EXTENSION_PATHS.some((p) => pathname.startsWith(p)) && extensionOriginAllowed(origin)) return true;
  return false;
}

/**
 * Kalkile header CORS pou yon demann API. Retounen yon objè vid si orijin
 * lan pa otorize — navigatè vizitè a ap bloke lekti repons lan.
 */
export function corsHeaders(req: Request, pathname: string): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (!isAllowedOrigin(origin, pathname)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600",
  };
}
