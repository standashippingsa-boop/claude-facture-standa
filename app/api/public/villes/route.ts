import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { pickupLocationForCity } from "@/lib/pickup-location";

/**
 * Liste publique minimale des villes réellement desservies pour le formulaire
 * d'inscription. Une ville est proposée seulement lorsqu'un point de retrait
 * actif lui correspond : un nouveau client ne peut donc jamais se retrouver
 * avec un lieu de récupération vide ou dans une autre ville.
 *
 * Les tarifs, les villes inactives et les données d'administration restent
 * protégés par RLS. Cette route ne renvoie que l'identifiant et le nom dont
 * l'utilisateur a besoin pour choisir son agence lors de l'inscription.
 */
export async function GET(req: Request) {
  const limited = rateLimit(`public-villes:${clientIp(req)}`, 60, 60_000);
  if (!limited.ok) return tooMany(limited.retryAfter);

  const config = getSupabaseAdminConfig();
  if (!config) {
    return NextResponse.json(
      { ok: false, reason: "Service temporairement indisponible." },
      { status: 503 }
    );
  }

  try {
    const service = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const [villesResult, agenciesResult] = await Promise.all([
      service.from("villes").select("id,name").eq("active", true).order("name", { ascending: true }),
      service.from("agences").select("nom,ordre").eq("active", true).order("ordre", { ascending: true })
    ]);
    if (villesResult.error || agenciesResult.error) throw villesResult.error ?? agenciesResult.error;

    const agencies = (agenciesResult.data ?? []).filter((agency) => typeof agency.nom === "string");
    const villes = (villesResult.data ?? []).flatMap((ville) => {
      if (typeof ville.id !== "string" || typeof ville.name !== "string") return [];
      const pickup = pickupLocationForCity(ville.name, agencies);
      return pickup ? [{ id: ville.id, name: ville.name, pickup_location: pickup.nom.trim() }] : [];
    });

    return NextResponse.json({
      ok: true,
      villes
    });
  } catch {
    return NextResponse.json(
      { ok: false, reason: "Service temporairement indisponible." },
      { status: 503 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
