import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";

/**
 * Liste publique minimale des villes actives pour le formulaire d'inscription.
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
    const { data, error } = await service
      .from("villes")
      .select("id,name")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      villes: (data ?? []).filter((ville) => typeof ville.id === "string" && typeof ville.name === "string")
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
