import { supabase } from "./supabase";

/**
 * Réglages du suivi « À payer à MCPACK » — stockés dans app_settings
 * (lecture : personnel connecté ; écriture : administrateur, RLS).
 *
 *  mcpack_rate_usd            tarif MCPACK par livre (défaut 3)
 *  mcpack_ergens_codes        {"dokasav":["MC-…"],"blic":["MC-…"]} — vide = reconnaissance par le nom
 *  mcpack_period_start         début du lot suivi (date AAAA-MM-JJ de la Conduce). Le lot reste OUVERT :
 *                             toute Conduce non payée depuis ce jour est comptée, même ajoutée plus tard.
 *  mcpack_period_end           (ancien réglage, ignoré)
 *  mcpack_ergens_paid:<clé>   part Ergens reçue pour une période : {"amount":…, "at":…, "by":…}
 */
export const MCPACK_DEFAULT_RATE = 3;
export const MCPACK_DEFAULT_START = "2026-10-10";
/** Fin ouverte : aucune Conduce récente n'est laissée de côté. */
export const OPEN_END = "9999-12-31";

export type ErgensKey = "dokasav" | "blic";
export type ErgensCodes = Record<ErgensKey, string[]>;
export type ErgensReceipt = { amount: number; at: string; by: string };
export type McpackSettings = {
  rate: number;
  codes: ErgensCodes;
  period: { start: string; end: string };
  receipts: Record<string, ErgensReceipt>;
};

const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
export const normalizeCode = (value: string) => {
  const clean = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!clean) return "";
  return clean.startsWith("MC-") ? clean : "MC-" + clean.replace(/^MC/, "").replace(/^-+/, "");
};
export const parseCodeList = (text: string) => Array.from(new Set(text.split(/[\s,;]+/).map(normalizeCode).filter((code) => /^MC-\d{3,}$/.test(code))));
export const periodKey = (period: { start: string; end: string }) => period.start;

export async function loadMcpackSettings(): Promise<McpackSettings> {
  // Table de réglages courte : on lit tout et on filtre ici (pas de filtre PostgREST fragile).
  const { data, error } = await supabase.from("app_settings").select("key, value");
  if (error) throw error;
  const map = new Map<string, string>((data ?? []).map((row: { key: string; value: string }) => [row.key, String(row.value ?? "")]));
  const rate = Number(map.get("mcpack_rate_usd"));
  let codes: ErgensCodes = { dokasav: [], blic: [] };
  try {
    const parsed = JSON.parse(map.get("mcpack_ergens_codes") || "{}");
    codes = { dokasav: Array.isArray(parsed.dokasav) ? parsed.dokasav.map(normalizeCode).filter(Boolean) : [], blic: Array.isArray(parsed.blic) ? parsed.blic.map(normalizeCode).filter(Boolean) : [] };
  } catch { /* réglage absent ou illisible : reconnaissance par le nom */ }
  const start = map.get("mcpack_period_start") ?? "";
  const receipts: Record<string, ErgensReceipt> = {};
  map.forEach((value, key) => {
    if (!key.startsWith("mcpack_ergens_paid:")) return;
    try { const parsed = JSON.parse(value); if (parsed && typeof parsed === "object") receipts[key.slice("mcpack_ergens_paid:".length)] = { amount: Number(parsed.amount) || 0, at: String(parsed.at ?? ""), by: String(parsed.by ?? "") }; } catch { /* ignore */ }
  });
  return {
    rate: Number.isFinite(rate) && rate > 0 ? rate : MCPACK_DEFAULT_RATE,
    codes,
    period: { start: isDay(start) ? start : MCPACK_DEFAULT_START, end: OPEN_END },
    receipts
  };
}

async function writeSetting(key: string, value: string) {
  const { error } = await supabase.from("app_settings").upsert({ key, value });
  if (error) throw new Error(error.message);
}

export async function saveMcpackPeriod(start: string) {
  if (!isDay(start)) throw new Error("Date de début invalide.");
  await writeSetting("mcpack_period_start", start);
}

export async function saveMcpackConfig(rate: number, codes: ErgensCodes) {
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100) throw new Error("Tarif invalide.");
  await writeSetting("mcpack_rate_usd", String(rate));
  await writeSetting("mcpack_ergens_codes", JSON.stringify(codes));
}

export async function setErgensReceipt(key: string, receipt: ErgensReceipt | null) {
  if (receipt) { await writeSetting("mcpack_ergens_paid:" + key, JSON.stringify(receipt)); return; }
  const { error } = await supabase.from("app_settings").delete().eq("key", "mcpack_ergens_paid:" + key);
  if (error) throw new Error(error.message);
}
