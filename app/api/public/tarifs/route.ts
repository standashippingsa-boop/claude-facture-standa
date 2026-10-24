import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";

/**
 * Tarifs PUBLICS — page « Guide et aide » (/guide-aide).
 * LISTE BLANCHE : nom de la ville + prix par livre du compte PERSONNEL, et le
 * tarif petit colis. Les prix Business / VIP et toute autre donnée restent
 * protégés (RLS) et ne sortent jamais par cette route.
 */
export async function GET(req: Request) {
  const limited = rateLimit(`public-tarifs:${clientIp(req)}`, 60, 60_000);
  if (!limited.ok) return tooMany(limited.retryAfter);
  const config = getSupabaseAdminConfig();
  if (!config) return NextResponse.json({ ok: false, reason: "Service temporairement indisponible." }, { status: 503 });
  try {
    const db = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const [villes, settings] = await Promise.all([
      db.from("villes").select("name, price_personal").eq("active", true).order("name", { ascending: true }),
      db.from("app_settings").select("key, value").in("key", ["small_parcel_min", "small_parcel_max", "small_parcel_price"])
    ]);
    if (villes.error) throw villes.error;
    const map = new Map((settings.data ?? []).map((row: { key: string; value: string }) => [row.key, Number(row.value)]));
    const small = { min: map.get("small_parcel_min") ?? 0, max: map.get("small_parcel_max") ?? 0, price: map.get("small_parcel_price") ?? 0 };
    const tarifs = (villes.data ?? [])
      .map((ville: { name: string; price_personal: number | string | null }) => ({ ville: String(ville.name ?? ""), prixLivre: Number(ville.price_personal) || 0 }))
      .filter((row) => row.ville && row.prixLivre > 0);
    return NextResponse.json({ ok: true, tarifs, petitColis: small.price > 0 && small.max > 0 ? small : null },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
  } catch {
    return NextResponse.json({ ok: false, reason: "Tarifs indisponibles." }, { status: 500 });
  }
}
