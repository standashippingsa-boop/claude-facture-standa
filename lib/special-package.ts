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
/** Nòt ki te detekte nan fichye Excel la. Li rete konsève menm apre admin an
 * ajoute pwòp kategori oswa nòt pa li. */
export const SPECIAL_PACKAGE_IMPORTED_REASON = "__standa_special_imported_reason";
/** Catégorie choisie manuellement par l'équipe STANDA. */
export const SPECIAL_PACKAGE_KIND = "__standa_special_kind";
/** Distingue une note importée MCPACK d'un marquage manuel. */
export const SPECIAL_PACKAGE_SOURCE = "__standa_special_source";

export const MANUAL_SPECIAL_PACKAGE_KINDS = [
  "Téléphone", "Laptop", "Tablette", "Caméra", "Autre"
] as const;
export type ManualSpecialPackageKind = typeof MANUAL_SPECIAL_PACKAGE_KINDS[number];

export type SpecialPackageInfo = {
  isSpecial: boolean;
  /** Texte exact (ou extrait exact) provenant de la ligne Excel. */
  reason: string;
  /** Note originale détectée dans la colonne ADIC. / ADICIONALES, s'il y en a une. */
  importedReason: string;
  /** Catégorie manuelle, lorsqu'elle a été choisie par l'équipe. */
  kind: string;
  /** Origine de l'indicateur, utile pour préserver un marquage manuel. */
  source: "manual" | "mcpack" | "legacy" | "";
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
  return reason
    ? { isSpecial: true, reason, importedReason: reason, kind: "", source: "mcpack" }
    : { isSpecial: false, reason: "", importedReason: "", kind: "", source: "" };
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
    [SPECIAL_PACKAGE_IMPORTED_REASON]: info.reason,
    [SPECIAL_PACKAGE_SOURCE]: "mcpack",
  };
}

/**
 * Ajoute un marquage manuel sans effacer les données importées de MCPACK.
 * La catégorie est obligatoire; pour « Autre », l'explication est obligatoire.
 */
export function withManualSpecialPackageMetadata(
  fields: Record<string, string> = {},
  kind: ManualSpecialPackageKind,
  note: string
): Record<string, string> {
  const cleanKind = MANUAL_SPECIAL_PACKAGE_KINDS.includes(kind) ? kind : "Autre";
  const cleanNote = clean(note);
  if (cleanKind === "Autre" && !cleanNote) {
    throw new Error("Précisez pourquoi ce colis est spécial.");
  }
  const reason = shorten([cleanKind, cleanNote].filter(Boolean).join(" — "));
  // Si MCPACK a signalé ce colis dans ADIC., sa note est une preuve métier :
  // une modification manuelle ne doit jamais la faire disparaître.
  const previousReason = clean(fields[SPECIAL_PACKAGE_REASON]);
  const previousSource = clean(fields[SPECIAL_PACKAGE_SOURCE]);
  const detectedFromOriginalFields = detectSpecialPackage(undefined, fields).reason;
  const importedReason = clean(fields[SPECIAL_PACKAGE_IMPORTED_REASON])
    || detectedFromOriginalFields
    || (previousSource !== "manual" ? previousReason : "");
  return {
    ...fields,
    [SPECIAL_PACKAGE_FLAG]: "true",
    [SPECIAL_PACKAGE_KIND]: cleanKind,
    [SPECIAL_PACKAGE_REASON]: reason,
    ...(importedReason ? { [SPECIAL_PACKAGE_IMPORTED_REASON]: importedReason } : {}),
    [SPECIAL_PACKAGE_SOURCE]: "manual",
  };
}

/**
 * Reconnaît aussi les anciens imports qui possèdent seulement le préfixe
 * `* COLIS SPÉCIAL`. Ainsi, les anciens colis restent filtrables et lisibles.
 */
export function specialPackageInfo(pkg: PackageLike): SpecialPackageInfo {
  const data = pkg.mcpack_data ?? {};
  const storedReason = clean(data[SPECIAL_PACKAGE_REASON]);
  const storedImportedReason = clean(data[SPECIAL_PACKAGE_IMPORTED_REASON]);
  const storedKind = clean(data[SPECIAL_PACKAGE_KIND]);
  const storedSource = clean(data[SPECIAL_PACKAGE_SOURCE]);
  // Les anciennes modifications manuelles ont gardé les cellules Excel dans
  // mcpack_data. On les relit pour ne pas perdre l'explication d'origine.
  const detectedFromOriginalFields = detectSpecialPackage(pkg.content, data).reason;
  if (data[SPECIAL_PACKAGE_FLAG] === "true") {
    return {
      isSpecial: true,
      reason: storedReason || "Note ADIC. signalée dans la ligne Excel.",
      importedReason: storedImportedReason || detectedFromOriginalFields || (storedSource === "manual" ? "" : storedReason),
      kind: storedKind,
      source: storedSource === "manual" ? "manual" : "mcpack",
    };
  }

  const content = clean(pkg.content);
  if (/^\*\s*COLIS\s+SP[ÉE]CIAL/i.test(content)) {
    const legacyReason = clean(content.replace(/^\*\s*COLIS\s+SP[ÉE]CIAL\s*[·:–-]?\s*/i, ""));
    return {
      isSpecial: true,
      reason: legacyReason || "Ligne signalée comme colis spécial dans l'export Excel.",
      importedReason: legacyReason || "Ligne signalée comme colis spécial dans l'export Excel.",
      kind: "",
      source: "legacy",
    };
  }

  return detectSpecialPackage(content, data);
}
