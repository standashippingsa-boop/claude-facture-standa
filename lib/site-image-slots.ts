/** Emplacements d'images du site public, modifiables dans Paramètres. */
export const SITE_IMAGE_SLOTS = [
  { key: "hero", label: "Accueil, grande image", fallback: "/site/hero-agent-v2.webp" },
  { key: "inscription", label: "Carte Inscription", fallback: "/site/account-v2.webp" },
  { key: "suivi", label: "Carte Suivi", fallback: "/site/suivi-smartphone.webp" },
  { key: "agences", label: "Carte Agences et page Nos agences", fallback: "/site/agence-remise-v2.webp" },
  { key: "depot", label: "Dépôt de Miami", fallback: "/site/warehouse.webp" },
  { key: "final", label: "Bandeau du bas", fallback: "/site/shopping.webp" },
] as const;

export type SiteImageKey = (typeof SITE_IMAGE_SLOTS)[number]["key"];
export type SiteImages = Record<SiteImageKey, string>;

export const SITE_IMAGE_BUCKET = "announcements";
export const SITE_IMAGE_PREFIX = "site/";
export const settingKey = (slot: string) => `site_image_${slot}`;
export const isSlot = (slot: string): slot is SiteImageKey => SITE_IMAGE_SLOTS.some((s) => s.key === slot);

export function defaultSiteImages(): SiteImages {
  return Object.fromEntries(SITE_IMAGE_SLOTS.map((s) => [s.key, s.fallback])) as SiteImages;
}
