import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase-server";

/**
 * Liste publique minimale des villes où une agence est actuellement active.
 * Aucune adresse, aucun tarif ni renseignement interne n'est exposé ici.
 */
export async function GET(req: Request) {
  const limited = rateLimit(`public-agences:${clientIp(req)}`, 60, 60_000);
  if (!limited.ok) return tooMany(limited.retryAfter);

  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) {
    return NextResponse.json(
      { ok: false, reason: "Service temporairement indisponible." },
      { status: 503 }
    );
  }

  try {
    // La politique RLS ne laisse lire que les agences actives. Cette route
    // publique n'a donc pas besoin de clé secrète pour fournir la liste.
    const service = createClient(url, key, {
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
