/*
 * STANDA COMMERCIAL — Mesaj erè san fuit
 * ══════════════════════════════════════
 * Bò KLIYAN, yon mesaj erè pa dwe janm revele enfrastrikti a:
 * non tab, erè Postgres/Supabase, chemen sèvè, non varyab, stack trace.
 *
 * NÒT CTO: bò STAFF (admin/employé) nou kite mesaj teknik la, paske li
 * itil pou dyagnostik epi se moun konfyans ki wè l.
 */

/** Motif ki revele enfrastrikti — si youn matche, nou bay mesaj jenerik. */
const LEAKY = [
  /supabase/i, /postgres/i, /pg_/i, /sql/i, /relation .* does not exist/i,
  /column .* does not exist/i, /duplicate key/i, /violates .* constraint/i,
  /jwt/i, /service.?role/i, /schema/i, /\bfrom .*table\b/i,
  /vercel/i, /localhost/i, /127\.0\.0\.1/, /https?:\/\//i,
  /at .*\(.*:\d+:\d+\)/,            // stack trace
  /\/(var|usr|home|app)\//,         // chemen sèvè
];

/** Mesaj klè nou ekri tèt nou — nou kite yo pase. */
const SAFE_HINTS = [
  "Trop de tentatives", "Session requise", "Session invalide", "Email invalide",
  "Nom invalide", "Téléphone invalide", "Un compte existe déjà",
  "déjà facturé", "introuvable", "Aucun colis", "mot de passe",
];

const GENERIC = "Un problème technique est survenu. Veuillez réessayer.";

/**
 * Retounen yon mesaj ki bon pou montre yon KLIYAN.
 * @param e        erè a (nenpòt fòm)
 * @param fallback mesaj pa default si erè a pa rekonèt
 */
export function safeMessage(e: unknown, fallback = GENERIC): string {
  const raw = String(
    (e as any)?.message ?? (typeof e === "string" ? e : "")
  ).trim();
  if (!raw) return fallback;
  // Mesaj nou ekri tèt nou: nou kite yo (yo klè epi san detay entèn)
  if (SAFE_HINTS.some((h) => raw.toLowerCase().includes(h.toLowerCase()))) return raw;
  // Mesaj ki gen siy enfrastrikti: nou ranplase yo
  if (LEAKY.some((re) => re.test(raw))) return fallback;
  // Mesaj long/teknik: pi bon jenerik
  if (raw.length > 160) return fallback;
  return raw;
}
