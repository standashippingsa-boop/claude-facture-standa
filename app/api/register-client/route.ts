import { NextResponse } from "next/server";
import { rateLimit, tooMany, clientIp } from "@/lib/ratelimit";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

/**
 * Enskripsyon kliyan — KOTE SÈVÈ.
 * ════════════════════════════════
 * Poukisa sèvè: dedoublonaj la bezwen li TOUT tab kliyan an. Fè sa nan
 * navigatè a ta ekspoze done tout kliyan yo. Isit la, service role fè
 * travay la epi nou retounen SÈLMAN rezilta a (pa gen done lòt moun).
 *
 * Sekirite:
 *  • Itilizatè a dwe DEJA otantifye (jeton Supabase) — kont lan kreye
 *    anvan pwofil la, donc nou ka mare pwofil la ak idantite a.
 *  • Validasyon done kote sèvè (longè, fòma, chan otorize sèlman).
 *  • Mesaj erè jenerik — pa gen detay bazdone ki soti deyò.
 */
const digits = (s: string) => String(s ?? "").replace(/\D/g, "");
const clean = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID_TYPES = new Set(["Carte d'identité nationale", "Passeport"]);

export async function POST(req: Request) {
  // Rate limiting — enskripsyon: 5 / èdtan pa IP (anti-spam kont)
  const rl = rateLimit("register:" + clientIp(req), 5, 3600000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    const config = getSupabaseAdminConfig();
    if (!config) {
      return NextResponse.json({ ok: false, reason: "Configuration serveur incomplète." }, { status: 500 });
    }
    const svc = createClient(config.url, config.key, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));

    // ---- Sesyon OPSYONÈL ----
    // Enskripsyon piblik la PA kreye kont Auth (admin aktive kliyan an apre,
    // ak kòd MC a). Donk pa gen sesyon isit la nan ka nòmal.
    // Pwoteksyon ki ranplase l: rate limiting (5/èdtan/IP), validasyon kote
    // sèvè, lis blan chan yo, epi wout la pa JANM retounen done lòt kliyan.
    // Si yon sesyon egziste (ka aktivasyon), nou mare pwofil la ak idantite a.
    const token = String(body.token ?? "");
    let authUserId: string | null = null;
    if (token) {
      const { data: au } = await svc.auth.getUser(token);
      authUserId = au?.user?.id ?? null;
    }

    // ---- Validasyon done (kote sèvè) ----
    const p = body.profile ?? {};
    const fullname = clean(p.fullname, 80);
    const surname = clean(p.surname, 80);
    const email = clean(p.email, 120).toLowerCase();
    const phone = clean(p.phone, 30);
    const whatsapp = clean(p.whatsapp, 30);
    const country = clean(p.country, 80);
    const address = clean(p.address, 200);
    const idType = clean(p.id_type, 50);
    const idNumber = clean(p.id_number, 80);
    const villeId = clean(p.ville_id, 36);
    if (fullname.length < 2) return NextResponse.json({ ok: false, reason: "Nom invalide." }, { status: 400 });
    if (surname.length < 1 || country.length < 2 || address.length < 3) {
      return NextResponse.json({ ok: false, reason: "Informations personnelles incomplètes." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ ok: false, reason: "Email invalide." }, { status: 400 });
    }
    if (digits(phone).length < 7 || digits(whatsapp).length < 7) {
      return NextResponse.json({ ok: false, reason: "Téléphone invalide." }, { status: 400 });
    }
    if (!ID_TYPES.has(idType) || idNumber.length < 2) {
      return NextResponse.json({ ok: false, reason: "Pièce d'identité invalide." }, { status: 400 });
    }
    if (!UUID.test(villeId)) {
      return NextResponse.json({ ok: false, reason: "Sélectionnez une ville dans la liste." }, { status: 400 });
    }

    // Pa fè konfyans non vil ki sòti nan navigatè a. Nou verifye id la ak
    // sèvè a epi nou anrejistre non ofisyèl vil aktif la sèlman.
    const { data: ville, error: villeError } = await svc
      .from("villes")
      .select("id,name")
      .eq("id", villeId)
      .eq("active", true)
      .maybeSingle();
    if (villeError) {
      return NextResponse.json({ ok: false, reason: "Service temporairement indisponible." }, { status: 503 });
    }
    if (!ville) {
      return NextResponse.json({ ok: false, reason: "La ville sélectionnée n'est plus disponible. Choisissez-en une autre." }, { status: 400 });
    }

    // Chan otorize SÈLMAN (pa gen customer_code, account_status, auth_user_id soti deyò)
    const ALLOWED = ["fullname", "surname", "email", "phone", "whatsapp", "country",
      "city", "address", "id_type", "id_number", "ville_id", "account_type"] as const;
    const profile: Record<string, unknown> = {};
    for (const k of ALLOWED) if (p[k] !== undefined && p[k] !== null) profile[k] = clean(p[k], 200);
    profile.fullname = fullname;
    profile.surname = surname;
    profile.whatsapp = whatsapp;
    profile.country = country;
    profile.address = address;
    profile.id_type = idType;
    profile.id_number = idNumber;
    profile.ville_id = ville.id;
    profile.city = ville.name;
    if (email) profile.email = email;

    // ═══════════════════════════════════════════════════════════════════
    // DEDOUBLONAJ (V18) — YON KLIYAN KA GEN PLIZYÈ KONT SHIPPING.
    // ───────────────────────────────────────────────────────────────────
    // Sèl DE bagay ki PA ka menm ant de kont:
    //     • Adrès imèl
    //     • Nimewo telefòn
    // Tout rès la ka menm — enkli NIMEWO IDANTIFIKASYON an: se nòmal yon
    // sèl moun louvri yon dezyèm kont (pèsonèl + biznis) ak menm paspò a.
    // Men chak kont dwe gen pwòp imèl ak pwòp telefòn li, paske se pa la
    // nou voye notifikasyon, fakti ak modpas — de kont ki pataje yo ta
    // resevwa enfòmasyon lòt la.
    // ═══════════════════════════════════════════════════════════════════
    const tail = digits(phone).slice(-8);

    const { data: all } = await svc.from("clients")
      .select("id, auth_user_id, email, phone, customer_code, account_status");

    const memMail = email
      ? (all ?? []).find((c: { email?: string | null }) =>
          String(c.email ?? "").trim().toLowerCase() === email)
      : null;
    const memTel = tail
      ? (all ?? []).find((c: { phone?: string | null }) =>
          digits(c.phone ?? "").length >= 7 && digits(c.phone ?? "").endsWith(tail))
      : null;

    // Menm moun ki reprann pwòp pwofil li (aktivasyon) -> nou mete l ajou.
    const propre = !!authUserId
      && ((!!memMail && (memMail as { auth_user_id?: string | null }).auth_user_id === authUserId)
       || (!!memTel && (memTel as { auth_user_id?: string | null }).auth_user_id === authUserId));

    if ((memMail || memTel) && !propre) {
      const quoi = memMail && memTel
        ? "L'adresse e-mail et le numéro de téléphone sont"
        : memMail ? "Cette adresse e-mail est" : "Ce numéro de téléphone est";
      return NextResponse.json({
        ok: false,
        reason: `${quoi} déjà utilisé par un compte existant. Pour ouvrir un deuxième compte, `
              + `utilisez une autre adresse e-mail et un autre numéro de téléphone — c'est par là `
              + `que nous envoyons vos notifications, factures et mots de passe. `
              + `Sinon, connectez-vous à votre compte ou contactez STANDA COMMERCIAL.`
      }, { status: 409 });
    }

    const found = propre ? ((memMail ?? memTel) as { id: string; customer_code?: string | null; account_status?: string | null }) : null;
    if (found) {
      const { error } = await svc.from("clients").update({
        ...profile,
        auth_user_id: authUserId,
        account_status: found.customer_code ? (found.account_status ?? "Actif") : "En attente d'activation",
      }).eq("id", found.id);
      if (error) return NextResponse.json({ ok: false, reason: "Enregistrement impossible." }, { status: 500 });
      return NextResponse.json({ ok: true, linked: true });
    }

    const { error } = await svc.from("clients").insert({
      ...profile,
      auth_user_id: authUserId,   // null si enskripsyon piblik (nòmal)
      customer_code: null,
      pickup_location: "",
      account_status: "En attente d'activation",
    });
    if (error) return NextResponse.json({ ok: false, reason: "Enregistrement impossible." }, { status: 500 });

    await svc.from("journal").insert({
      user_name: fullname, action: "Inscription Client",
      details: `Nouveau profil client créé (${email || phone || "—"})`,
      package_ref: "", customer_code: ""
    });

    return NextResponse.json({ ok: true, created: true });
  } catch {
    // Mesaj jenerik — pa gen stack trace ni detay bazdone ki soti
    return NextResponse.json({ ok: false, reason: "Erreur serveur." }, { status: 500 });
  }
}
