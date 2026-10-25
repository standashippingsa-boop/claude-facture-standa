/*
 * Documents internes (pièces d'identité du personnel, modèle de contrat
 * affilié) : le compartiment « staff-docs » est PRIVÉ. Les anciennes adresses
 * publiques enregistrées en base restent valables comme identifiants : on en
 * extrait le chemin du fichier, puis le serveur fabrique un lien temporaire.
 */
export const STAFF_DOCS_BUCKET = "staff-docs";

/** Chemin du fichier à partir d'une ancienne adresse publique ou signée. */
export function staffDocPath(url: string): string | null {
  const m = String(url ?? "").match(/\/storage\/v1\/object\/(?:public|sign)\/staff-docs\/([^?#]+)/);
  if (!m) return null;
  const path = decodeURIComponent(m[1]);
  // Jamais de remontée de dossier.
  if (!path || path.includes("..") || path.startsWith("/")) return null;
  return path;
}

type StorageClient = {
  storage: { from: (bucket: string) => { createSignedUrl: (path: string, seconds: number) => Promise<{ data: { signedUrl: string } | null; error: unknown }> } };
};

/** Lien temporaire (par défaut 5 minutes) ; renvoie l'adresse d'origine si elle n'est pas dans staff-docs. */
export async function signedStaffDocUrl(svc: StorageClient, url: string, seconds = 300): Promise<string | null> {
  const path = staffDocPath(url);
  if (!path) return url || null;
  const { data, error } = await svc.storage.from(STAFF_DOCS_BUCKET).createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
