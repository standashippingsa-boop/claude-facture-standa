/*
 * STANDA COMMERCIAL — Konfigirasyon Sentry (rapò erè)
 * ═══════════════════════════════════════════════════
 * YON SÈL kote ki dekri sa Sentry gen dwa voye. Kliyan, sèvè ak edge
 * (instrumentation-client.ts, instrumentation.ts) sèvi ak menm fonksyon an.
 *
 * OPT-IN : san NEXT_PUBLIC_SENTRY_DSN, SDK a pa fè anyen (pa gen rezo).
 * DSN a piblik pa konsepsyon (li antre nan bundle navigatè a) — se PA yon
 * sekrè. Pa mete yon token Sentry isit la.
 *
 * ⚠️ APP SA A MANIPILE DONE PÈSONÈL (telefòn, adrès, idantite kliyan) EPI
 *    JETON SESYON (kò demann /api/*, "#access_token=" nan lyen modpas).
 *    Sentry pa dwe janm wè yo. Pa aktive pa okenn rezon, san revizyon :
 *      • sendDefaultPii / Session Replay — anrejistre ekran kliyan an
 *      • tracesSampleRate — ajoute header sentry-trace/baggage sou apèl
 *        sòti (Supabase, Resend, Firebase) epi voye URL ak paramèt
 *      • breadcrumb "console" — nenpòt done ki nan console.log
 *    Tout sa ki soti pase pa scrubEvent / scrubBreadcrumb anba a.
 *
 * Fichye sa a pa gen okenn import ekzekitab (sèlman tip) — li mache menm
 * jan nan navigatè, Node ak Edge.
 */
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

/** [modèl, ranplasman] — lòd la enpòtan (jeton anvan nimewo). */
const REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g, "[jwt]"],          // jeton Supabase (JWT)
  [/Bearer\s+[\w.~+/=-]+/gi, "Bearer [token]"],              // header Authorization
  [/\bsb_(?:secret|publishable)_[\w-]+/gi, "[cle]"],         // nouvo kle Supabase
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]"],              // imèl
  [/\bMC-?\d{3,}\b/gi, "MC-[code]"],                         // kòd kliyan (adrès 2 Miami)
  [/\+?\d[\d\s().-]{6,}\d/g, "[num]"],                       // telefòn / nimewo long
];

export function scrubText(value: string): string {
  let out = value;
  for (const [re, by] of REDACTIONS) out = out.replace(re, by);
  return out;
}

/** URL san query (?...) ni fragman (#...) — jeton modpas yo ret la — epi san kòd kliyan. */
function cleanUrl(url: string): string {
  return scrubText(url.replace(/[?#].*$/, ""));
}

/**
 * Netwaye rekirsivman yon objè (contexts, extra, tags). SDK a mete tèt li done
 * ladan yo : egzanp `contexts.nextjs.request_path` = chemen AK query string
 * (jwenn pa tès bout-a-bout la). Kle ki gen "url"/"path" pase pa cleanUrl.
 */
function scrubDeep(value: unknown, key = "", depth = 0): unknown {
  if (typeof value === "string") {
    // trace_id / span_id / event_id : idantifyan teknik (hex) — regex nimewo a ta kase fòma yo
    if (/(^|_)id$/i.test(key)) return value;
    return /url|path/i.test(key) ? cleanUrl(value) : scrubText(value);
  }
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, key, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = scrubDeep(v, k, depth + 1);
  return out;
}

export function scrubEvent<T extends ErrorEvent>(event: T): T {
  delete event.user;
  if (event.contexts?.trace) delete event.contexts.trace.data;   // atribi span : url.full, query...
  if (event.contexts) event.contexts = scrubDeep(event.contexts) as typeof event.contexts;
  if (event.extra) event.extra = scrubDeep(event.extra) as typeof event.extra;
  if (event.tags) event.tags = scrubDeep(event.tags) as typeof event.tags;
  if (event.request) {
    delete event.request.data;          // kò demann : jeton, telefòn, adrès
    delete event.request.cookies;
    delete event.request.headers;       // authorization, cookie
    delete event.request.query_string;
    if (event.request.url) event.request.url = cleanUrl(event.request.url);
  }
  if (event.message) event.message = scrubText(event.message);
  if (event.transaction) event.transaction = cleanUrl(event.transaction);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubText(ex.value);
  }
  return event;
}

export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  if (crumb.category === "console") return null;
  if (crumb.message) crumb.message = scrubText(crumb.message);
  const data = crumb.data;
  if (data) {
    for (const key of ["url", "from", "to"]) {
      if (typeof data[key] === "string") data[key] = cleanUrl(data[key]);
    }
  }
  return crumb;
}

export function buildSentryOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    sendDefaultPii: false,
    maxBreadcrumbs: 30,
    // Pa mete tracesSampleRate : nou vle SÈLMAN erè (gade nòt anwo a).
    tracePropagationTargets: [] as string[],
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
    // Move rezo (Ayiti) ak bri navigatè pa itil epi manje kota gratis la.
    ignoreErrors: [
      /^Failed to fetch$/i,
      /^Load failed$/i,
      /^NetworkError/i,
      /ResizeObserver loop/i,
    ],
    denyUrls: [/^chrome-extension:\/\//i, /^moz-extension:\/\//i, /^safari-extension:\/\//i],
  };
}
