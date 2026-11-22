/*
 * Standa Commercial — Rate limiting (limitasyon kadans)
 * ═════════════════════════════════════════════════════
 * Pwoteje wout sansib yo kont abi: brute-force, spam enskripsyon,
 * enjeksyon koli an mas, spam imèl.
 *
 * DE NIVO
 * ───────
 * 1. Upstash Redis (si UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *    egziste nan Vercel) : YON SÈL kontè pou tout instance Vercel yo,
 *    donk limit la egzak, menm lè Vercel louvri plizyè sèvè.
 * 2. Memwa lokal (fallback) : si Upstash pa konfigire, si l pa reponn
 *    nan 800 ms oswa si l bay erè. Li toujou bloke atak senp yo.
 *
 * Si Upstash tonbe, nou PA bloke kliyan yo (fail-open sou memwa a) :
 * yon pàn Redis pa dwe janm kase sit la.
 *
 * Kle Upstash yo se kle SÈVÈ : pa janm mete yo ak prefiks NEXT_PUBLIC_.
 */

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

/** Netwaye antre ki ekspire (pou memwa a pa grandi san limit). */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

/**
 * IP kliyan an — dèyè Cloudflare (si l aktive) epi/oswa proxy Vercel la.
 *
 * Lòd la enpòtan : depi domèn nan pase pa Cloudflare, `CF-Connecting-IP`
 * se header ki pi fyab la — Cloudflare li menm ki ekri l, li pa vin
 * SÈLMAN kopye sa vizitè a voye. `x-forwarded-for` rete fallback pou
 * lokal/Vercel san Cloudflare (premye adrès nan lis la se kliyan an).
 */
export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return (xff.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}

type Verdict = { ok: true } | { ok: false; retryAfter: number };

function memoryLimit(key: string, limit: number, windowMs: number): Verdict {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count++;
  return { ok: true };
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, "");
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Fenèt fiks sou Redis : INCR + PEXPIRE (sèlman premye fwa a, NX) + PTTL,
 * tout nan yon sèl demann HTTP (pipeline). Retounen null si Upstash pa
 * disponib, pou n tonbe sou memwa a.
 */
async function upstashLimit(key: string, limit: number, windowMs: number): Promise<Verdict | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  const k = "rl:" + key;
  try {
    const res = await fetch(UPSTASH_URL + "/pipeline", {
      method: "POST",
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", k],
        ["PEXPIRE", k, String(windowMs), "NX"],
        ["PTTL", k]
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(800)
    });
    if (!res.ok) return null;
    const out = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    const count = Number(out?.[0]?.result);
    let ttl = Number(out?.[2]?.result);
    if (!Number.isFinite(count)) return null;
    // Kle san ekspirasyon (ttl = -1) : remete l pou l pa janm bloke pou tout tan.
    if (!Number.isFinite(ttl) || ttl < 0) {
      ttl = windowMs;
      void fetch(`${UPSTASH_URL}/pexpire/${encodeURIComponent(k)}/${windowMs}`, {
        method: "POST", headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }, cache: "no-store"
      }).catch(() => {});
    }
    if (count > limit) return { ok: false, retryAfter: Math.max(1, Math.ceil(ttl / 1000)) };
    return { ok: true };
  } catch {
    return null;
  }
}

/**
 * Tcheke si yon aksyon otorize.
 * @param key     idantifyan (ex: "register:1.2.3.4")
 * @param limit   kantite maksimòm nan fenèt la
 * @param windowMs longè fenèt la an milisgond
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<Verdict> {
  return (await upstashLimit(key, limit, windowMs)) ?? memoryLimit(key, limit, windowMs);
}

/** Repons estanda 429 (mesaj moun ka konprann, zewo detay teknik). */
export function tooMany(retryAfter: number) {
  return new Response(
    JSON.stringify({ ok: false, reason: "Trop de tentatives. Réessayez dans un moment." }),
    { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) } }
  );
}
