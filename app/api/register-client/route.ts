import { NextResponse } from "next/server";
import { rateLimit, tooMany, clientIp } from "@/lib/ratelimit";
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
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const digits = (s: string) => String(s ?? "").replace(/\D/g, "");
const clean = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);

export async function POST(req: Request) {
  // Rate limiting — enskripsyon: 5 / èdtan pa IP (anti-spam kont)
  const rl = rateLimit("register:" + clientIp(req), 5, 3600000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    if (!SERVICE) {
      return NextResponse.json({ ok: false, reason: "Configuration serveur incomplète." }, { status: 500 });
    }
    const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
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
    const email = clean(p.email, 120).toLowerCase();
    const phone = clean(p.phone, 30);
    if (fullname.length < 2) return NextResponse.json({ ok: false, reason: "Nom invalide." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ ok: false, reason: "Imèl la pa bon. Verifye li (egzanp: non@gmail.com)." }, { status: 400 });
    }
    if (digits(phone).length < 7) {
      return NextResponse.json({ ok: false, reason: "Nimewo telefòn nan pa bon. Mete omwen 7 chif." }, { status: 400 });
    }

    // Chan otorize SÈLMAN (pa gen customer_code, account_status, auth_user_id soti deyò)
    const ALLOWED = ["fullname", "surname", "email", "phone", "whatsapp", "country",
      "city", "address", "id_type", "id_number", "ville_id", "account_type"] as const;
    const profile: Record<string, unknown> = {};
    for (const k of ALLOWED) if (p[k] !== undefined && p[k] !== null) profile[k] = clean(p[k], 200);
    profile.fullname = fullname;
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
      // Mesaj KOUT ak KLÈ: kliyan an dwe konnen KI CHAN ki an konfli epi
      // KI SA POU L FÈ. Yon woman pa ede pèsonn sou yon telefòn.
      const quoi = memMail && memTel
        ? "Imèl sa a ak nimewo telefòn sa a"
        : memMail ? "Imèl sa a" : "Nimewo telefòn sa a";
      return NextResponse.json({
        ok: false,
        reason: `${quoi} deja gen yon kont. Konekte sou kont ou, oswa itilize yon lòt imèl ak yon lòt telefòn.`
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
