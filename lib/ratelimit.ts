/*
 * STANDA COMMERCIAL — Rate limiting (limitasyon kadans)
 * ═════════════════════════════════════════════════════
 * Pwoteje wout sansib yo kont abi: brute-force, spam enskripsyon,
 * enjeksyon koli an mas, spam imèl.
 *
 * ⚠️ LIMIT ONÈT: konte a nan memwa chak instance sèvè. Sou Vercel
 * (serverless), plizyè instance ka egziste — donk limit efektif la ka
 * pi laj pase chif la. Li BLOKE atak senp/otomatik yo, li PA yon
 * ranplasman pou yon sèvis dedye (Upstash Redis) si w bezwen garanti dur.
 * Li pa janm bloke yon itilizatè nòmal.
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

/**
 * Tcheke si yon aksyon otorize.
 * @param key     idantifyan (ex: "register:1.2.3.4")
 * @param limit   kantite maksimòm nan fenèt la
 * @param windowMs longè fenèt la an milisgond
 */
export function rateLimit(key: string, limit: number, windowMs: number):
  { ok: true } | { ok: false; retryAfter: number } {
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

/** Repons estanda 429 (mesaj moun ka konprann, zewo detay teknik). */
export function tooMany(retryAfter: number) {
  return new Response(
    JSON.stringify({ ok: false, reason: "Trop de tentatives. Réessayez dans un moment." }),
    { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) } }
  );
}
