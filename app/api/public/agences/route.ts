import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";

/**
 * Liste publique minimale des villes où une agence est actuellement active.
 * Aucune adresse, aucun tarif ni renseignement interne n'est exposé ici.
 */
export async function GET(req: Request) {
  const limited = rateLimit(`public-agences:${clientIp(req)}`, 60, 60_000);
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
    const { data, error } = await service
      .from("agences")
      .select("nom,ordre")
      .eq("active", true)
      .order("ordre", { ascending: true })
      .order("nom", { ascending: true });

    if (error) throw error;

    const seen = new Set<string>();
    const cities = (data ?? []).flatMap((agency) => {
      const name = typeof agency.nom === "string" ? agency.nom.trim() : "";
      const key = name.toLocaleLowerCase("fr-CA");
      if (!name || seen.has(key)) return [];
      seen.add(key);
      return [{ name }];
    });

    return NextResponse.json({ ok: true, cities });
  } catch {
    return NextResponse.json(
      { ok: false, reason: "Service temporairement indisponible." },
      { status: 503 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
