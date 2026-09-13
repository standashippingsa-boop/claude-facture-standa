import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * PWOGRAM AFFILIATION — sekirite modpas + sesyon.
 * ═══════════════════════════════════════════════
 * Afilye yo PA Supabase Auth (yon ti "sistèm apa" jan STANDA mande l la),
 * men CLAUDE.md mande jamè estoke okenn modpas an clè — donk isit la nou
 * sèvi ak `scrypt` (entegre nan Node, san nouvo depandans npm).
 *
 * Fòma estoke: "salt_hex:hash_hex".
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = String(stored ?? "").split(":");
  if (!saltHex || !hashHex) return false;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Modpas inisyal lizib (menm règ ak generatedPassword() nan admin-auth). */
export function generateAffiliatePassword(len = 12): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  const buf = randomBytes(len);
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

/** Kòd inik pou lyen referans lan (ex: JEAN4821) — soti nan non an + o aza. */
export function generateAffiliateCode(fullname: string): string {
  const base = String(fullname ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 6) || "AFF";
  const suffix = randomBytes(2).readUInt16BE(0) % 9000 + 1000; // 4 chif
  return `${base}${suffix}`;
}

// ── Sesyon pòtay afilye a (cookie httpOnly, jamè yon jeton Supabase) ──

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/** Nou estoke SÈLMAN hash tokèn nan nan bazdone a (menm prensip ak modpas). */
export function hashToken(token: string): string {
  return scryptSync(token, "affiliate-session", 32).toString("hex");
}
