import { NextResponse } from "next/server";
import { rateLimit, tooMany, clientIp } from "@/lib/ratelimit";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { encryptPII } from "@/lib/pii-crypto";
import { clientShippingSchema } from "@/lib/validation/shipping";

/** Valè cookie ?ref= mete pa middleware.ts (parse manyèl — evite soud Next.js sou cookies() async). */
function refCookie(req: Request): string {
  const raw = req.headers.get("cookie") ?? "";
  const m = raw.match(/(?:^|;\s*)standa_ref=([^;]+)/);
  return m ? decodeURIComponent(m[1]).trim().toUpperCase() : "";
}

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

    // Chan "honeypot" — envizib pou moun, bot yo ranpli l. Nou fè tankou
    // tout mache byen san nou pa kreye anyen. (`website` pa nan lis ALLOWED
    // pi ba a, donk li pa janm rive nan bazdone a.)
    if (String(p.website ?? "").trim() || String(body.website ?? "").trim()) {
      return NextResponse.json({ ok: true, created: true });
    }

    const fullname = clean(p.fullname, 80);
    const surname = clean(p.surname, 80);
    const email = clean(p.email, 120).toLowerCase();
    const phone = clean(p.phone, 30);
    const whatsapp = clean(p.whatsapp, 30);
    // STANDA est actuellement réservé aux clients en Haïti. La valeur est
    // fixée côté serveur : le formulaire n'affiche donc pas un choix inutile
    // et un navigateur ne peut pas l'altérer.
    const country = "Haïti";
    const address = clean(p.address, 200);
    const idType = clean(p.id_type, 50);
    const idNumber = clean(p.id_number, 80);
    const villeId = clean(p.ville_id, 36);
    if (fullname.length < 2) return NextResponse.json({ ok: false, reason: "Nom invalide." }, { status: 400 });
    if (surname.length < 1 || address.length < 3) {
      return NextResponse.json({ ok: false, reason: "Informations personnelles incomplètes." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ ok: false, reason: "Email invalide." }, { status: 400 });
    }
    // Validation shipping (adresse, téléphone, ville) centralisée dans
    // lib/validation/shipping.ts — même schéma que /api/ingest, au lieu
    // d'un regex réinventé par route.
    const shipping = clientShippingSchema.safeParse({ address, phone, whatsapp, ville_id: villeId });
    if (!shipping.success) {
      return NextResponse.json(
        { ok: false, reason: shipping.error.issues[0]?.message ?? "Informations de livraison invalides." },
        { status: 400 }
      );
    }
    if (!ID_TYPES.has(idType) || idNumber.length < 2) {
      return NextResponse.json({ ok: false, reason: "Pièce d'identité invalide." }, { status: 400 });
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
    const ALLOWED = ["fullname", "surname", "email", "phone", "whatsapp",
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
    // account_type: valè otorize sèlman — anpeche yon moun chwazi tarif "Business"
    // pou tèt li nan navigatè a. Admin nan ka chanje l apre nan paj Clients la.
    profile.account_type = p.account_type === "Business" ? "Business" : "Personnel";

    // Chiffrement PII (AES-256-GCM, lib/pii-crypto.ts) — PHASE 1 (additive).
    // ─────────────────────────────────────────────────────────────────────
    // On écrit une copie chiffrée dans phone_encrypted/whatsapp_encrypted/
    // address_encrypted (nouvelles colonnes, voir supabase/pii_encryption_columns.sql)
    // SANS toucher aux colonnes phone/whatsapp/address en clair : lib/db.ts,
    // app/espace-client/page.tsx et la génération PDF/factures lisent encore
    // ces colonnes directement (parfois depuis le navigateur). Écraser leur
    // valeur ici casserait ces écrans silencieusement (ils afficheraient du
    // texte chiffré illisible). Le cutover complet (ces écrans déchiffrent
    // côté serveur, puis on supprime les colonnes en clair) est un chantier
    // séparé, à faire consciemment vu ce qu'il touche.
    //
    // OPT-IN : le miroir chiffré ne s'active que si PII_ENCRYPTION_KEY est
    // définie. Ordre d'activation : 1) exécuter supabase/pii_encryption_columns.sql,
    // 2) définir PII_ENCRYPTION_KEY sur Vercel, 3) redéployer. Tant que la clé
    // est absente (ou invalide), l'inscription fonctionne comme avant — un
    // problème de configuration ne doit jamais empêcher un client de s'inscrire ;
    // l'erreur est journalisée pour qu'on la voie dans les logs Vercel.
    if (process.env.PII_ENCRYPTION_KEY?.trim()) {
      try {
        profile.phone_encrypted = encryptPII(phone);
        profile.whatsapp_encrypted = encryptPII(whatsapp);
        profile.address_encrypted = encryptPII(address);
      } catch (e) {
        console.error("[register-client] chiffrement PII désactivé (clé invalide) :", e instanceof Error ? e.message : e);
      }
    }

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
      // Message UNIQUE — ne révèle pas lequel des deux champs correspond
      // (sinon un attaquant énumère les e-mails / téléphones enregistrés).
      return NextResponse.json({
        ok: false,
        reason: `Ces informations correspondent déjà à un compte existant. Pour ouvrir un `
              + `deuxième compte, utilisez une autre adresse e-mail et un autre numéro de `
              + `téléphone — c'est par là que nous envoyons vos notifications, factures et `
              + `mots de passe. Sinon, connectez-vous à votre compte ou contactez STANDA COMMERCIAL.`
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

    // ═══════════════════════════════════════════════════════════════════
    // PWOGRAM AFFILIATION — attribution (yon sèl fwa, jamè chanje apre).
    // Kòd la soti nan cookie ?ref= (mete pa middleware.ts). Si li pa
    // koresponn ak yon afilye AKTIF ki egziste, nou senpleman inyore l —
    // pa gen erè vizib pou kliyan an, enskripsyon an kontinye nòmal.
    //
    // GAD ANTI-FRAUD: yon afilye pa ka touche komisyon sou TÈT LI — si
    // imèl/telefòn kont sa a k ap kreye a matche ak pwòp enfo afilye a,
    // nou senpleman pa atribye l (kont lan kreye kanmenm, jis san lyen).
    // ═══════════════════════════════════════════════════════════════════
    // SEPARASYON DE SISTÈM YO: try/catch pwòp li a (anplis de sa a ki
    // envlope tout wout la deja) — yon bug/tab-ki-manke isit la PA JANM
    // dwe anpeche yon nouvo kliyan enskri. Nan pi mal la, l tonbe san lyen.
    let referredByAffiliateId: string | null = null;
    try {
      const refCode = refCookie(req);
      if (refCode) {
        const { data: aff } = await svc.from("affiliates")
          .select("id, email, phone, whatsapp").eq("code", refCode).eq("status", "active").maybeSingle();
        if (aff) {
          const affTail = digits(String(aff.phone || aff.whatsapp || "")).slice(-8);
          const isSelf = (aff.email && String(aff.email).trim().toLowerCase() === email)
            || (affTail && affTail.length >= 7 && affTail === tail);
          if (!isSelf) referredByAffiliateId = aff.id;
        }
      }
    } catch {
      // Pwogram Affiliation an pa konfigire ankò (tab pa la) oswa yon erè
      // pase — enskripsyon kliyan an kontinye nòmal, san lyen afilye.
    }

    const { error } = await svc.from("clients").insert({
      ...profile,
      auth_user_id: authUserId,   // null si enskripsyon piblik (nòmal)
      customer_code: null,
      pickup_location: "",
      account_status: "En attente d'activation",
      referred_by_affiliate_id: referredByAffiliateId,
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
