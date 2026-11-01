import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "./supabase-server";
import { SITE_IMAGE_BUCKET, SITE_IMAGE_PREFIX, SITE_IMAGE_SLOTS, defaultSiteImages, settingKey, type SiteImages } from "./site-image-slots";

/**
 * Images du site public choisies par l'administration.
 * Lecture serveur seulement, colonnes « key, value » des seules clés site_image_*.
 * Une adresse est acceptée uniquement si elle pointe vers notre stockage public
 * (dossier site/) ; sinon l'image d'origine est utilisée.
 */
export async function getSiteImages(): Promise<SiteImages> {
  const images = defaultSiteImages();
  const config = getSupabaseAdminConfig();
  if (!config) return images;
  try {
    const db = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await db.from("app_settings").select("key, value").in("key", SITE_IMAGE_SLOTS.map((s) => settingKey(s.key)));
    const allowed = `${config.url}/storage/v1/object/public/${SITE_IMAGE_BUCKET}/${SITE_IMAGE_PREFIX}`;
    for (const row of (data ?? []) as { key: string; value: string }[]) {
      const slot = SITE_IMAGE_SLOTS.find((s) => settingKey(s.key) === row.key);
      const url = String(row.value ?? "").trim();
      if (slot && url.startsWith(allowed)) images[slot.key] = url;
    }
  } catch { /* images d'origine */ }
  return images;
}
