import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";

/**
 * API des agents de remise
 * ─────────────────────────
 * Ce point d'entrée est volontairement le SEUL accès de l'agent aux données.
 * L'agent n'a pas le rôle SQL `is_staff()`, donc il ne peut pas contourner ce
 * filtre avec l'API Supabase dans le navigateur. La clé service reste ici sur
 * le serveur et chaque lecture/écriture est resserrée sur sa zone.
 */
type Agent = {
  id: string;
  username: string;
  prenom: string;
  nom: string;
  role: string;
  pickup_ville_id: string | null;
};

function bearerToken(req: Request): string {
  const value = req.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

function safeName(agent: Agent) {
  return [agent.prenom, agent.nom].filter(Boolean).join(" ") || agent.username;
}

async function getAgent(req: Request): Promise<
  // Supabase n'a pas de types générés dans ce projet. `db` reste volontairement
  // côté serveur; les données retournées au navigateur restent typées/filtrées
  // plus bas avec une liste blanche stricte.
  | { ok: true; db: any; agent: Agent; zoneName: string }
  | { ok: false; response: NextResponse }
> {
  const config = getSupabaseAdminConfig();
  if (!config) {
    return { ok: false, response: NextResponse.json({ ok: false, reason: "Service indisponible." }, { status: 503 }) };
  }

  const token = bearerToken(req);
  if (!token) {
    return { ok: false, response: NextResponse.json({ ok: false, reason: "Session requise." }, { status: 401 }) };
  }

  const db: any = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth } = await db.auth.getUser(token);
  if (!auth.user) {
    return { ok: false, response: NextResponse.json({ ok: false, reason: "Session invalide." }, { status: 401 }) };
  }

  const { data: rawAgent } = await db.from("staff")
    .select("id, username, prenom, nom, role, pickup_ville_id")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  const agent = rawAgent as Agent | null;
  if (!agent || agent.role !== "agent_retrait") {
    return { ok: false, response: NextResponse.json({ ok: false, reason: "Accès réservé aux agents de remise." }, { status: 403 }) };
  }
  if (!agent.pickup_ville_id) {
    return { ok: false, response: NextResponse.json({ ok: false, reason: "Votre zone de remise n'est pas encore configurée. Contactez un administrateur." }, { status: 409 }) };
  }

  const { data: zone } = await db.from("villes").select("name")
    .eq("id", agent.pickup_ville_id).maybeSingle();
  if (!zone?.name) {
    return { ok: false, response: NextResponse.json({ ok: false, reason: "Votre zone de remise est introuvable. Contactez un administrateur." }, { status: 409 }) };
  }

  return { ok: true, db, agent, zoneName: String(zone.name) };
}

export async function GET(req: Request) {
  const rl = rateLimit("pickup-agent:read:" + clientIp(req), 120, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    const context = await getAgent(req);
    if (!context.ok) return context.response;
    const { db, agent, zoneName } = context;

    // On lit uniquement les codes clients nécessaires pour filtrer la zone.
    // Aucun nom, téléphone, e-mail, adresse ou information financière ne sort.
    const customerResult = await db.from("clients")
      .select("customer_code")
      .eq("ville_id", agent.pickup_ville_id)
      .neq("customer_code", "");
    if (customerResult.error) throw customerResult.error;
    const customerRows = (customerResult.data ?? []) as Array<{ customer_code: string | null }>;
    const codes = Array.from(new Set(customerRows.map((row) => String(row.customer_code ?? "")).filter(Boolean)));

    let rows: Array<Record<string, unknown>> = [];
    if (codes.length) {
      const { data, error } = await db.from("packages")
        .select("id, tracking_number, tracking_manual, customer_code, quantity, content, created_date, status")
        .eq("status", "Disponible")
        .eq("archived", false)
        .in("customer_code", codes)
        .order("created_at", { ascending: false });
      if (error) throw error;
      rows = (data ?? []) as Array<Record<string, unknown>>;
    }

    // Liste blanche finale: même si le schéma gagne de nouvelles colonnes, elles
    // ne seront jamais envoyées accidentellement à l'appareil de l'agent.
    const packages = rows.map((row) => ({
      id: String(row.id),
      tracking_number: String(row.tracking_number ?? ""),
      tracking_manual: String(row.tracking_manual ?? ""),
      customer_code: String(row.customer_code ?? ""),
      quantity: Number(row.quantity ?? 1) || 1,
      content: String(row.content ?? ""),
      created_date: String(row.created_date ?? ""),
      status: "Disponible" as const
    }));

    return NextResponse.json({
      ok: true,
      agent: { name: safeName(agent), username: agent.username },
      zone: { name: zoneName },
      packages
    });
  } catch (error) {
    console.error("[pickup-agent:get]", error);
    return NextResponse.json({ ok: false, reason: "Impossible de charger les colis pour le moment." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const rl = rateLimit("pickup-agent:write:" + clientIp(req), 30, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    const context = await getAgent(req);
    if (!context.ok) return context.response;
    const { db, agent, zoneName } = context;
    const body = await req.json().catch(() => null);
    const packageId = String(body?.package_id ?? "").trim();
    if (body?.action !== "release" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(packageId)) {
      return NextResponse.json({ ok: false, reason: "Demande de remise invalide." }, { status: 400 });
    }

    // Revalider la zone sur le serveur juste avant l'écriture. Le package peut
    // avoir changé depuis le dernier rafraîchissement de l'écran.
    const parcelResult = await db.from("packages")
      .select("id, tracking_number, tracking_manual, customer_code, status")
      .eq("id", packageId).maybeSingle();
    const parcel = parcelResult.data as {
      id: string; tracking_number: string | null; tracking_manual: string | null;
      customer_code: string; status: string;
    } | null;
    if (!parcel || parcel.status !== "Disponible") {
      return NextResponse.json({ ok: false, reason: "Ce colis n'est plus disponible pour une remise." }, { status: 409 });
    }
    const customerResult = await db.from("clients")
      .select("ville_id").eq("customer_code", parcel.customer_code).maybeSingle();
    const customer = customerResult.data as { ville_id: string | null } | null;
    if (!customer || customer.ville_id !== agent.pickup_ville_id) {
      return NextResponse.json({ ok: false, reason: "Ce colis n'appartient pas à votre zone de remise." }, { status: 403 });
    }

    // Double condition: si un autre poste le remet en même temps, une seule
    // mise à jour gagne et l'autre reçoit le message 409 ci-dessus.
    const { data: released, error: updateError } = await db.from("packages")
      .update({ status: "Livré" })
      .eq("id", packageId)
      .eq("status", "Disponible")
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!released) {
      return NextResponse.json({ ok: false, reason: "Ce colis vient déjà d'être traité. Actualisez la liste." }, { status: 409 });
    }

    // Piste d'audit serveur: aucune donnée fiable n'est prise depuis le client.
    const xff = req.headers.get("x-forwarded-for") ?? "";
    try {
      const { error: journalError } = await db.from("journal").insert({
        user_name: `${safeName(agent)} (agent_retrait)`,
        action: "Remise colis",
        details: `Colis remis au point de retrait ${zoneName}`,
        package_ref: String(parcel.tracking_manual || parcel.tracking_number || ""),
        customer_code: String(parcel.customer_code ?? ""),
        ip_address: (xff.split(",")[0] || req.headers.get("x-real-ip") || "").trim(),
        user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400)
      });
      if (journalError) console.error("[pickup-agent:audit]", journalError);
    } catch (auditError) {
      console.error("[pickup-agent:audit]", auditError);
    }

    return NextResponse.json({ ok: true, package_id: packageId });
  } catch (error) {
    console.error("[pickup-agent:release]", error);
    return NextResponse.json({ ok: false, reason: "Impossible de confirmer la remise pour le moment." }, { status: 500 });
  }
}
