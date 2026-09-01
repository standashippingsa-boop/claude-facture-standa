import "server-only";

/**
 * Variables Supabase lues uniquement côté serveur.
 *
 * Les nouvelles clés Supabase (sb_publishable / sb_secret) sont privilégiées.
 * Les anciens noms restent un filet de compatibilité pendant la migration : ils
 * peuvent être retirés seulement après la mise à jour de tous les déploiements.
 */
function firstValue(...values: Array<string | undefined>): string {
  return values.map((value) => value?.trim() ?? "").find(Boolean) ?? "";
}

export function getSupabaseUrl(): string {
  return firstValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function getSupabasePublishableKey(): string {
  return firstValue(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabaseSecretKey(): string {
  return firstValue(
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function getSupabaseAdminConfig(): { url: string; key: string } | null {
  const url = getSupabaseUrl();
  const key = getSupabaseSecretKey();
  return url && key ? { url, key } : null;
}
