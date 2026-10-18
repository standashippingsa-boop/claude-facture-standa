import { supabase } from "./supabase";

/** Annonce publiée par l'administration pour tous les clients (voir /api/announcements). */
export type Announcement = {
  id: string; title: string; body: string; image_path: string | null;
  active: boolean; created_by: string; created_at: string;
};

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");

/** URL publique du flyer (bucket public « announcements »). */
export function announcementImageUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/announcements/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Annonces visibles pour le client connecté, la plus récente d'abord. */
export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase.from("announcements").select("*")
    .eq("active", true).order("created_at", { ascending: false }).limit(10);
  if (error) return [];
  return (data ?? []) as Announcement[];
}
