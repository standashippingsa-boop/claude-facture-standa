import { NextResponse } from "next/server";
import { rateLimit, tooMany, clientIp } from "@/lib/ratelimit";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { pickupLocationForCity } from "@/lib/pickup-location";

/**
 * Candidature au programme Affiliation — CÔTÉ SERVEUR.
 * ═════════════════════════════════════════════════════
 * Page /affiliation (lyen prive, pa nan menu piblik la) rele wout sa a.
 * Menm modèl sekirite ak /api/register-client: pa gen sesyon, donk
 * pwoteksyon an se rate limiting + validasyon sèvè + lis blan chan yo.
 */
const clean = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const digits = (s: string) => String(s ?? "").replace(/\D/g, "");
const ID_TYPES = new Set(["Carte d'identité nationale", "Carte d’identité nationale", "Passeport", "Permis de conduire"]);

export async function POST(req: Request) {
  const rl = rateLimit("affiliate-apply:" + clientIp(req), 5, 3600000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    const config = getSupabaseAdminConfig();
    if (!config) return NextResponse.json({ ok: false, reason: "Configuration serveur incomplète." }, { status: 500 });
    const svc = createClient(config.url, config.key, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));

    // Honeypot anti-bot (chan envizib nan fòm lan)
    if (clean(body.website)) return NextResponse.json({ ok: true });

    const fullname = clean(body.fullname, 80);
    const email = clean(body.email, 120).toLowerCase();
    const phone = clean(body.phone, 30);
    const whatsapp = clean(body.whatsapp, 30) || phone;
    const city = clean(body.city, 80);
    const idType = clean(body.id_type, 50);
    const idNumber = clean(body.id_number, 80);
    const motivation = clean(body.motivation, 1000);

    if (fullname.length < 2) return NextResponse.json({ ok: false, reason: "Non obligatwa." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ ok: false, reason: "Email invalide." }, { status: 400 });
    }
    if (digits(phone).length < 7) return NextResponse.json({ ok: false, reason: "Téléphone invalide." }, { status: 400 });
    if (!ID_TYPES.has(idType) || idNumber.length < 2) {
      return NextResponse.json({ ok: false, reason: "Pièce d'identité invalide." }, { status: 400 });
    }

    // La ville doit correspondre à une agence encore active, même si une
    // requête est fabriquée en dehors du formulaire.
    const { data: agencies, error: agenciesError } = await svc
      .from("agences")
      .select("nom,ordre")
      .eq("active", true);
    if (agenciesError) throw agenciesError;
    if (!city || !pickupLocationForCity(city, (agencies ?? []).filter((agency) => typeof agency.nom === "string"))) {
      return NextResponse.json(
        { ok: false, reason: "Sélectionnez une ville où une agence est active." },
        { status: 400 }
      );
    }

    const { error } = await svc.from("affiliate_applications").insert({
      fullname, email, phone, whatsapp, city, id_type: idType, id_number: idNumber, motivation,
      status: "pending"
    });
    if (error) {
      console.error("[affiliates-apply]", error);
      const detail = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
      if (detail.includes("affiliate_applications") || detail.includes("pgrst205")) {
        return NextResponse.json({ ok: false, reason: "Le programme d’affiliation doit être activé dans la base de données avant de recevoir des candidatures." }, { status: 503 });
      }
      return NextResponse.json({ ok: false, reason: "Enregistrement impossible pour le moment. Réessayez dans quelques instants." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[affiliates-apply]", error);
    return NextResponse.json({ ok: false, reason: "Erreur serveur." }, { status: 500 });
  }
}
