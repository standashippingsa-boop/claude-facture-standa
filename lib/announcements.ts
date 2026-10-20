import { supabase } from "./supabase";

export type AnnouncementMedia = { path: string; kind: "image" | "video" };
export type AudienceType = "all" | "villes" | "account_types" | "clients";

/** Annonce publiée par l'administration (voir /api/announcements). */
export type Announcement = {
  id: string; title: string; body: string; image_path: string | null;
  media?: AnnouncementMedia[] | null;
  audience_type?: AudienceType; audience_values?: string[];
  active: boolean; created_by: string; created_at: string;
};

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");

/** URL publique d'un fichier (bucket public « announcements »). */
export function announcementImageUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/announcements/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Photos et vidéos d'une annonce (les anciennes annonces n'ont qu'une image). */
export function announcementMedia(item: Announcement): AnnouncementMedia[] {
  const list = Array.isArray(item.media) ? item.media.filter((media) => media && media.path) : [];
  if (list.length) return list;
  return item.image_path ? [{ path: item.image_path, kind: "image" }] : [];
}

/**
 * Annonces visibles pour le client connecté, la plus récente d'abord.
 * Le filtrage par public (ville, type de compte, clients) est fait par la base (RLS).
 */
export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase.from("announcements").select("*")
    .eq("active", true).order("created_at", { ascending: false }).limit(10);
  if (error) return [];
  return (data ?? []) as Announcement[];
}
