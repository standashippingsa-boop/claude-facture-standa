/*
 * STANDA COMMERCIAL — Mesaj erè san fuit
 * ══════════════════════════════════════
 * Bò KLIYAN, yon mesaj erè pa dwe janm revele enfrastrikti a:
 * non tab, erè Postgres/Supabase, chemen sèvè, non varyab, stack trace.
 *
 * NÒT CTO: bò STAFF (admin/employé) nou kite mesaj teknik la, paske li
 * itil pou dyagnostik epi se moun konfyans ki wè l.
 *
 * ⚠️ KORÈKSYON — POUKISA KLIYAN YO T AP WÈ "yon pwoblèm teknik"
 * ─────────────────────────────────────────────────────────────
 * Filtè a te jete TOUT mesaj ki depase 160 karaktè. Men mesaj NOU MENM
 * ekri sou sèvè a ("Cette adresse e-mail est déjà utilisée… utilisez une
 * autre adresse e-mail") fè plis pase 160 karaktè — donk pwòp esplikasyon
 * nou an te jete epi kliyan an te wè "Yon pwoblèm teknik rive".
 *
 * Solisyon: yon erè nou make `UserError` se yon mesaj NOU EKRI pou moun
 * nan li. Li pase san chanjman, kèlkeswa longè l. Erè ki soti nan
 * bazdone a oswa nan yon bibliyotèk kontinye pase nan filtè a.
 */

/** Non nou bay yon erè ki gen yon mesaj ekri POU KLIYAN AN. */
export const USER_ERROR = "StandaUserError";

/** Kreye yon erè ak yon mesaj kliyan an ka wè jan li ye. */
export function userError(message: string): Error {
  const e = new Error(message);
  e.name = USER_ERROR;
  return e;
}

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

const GENERIC = "Yon pwoblèm teknik rive. Tanpri eseye ankò.";

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
  // Mesaj NOU EKRI pou kliyan an: li pase entak, kèlkeswa longè l.
  if ((e as any)?.name === USER_ERROR) return raw;
  // Mesaj nou ekri tèt nou: nou kite yo (yo klè epi san detay entèn)
  if (SAFE_HINTS.some((h) => raw.toLowerCase().includes(h.toLowerCase()))) return raw;
  // Mesaj ki gen siy enfrastrikti: nou ranplase yo
  if (LEAKY.some((re) => re.test(raw))) return fallback;
  // Mesaj long/teknik: pi bon jenerik
  if (raw.length > 160) return fallback;
  return raw;
}
