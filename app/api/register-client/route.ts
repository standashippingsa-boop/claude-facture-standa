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
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ ok: false, reason: "Email invalide." }, { status: 400 });
    }
    if (phone && digits(phone).length < 7) {
      return NextResponse.json({ ok: false, reason: "Téléphone invalide." }, { status: 400 });
    }

    // Chan otorize SÈLMAN (pa gen customer_code, account_status, auth_user_id soti deyò)
    const ALLOWED = ["fullname", "surname", "email", "phone", "whatsapp", "country",
      "city", "city2", "address", "id_type", "id_number", "ville_id", "account_type"] as const;
    const profile: Record<string, unknown> = {};
    for (const k of ALLOWED) if (p[k] !== undefined && p[k] !== null) profile[k] = clean(p[k], 200);
    profile.fullname = fullname;
    if (email) profile.email = email;

    // ---- Dedoublonaj (kote sèvè — pa gen done lòt kliyan ki soti) ----
    const { data: all } = await svc.from("clients")
      .select("id, auth_user_id, email, phone, customer_code, account_status");
    const tail = digits(phone).slice(-8);
    const found = (all ?? []).find((c: any) =>
      (email && String(c.email ?? "").toLowerCase() === email) ||
      (tail && digits(c.phone ?? "").length >= 7 && digits(c.phone ?? "").endsWith(tail)));

    if (found) {
      if (found.auth_user_id && authUserId && found.auth_user_id !== authUserId) {
        return NextResponse.json({ ok: false, reason: "Un compte existe déjà. Connectez-vous ou contactez STANDA COMMERCIAL." }, { status: 409 });
      }
      const { error } = await svc.from("clients").update({
        ...profile,
        ...(authUserId ? { auth_user_id: authUserId } : {}),
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
