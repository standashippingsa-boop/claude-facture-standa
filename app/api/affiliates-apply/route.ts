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

// Valè EGZAK kontrent `affiliate_applications_id_type_check` la aksepte
// (apostwòf DWAT). Fòm lan voye apostwòf KOUB (’) — san nòmalizasyon sa a,
// baz la te refize CHAK "Carte d’identité nationale" (pyès ki pi komen an).
const ID_TYPES = ["Carte d'identité nationale", "Passeport", "Permis de conduire"];
const idTypeKey = (v: string) => v.normalize("NFC").replace(/[’‘ʼ`´]/g, "'").toLowerCase();
const canonicalIdType = (v: string) => ID_TYPES.find((t) => idTypeKey(t) === idTypeKey(v)) ?? "";

export async function POST(req: Request) {
  // Gad anti-flood pa IP sèlman. Li laj espre: Digicel/Natcom mete anpil
  // telefòn dèyè MENM IP piblik, donk yon limit sere pa IP bloke moun
  // onèt ki pa konnen youn lòt. Limit reyèl la se pa imèl, pi ba.
  const rl = rateLimit("affiliate-apply-ip:" + clientIp(req), 40, 600000);
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
    const idType = canonicalIdType(clean(body.id_type, 50));
    const idNumber = clean(body.id_number, 80);
    const motivation = clean(body.motivation, 1000);

    if (fullname.length < 2) return NextResponse.json({ ok: false, reason: "Indiquez votre nom complet." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ ok: false, reason: "Adresse courriel invalide." }, { status: 400 });
    }
    if (digits(phone).length < 7) return NextResponse.json({ ok: false, reason: "Numéro de téléphone invalide." }, { status: 400 });
    if (!idType || idNumber.length < 2) {
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

    // Limit reyèl la: pa imèl, SÈLMAN apre validasyon — yon erè frap pa
    // konsome okenn chans.
    const rlEmail = rateLimit("affiliate-apply-email:" + email, 5, 86400000);
    if (!rlEmail.ok) return tooMany(rlEmail.retryAfter);

    // Deja afilye aktif? Pa kreye yon dezyèm kandidati.
    const { data: existingAffiliate } = await svc.from("affiliates")
      .select("id").eq("email", email).eq("status", "active").limit(1).maybeSingle();
    if (existingAffiliate) {
      return NextResponse.json({
        ok: false,
        reason: "Un compte affilié actif existe déjà pour ce courriel. Connectez-vous à votre Espace Affilié, ou contactez Standa Commercial."
      }, { status: 409 });
    }

    const row = { fullname, email, phone, whatsapp, city, id_type: idType, id_number: idNumber, motivation };

    // Yon kandidati an atant ak menm imèl (moun ki reeseye apre yon rezo
    // ki koupe, oswa ki korije yon enfòmasyon): nou mete l ajou olye nou
    // kreye yon doublon admin nan ta dwe triye.
    const { data: pending } = await svc.from("affiliate_applications")
      .select("id").eq("email", email).eq("status", "pending")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    const { error } = pending
      ? await svc.from("affiliate_applications").update(row).eq("id", pending.id)
      : await svc.from("affiliate_applications").insert({ ...row, status: "pending" });

    if (error) {
      console.error("[affiliates-apply]", error);
      const code = String(error.code ?? "");
      // Tab la pa egziste (migrasyon pa kouri) — SÈL ka mesaj "pa aktive" a vre.
      if (code === "PGRST205" || code === "42P01") {
        return NextResponse.json({ ok: false, reason: "Le programme d’affiliation n’est pas encore ouvert. Réessayez plus tard." }, { status: 503 });
      }
      if (code === "23514") {
        return NextResponse.json({ ok: false, reason: "Certaines informations ne sont pas acceptées. Vérifiez le type de pièce d’identité et réessayez." }, { status: 400 });
      }
      return NextResponse.json({ ok: false, reason: "Enregistrement impossible pour le moment. Réessayez dans quelques instants." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updated: !!pending });
  } catch (error) {
    console.error("[affiliates-apply]", error);
    return NextResponse.json({ ok: false, reason: "Erreur serveur." }, { status: 500 });
  }
}
