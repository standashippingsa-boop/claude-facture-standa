/**
 * MARQUE DE LA FACTURE : STANDA ou DOKASAV.
 * ═════════════════════════════════════════
 * Dokasav Sèvis ak Boutik (partenaire, propriétaire du compte Dokasav) utilise
 * le système STANDA pour facturer ses propres clients. Ses clients sont listés
 * dans Paramètres → MCPACK & Ergens → « Codes des clients Dokasav » (Blic Express,
 * client de Dokasav, reçoit aussi le modèle Dokasav)
 * (app_settings.mcpack_ergens_codes.dokasav). Ces mêmes codes comptent pour
 * Dokasav dans le calcul « À payer à MCPACK ».
 *
 * Une facture dont le code client est dans cette liste sort avec le modèle
 * Dokasav (logo, nom et coordonnées de Dokasav) au lieu du modèle STANDA.
 * Coordonnées Dokasav : app_settings.dokasav_brand (JSON), modifiables dans
 * Paramètres. Champ vide = ligne non imprimée (rien n'est inventé).
 */
export const DOKASAV_BRAND_KEY = "dokasav_brand";
export const DOKASAV_NAME = "DOKASAV SÈVIS AK BOUTIK";
export const DOKASAV_LOGO = "/brands/dokasav-logo.png";

export type DokasavBrand = { phone: string; email: string; address: string; footer: string; advice: string };
export const EMPTY_DOKASAV_BRAND: DokasavBrand = { phone: "", email: "", address: "", footer: "", advice: "" };

/** Conseils imprimés sur les factures Dokasav (sans les moyens de paiement STANDA). */
export const DEFAULT_DOKASAV_ADVICE: string[] = [
  "Pote kòd kliyan MC ou ak yon pyès idantite lè w ap vin chèche koli w.",
  "Fò w peye fakti a nèt anvan ou pran koli w yo.",
  "Mande yon resi pou chak peman epi kenbe l.",
  "Si w ap peye an goud, to a ka diferan de sa ki sou fakti a. Y ap di w montan an goud la lè w ap peye.",
  "Tcheke koli w yo anvan w ale. Si gen yon pwoblèm, di l sou plas.",
  "Si se yon lòt moun k ap vin chèche koli w, avèti nou davans.",
];
export function dokasavAdvice(brand: DokasavBrand): string[] {
  const list = String(brand.advice ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 20);
  return list.length ? list : DEFAULT_DOKASAV_ADVICE;
}

export function parseDokasavBrand(raw: unknown): DokasavBrand {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw || "{}") : (raw ?? {});
    const s = (x: unknown, max: number) => String(x ?? "").trim().slice(0, max);
    return { phone: s(v.phone, 60), email: s(v.email, 120), address: s(v.address, 200), footer: s(v.footer, 600), advice: s(v.advice, 4000) };
  } catch { return { ...EMPTY_DOKASAV_BRAND }; }
}

const norm = (value: unknown) => {
  const clean = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!clean) return "";
  return clean.startsWith("MC-") ? clean : "MC-" + clean.replace(/^MC/, "").replace(/^-+/, "");
};

/**
 * Codes facturés au modèle Dokasav, lus depuis mcpack_ergens_codes :
 * les clients Dokasav ET Blic Express (Blic est un client de Dokasav).
 */
export function dokasavCodesFrom(raw: unknown): Set<string> {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw || "{}") : (raw ?? {});
    const list = [...(Array.isArray(v.dokasav) ? v.dokasav : []), ...(Array.isArray(v.blic) ? v.blic : [])];
    return new Set(list.map(norm).filter(Boolean));
  } catch { return new Set(); }
}

/** Blic Express reconnu par son nom quand son code n est pas encore saisi. */
const BLIC_NAME = /blic\s*express/i;

export const isDokasavCode = (codes: Set<string>, customerCode: unknown, customerName?: unknown) => {
  const c = norm(customerCode);
  if (c && codes.has(c)) return true;
  return BLIC_NAME.test(String(customerName ?? ""));
};
