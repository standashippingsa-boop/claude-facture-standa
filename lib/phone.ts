/**
 * NUMÉROS DE TÉLÉPHONE · Haïti, États-Unis, République dominicaine
 * ═══════════════════════════════════════════════════════════════
 * Une seule règle pour tout le système (inscription, fiches, liens WhatsApp) :
 *   • le client choisit le pays, l'indicatif (+509 / +1) est ajouté pour lui ;
 *   • espaces, tirets, points, parenthèses sont retirés automatiquement ;
 *   • si le client tape lui même l'indicatif (+509, 00509, 1…), il est retiré ;
 *   • le nombre de chiffres est contrôlé : jamais plus, jamais moins ;
 *   • le numéro est enregistré au format international (+50937123456),
 *     que WhatsApp accepte toujours.
 * Aucun import serveur : utilisable partout (pages publiques comprises).
 */
export type PhoneCountryId = "HT" | "US" | "DO";
export type PhoneCountry = {
  id: PhoneCountryId; name: string; /** Nom court affiché dans la liste. */ short: string; dial: string; length: number;
  example: string; /** Indicatifs régionaux acceptés (République dominicaine). */ areas?: string[];
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { id: "HT", name: "Haïti", short: "HT", dial: "509", length: 8, example: "3712 3456" },
  { id: "US", name: "États-Unis", short: "USA", dial: "1", length: 10, example: "305 555 1234" },
  { id: "DO", name: "République dominicaine", short: "RD", dial: "1", length: 10, example: "809 555 1234", areas: ["809", "829", "849"] },
];
export const DEFAULT_PHONE_COUNTRY: PhoneCountryId = "HT";
export const phoneCountry = (id: PhoneCountryId | string | null | undefined) =>
  PHONE_COUNTRIES.find((c) => c.id === id) ?? PHONE_COUNTRIES[0];

/**
 * Chiffres du numéro local à partir de ce que la personne a tapé :
 * garde les chiffres, retire « 00 » et l'indicatif du pays s'il a été tapé,
 * puis coupe à la longueur du pays (on ne peut pas dépasser).
 */
export function cleanLocalPhone(countryId: PhoneCountryId | string, raw: string): string {
  const c = phoneCountry(countryId);
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  // Indicatif tapé chiffre par chiffre (509… ou 1…) : on le laisse finir, puis on le retire.
  if (d.startsWith(c.dial) && (d.length > c.length || c.dial === "1")) {
    d = d.slice(0, c.dial.length + c.length);
    if (d.length === c.dial.length + c.length) d = d.slice(c.dial.length);
    return d;
  }
  return d.slice(0, c.length);
}

/**
 * Pays reconnu quand la personne tape ou colle un numéro AVEC son indicatif
 * (+509…, 00509…, +1 809…, 1305…). null si rien ne permet de le savoir.
 */
export function detectPhoneCountry(raw: string): PhoneCountryId | null {
  const text = String(raw ?? "").trim();
  let d = text.replace(/\D/g, "");
  const explicit = text.startsWith("+") || d.startsWith("00");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("509") && (explicit || d.length === 11)) return "HT";
  if (d.startsWith("1") && (explicit || d.length === 11)) {
    return ["809", "829", "849"].includes(d.slice(1, 4)) ? "DO" : "US";
  }
  return null;
}

/** Message d'erreur, ou null si le numéro local est valide pour ce pays. */
export function phoneError(countryId: PhoneCountryId | string, local: string): string | null {
  const c = phoneCountry(countryId);
  const d = String(local ?? "").replace(/\D/g, "");
  if (!d) return "Le numéro est obligatoire.";
  if (d.length !== c.length) return `Un numéro ${c.name === "Haïti" ? "d'Haïti" : c.id === "US" ? "des États-Unis" : "de République dominicaine"} a ${c.length} chiffres (ex. ${c.example}). Vous en avez ${d.length}.`;
  if (c.id === "HT" && !/^[2-5]/.test(d)) return "Un numéro d'Haïti commence par 2, 3, 4 ou 5.";
  if (c.areas && !c.areas.includes(d.slice(0, 3))) return `Un numéro de République dominicaine commence par ${c.areas.join(", ")}.`;
  if (c.id === "US" && !/^[2-9]\d{2}[2-9]/.test(d)) return "Ce numéro des États-Unis n'est pas valide.";
  return null;
}

/** Format international enregistré en base : +50937123456 / +13055551234. */
export const toE164 = (countryId: PhoneCountryId | string, local: string) =>
  "+" + phoneCountry(countryId).dial + String(local ?? "").replace(/\D/g, "");

/** Affichage lisible : +509 3712 3456 / +1 305 555 1234. */
export function formatPhone(countryId: PhoneCountryId | string, local: string): string {
  const c = phoneCountry(countryId);
  const d = String(local ?? "").replace(/\D/g, "");
  if (c.id === "HT") return [d.slice(0, 4), d.slice(4)].filter(Boolean).join(" ");
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(" ");
}

/**
 * Numéro pour un lien WhatsApp (wa.me) à partir de n'importe quel numéro
 * enregistré, même ancien ou mal écrit : chiffres seulement, avec l'indicatif.
 *   8 chiffres  → Haïti (509…)      10 chiffres → États-Unis ou Rép. dominicaine (1…)
 */
export function whatsappDigits(raw: string | null | undefined): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8) return "509" + d;
  if (d.length === 10 && /^[2-9]/.test(d)) return "1" + d;
  return d;
}

/**
 * Numéro complet et valide au format international (+50937123456,
 * +13055551234, +18095551234), ou null s'il n'est pas valide.
 * Accepte aussi un numéro local (8 chiffres = Haïti, 10 chiffres = +1).
 * Utilisé par le serveur : un mauvais numéro n'est jamais enregistré.
 */
export function normalizeIntlPhone(raw: string | null | undefined): string | null {
  const d = whatsappDigits(raw);
  if (d.startsWith("509") && d.length === 11) return phoneError("HT", d.slice(3)) ? null : "+" + d;
  if (d.startsWith("1") && d.length === 11) {
    const local = d.slice(1);
    const country: PhoneCountryId = ["809", "829", "849"].includes(local.slice(0, 3)) ? "DO" : "US";
    return phoneError(country, local) ? null : "+" + d;
  }
  return null;
}
