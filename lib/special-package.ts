/**
 * Détection des colis spéciaux dans les exports MCPACK.
 *
 * MCPACK peut signaler un colis par un `*`, un téléphone, un casier ou une
 * note libre. On conserve toujours le texte qui a déclenché le signal afin
 * que l'équipe STANDA puisse expliquer le marquage sans rien inventer.
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

const SPECIAL_SIGNAL = /\*|t[ée]l[ée]phone|phone|celular|iphone|android|samsung|mobile|casier|casillero|sp[ée]cial/i;
const NOTE_HEADER = /adic|observ|nota|note|detalle|d[ée]tail|casier|especial|comment|remark/i;
const MAX_REASON_LENGTH = 520;

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function shorten(value: string): string {
  return value.length <= MAX_REASON_LENGTH ? value : `${value.slice(0, MAX_REASON_LENGTH - 1).trimEnd()}…`;
}

function labelled(label: string, value: string): string {
  return label ? `${label}: ${value}` : value;
}

/**
 * Lit les cellules d'une ligne Excel et extrait l'explication visible. Les
 * colonnes de note sont privilégiées; la ligne complète ne sert que de
 * recours quand le seul indice est un `*` ailleurs sur la ligne.
 */
export function detectSpecialPackage(
  content: string | null | undefined,
  fields: Record<string, string | null | undefined> = {}
): SpecialPackageInfo {
  const entries = Object.entries(fields)
    .map(([label, value]) => [clean(label), clean(value)] as const)
    .filter(([, value]) => Boolean(value));
  const contentText = clean(content);
  const directEntries = [
    ...(contentText ? [["Contenu", contentText] as const] : []),
    ...entries.filter(([label]) => label.toLowerCase() !== "ligne excel"),
  ];
  const signalFound = [contentText, ...entries.map(([, value]) => value)].some((value) => SPECIAL_SIGNAL.test(value));
  if (!signalFound) return { isSpecial: false, reason: "" };

  // Priorité aux cellules qui portent réellement le signal; si le `*` est
  // isolé, on montre la ligne Excel complète au lieu d'une raison inventée.
  const trigger = directEntries
    .filter(([, value]) => SPECIAL_SIGNAL.test(value))
    .map(([label, value]) => labelled(label, value));
  const noteContext = entries
    .filter(([label]) => NOTE_HEADER.test(label))
    .map(([label, value]) => labelled(label, value));
  const fallback = entries
    .filter(([label]) => label.toLowerCase() === "ligne excel")
    .map(([label, value]) => labelled(label, value));
  const evidence = unique([...trigger, ...noteContext]);
  const reason = shorten(unique(evidence.length ? evidence : fallback).join(" · "));
  return { isSpecial: true, reason: reason || "Signal spécial détecté dans la ligne Excel." };
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
    return { isSpecial: true, reason: storedReason || "Signal spécial détecté dans la ligne Excel." };
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
