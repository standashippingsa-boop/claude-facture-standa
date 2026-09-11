/**
 * Détection des colis spéciaux dans les exports MCPACK.
 *
 * Dans les Conduces MCPACK, la consigne métier est précise : seul le petit
 * texte de la colonne ADIC. / ADICIONALES désigne un colis spécial. On le
 * conserve tel quel pour que l'équipe STANDA puisse l'expliquer sans rien
 * inventer ni déduire depuis le contenu du colis.
 */
export const SPECIAL_PACKAGE_FLAG = "__standa_special";
export const SPECIAL_PACKAGE_REASON = "__standa_special_reason";

export type SpecialPackageInfo = {
  isSpecial: boolean;
  /** Texte exact (ou extrait exact) provenant de la ligne Excel. */
  reason: string;
};

type PackageLike = {
  content?: string | null;
  mcpack_data?: Record<string, string> | null;
};

const MAX_REASON_LENGTH = 520;
const ADDITIONAL_HEADER = /^adic(?:\.|\b)|^adicional(?:es)?\b/i;
const EMPTY_ADDITIONAL_NOTE = /^(?:[-–—_.\s]+|n\s*\/?\s*a|none|ninguno|sin\s+nota)$/i;

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function shorten(value: string): string {
  return value.length <= MAX_REASON_LENGTH ? value : `${value.slice(0, MAX_REASON_LENGTH - 1).trimEnd()}…`;
}

/**
 * Lit seulement les cellules ADIC. / ADICIONALES. Un tiret (`--`) n'est pas
 * une note et ne transforme jamais un colis normal en colis spécial.
 */
export function detectSpecialPackage(
  _content: string | null | undefined,
  fields: Record<string, string | null | undefined> = {}
): SpecialPackageInfo {
  const entries = Object.entries(fields)
    .map(([label, value]) => [clean(label), clean(value)] as const)
    .filter(([label, value]) => ADDITIONAL_HEADER.test(label) && Boolean(value) && !EMPTY_ADDITIONAL_NOTE.test(value));
  const reason = shorten(unique(entries.map(([, value]) => value)).join(" · "));
  return reason ? { isSpecial: true, reason } : { isSpecial: false, reason: "" };
}

/** Rend les métadonnées Excel prêtes à être enregistrées dans `mcpack_data`. */
export function withSpecialPackageMetadata(
  content: string | null | undefined,
  fields: Record<string, string> = {}
): Record<string, string> {
  const info = detectSpecialPackage(content, fields);
  if (!info.isSpecial) return fields;
  return {
    ...fields,
    [SPECIAL_PACKAGE_FLAG]: "true",
    [SPECIAL_PACKAGE_REASON]: info.reason,
  };
}

/**
 * Reconnaît aussi les anciens imports qui possèdent seulement le préfixe
 * `* COLIS SPÉCIAL`. Ainsi, les anciens colis restent filtrables et lisibles.
 */
export function specialPackageInfo(pkg: PackageLike): SpecialPackageInfo {
  const data = pkg.mcpack_data ?? {};
  const storedReason = clean(data[SPECIAL_PACKAGE_REASON]);
  if (data[SPECIAL_PACKAGE_FLAG] === "true") {
    return { isSpecial: true, reason: storedReason || "Note ADIC. signalée dans la ligne Excel." };
  }

  const content = clean(pkg.content);
  if (/^\*\s*COLIS\s+SP[ÉE]CIAL/i.test(content)) {
    const legacyReason = clean(content.replace(/^\*\s*COLIS\s+SP[ÉE]CIAL\s*[·:–-]?\s*/i, ""));
    return {
      isSpecial: true,
      reason: legacyReason || "Ligne signalée comme colis spécial dans l'export Excel.",
    };
  }

  return detectSpecialPackage(content, data);
}
