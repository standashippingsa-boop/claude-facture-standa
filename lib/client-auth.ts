import { normalizeMcCode } from "./utils";

/**
 * L'adresse e-mail technique est seulement utilisée par Supabase Auth. Les
 * clients se connectent toujours avec leur code MC, jamais avec cette adresse.
 */
const CLIENT_AUTH_DOMAIN = "@client.standacommercialsa.com";

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function technicalEmail(code: string): string {
  return `${code.trim().toLowerCase()}${CLIENT_AUTH_DOMAIN}`;
}

/** L'identité créée aujourd'hui : une forme unique et stable du code MC. */
export function clientAuthEmail(code: string): string {
  return technicalEmail(normalizeMcCode(code));
}

/**
 * Certaines anciennes identités ont été créées avant l'uniformisation du tiret
 * dans les codes MC. Ces variantes ne servent qu'à retrouver et réparer ces
 * comptes existants : tout nouveau compte utilise exclusivement clientAuthEmail.
 */
export function clientAuthEmailCandidates(inputCode: string): string[] {
  const canonical = normalizeMcCode(inputCode);
  const digits = canonical.replace(/^MC-?/, "").replace(/\D/g, "");
  const variants = unique([
    canonical,
    canonical.replace(/-/g, ""),
    digits ? `MC${digits}` : "",
    digits,
  ]).filter((value) => /^[A-Z0-9-]+$/.test(value));

  return unique(variants.map(technicalEmail));
}

export function isClientAuthEmailForCode(email: string | null | undefined, code: string): boolean {
  const value = String(email ?? "").trim().toLowerCase();
  return clientAuthEmailCandidates(code).includes(value);
}
