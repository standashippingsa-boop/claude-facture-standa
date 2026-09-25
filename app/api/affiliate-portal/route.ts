import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, tooMany, clientIp } from "@/lib/ratelimit";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { hashToken, newSessionToken, verifyPassword } from "@/lib/affiliate-crypto";

/**
 * PÒTAY AFILYE — login/me/logout.
 * ═══════════════════════════════════════════════════════════════════════
 * Afilye yo PA Supabase Auth: sesyon an se yon cookie httpOnly ki gen yon
 * jeton o aza, kont anrejistre (hash) nan `affiliate_sessions`. Wout sa a
 * SÈL kote ki li/ekri tab afilye yo pou aksyon pòtay la — service role,
 * jamè dirèkteman nan navigatè a (RLS pa ka idantifye yon afilye).
 */
const COOKIE = "aff_session";
const SESSION_DAYS = 30;

function cookieValue(req: Request): string {
  const raw = req.headers.get("cookie") ?? "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

async function affiliateFromSession(svc: any, token: string) {
  if (!token) return null;
  const { data: session } = await svc.from("affiliate_sessions").select("affiliate_id, expires_at")
    .eq("token_hash", hashToken(token)).maybeSingle();
  if (!session) return null;
  if (new Date(session.expires_at as string).getTime() < Date.now()) return null;
  const { data: aff } = await svc.from("affiliates").select("*").eq("id", session.affiliate_id as string).maybeSingle();
  return aff ?? null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  // "me" kouri sou CHAK chajman espas afilye a — li pa dwe manje menm
  // bidjè ak tantativ koneksyon yo (sitou dèyè IP Digicel/Natcom pataje).
  const rl = action === "login"
    ? rateLimit("affiliate-login-ip:" + clientIp(req), 40, 600000)
    : rateLimit("affiliate-portal:" + clientIp(req), 300, 600000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const config = getSupabaseAdminConfig();
  if (!config) return NextResponse.json({ ok: false, reason: "Configuration serveur incomplète." }, { status: 500 });
  const svc: any = createClient(config.url, config.key, { auth: { persistSession: false } });

  if (action === "login") {
    // Idantifyan = kòd afilye a (toujou MAJISKIL, ex: FADONA5391). Klavye
    // telefòn yo ekri "Fadona5391" — se pa yon move modpas, se menm kont lan.
    const username = String(body.username ?? "").trim().toUpperCase();
    const password = String(body.password ?? "").trim();
    if (!username || !password) return NextResponse.json({ ok: false, reason: "Identifiant et mot de passe requis." });

    // Pwoteksyon brute-force REYÈL la: pa kont (kòd la piblik — li nan lyen referans lan).
    const rlUser = rateLimit("affiliate-login-user:" + username, 10, 900000);
    if (!rlUser.ok) return tooMany(rlUser.retryAfter);

    const { data: aff } = await svc.from("affiliates").select("*").eq("username", username).maybeSingle();
    // Modpas jenere yo gen SÈLMAN majiskil + chif: yon modpas tape an miniskil
    // se menm modpas la. Nou eseye egzak la an premye (yon modpas admin chwazi
    // ak miniskil rete valab tèl quel).
    const passwordOk = !!aff && (verifyPassword(password, aff.password_hash as string)
      || (password !== password.toUpperCase() && verifyPassword(password.toUpperCase(), aff.password_hash as string)));
    if (!passwordOk) {
      return NextResponse.json({ ok: false, reason: "Identifiant ou mot de passe incorrect. L’identifiant est votre code affilié (ex. : ABCDEF1234)." });
    }
    if (aff.status !== "active") {
      return NextResponse.json({ ok: false, reason: "Ce compte affilié n'est plus actif. Contactez Standa Commercial." });
    }

    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
    await svc.from("affiliate_sessions").delete().lt("expires_at", new Date().toISOString());
    await svc.from("affiliate_sessions").insert({
      affiliate_id: aff.id, token_hash: hashToken(token), expires_at: expiresAt.toISOString()
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE, token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      path: "/", maxAge: SESSION_DAYS * 86400
    });
    return res;
  }

  if (action === "me") {
    const aff = await affiliateFromSession(svc, cookieValue(req));
    if (!aff) return NextResponse.json({ ok: false, reason: "Session expirée. Reconnectez-vous." }, { status: 401 });

    const { data: commissions, error: commissionsError } = await svc.from("affiliate_commissions")
      .select("id, amount, status, paid_at, payout_method, created_at, client_id, invoice_id")
      .eq("affiliate_id", aff.id as string).order("created_at", { ascending: false });
    if (commissionsError) return NextResponse.json({ ok: false, reason: "Impossible de charger les commissions." }, { status: 500 });

    // Yon kliyan parèt sou espas afilye a DEPI enskripsyon li ak lyen an.
    // Li pa bezwen gen fakti pou afilye a wè li. Nou ajoute eta sèvis la
    // apre nou gade si kliyan sa a gen omwen yon colis, epi eta komisyon an
    // apre nou gade fakti ki deja jenere pou li.
    const { data: clients, error: clientsError } = await svc.from("clients")
      .select("id, fullname, customer_code, created_at")
      .eq("referred_by_affiliate_id", aff.id as string)
      .order("created_at", { ascending: false });
    if (clientsError) return NextResponse.json({ ok: false, reason: "Impossible de charger les clients référés." }, { status: 500 });

    const referred = (clients ?? []) as Array<{ id: string; fullname: string; customer_code?: string | null; created_at: string }>;
    const customerCodes = Array.from(new Set(referred.map((client) => String(client.customer_code ?? "").trim()).filter(Boolean)));
    let packages: Array<{ customer_code: string }> = [];
    if (customerCodes.length) {
      const { data, error: packagesError } = await svc.from("packages")
        .select("customer_code")
        .in("customer_code", customerCodes);
      if (packagesError) return NextResponse.json({ ok: false, reason: "Impossible de vérifier les services des clients." }, { status: 500 });
      packages = (data ?? []) as Array<{ customer_code: string }>;
    }

    // amount (numeric Postgres) toujou yon nimewo pou espas afilye a — li fè
    // `.toFixed()` dirèkteman; yon string ta kraze tout paj la.
    const list: any[] = (commissions ?? []).map((c: any) => ({ ...c, amount: Number(c.amount) || 0 }));
    const totalDue = list.filter((c) => c.status === "due").reduce((s: number, c) => s + Number(c.amount), 0);
    const totalPaid = list.filter((c) => c.status === "paid").reduce((s: number, c) => s + Number(c.amount), 0);
    const daysLeft = Math.max(0, Math.ceil((new Date(aff.contract_end as string).getTime() - Date.now()) / 86400000));
    const packagesByCode = new Set(packages.map((pkg) => String(pkg.customer_code ?? "").trim()));
    const commissionsByClient = new Map<string, any[]>();
    list.forEach((commission) => {
      if (!commission.client_id) return;
      const clientCommissions = commissionsByClient.get(commission.client_id) ?? [];
      clientCommissions.push(commission);
      commissionsByClient.set(commission.client_id, clientCommissions);
    });
    const referredClients = referred.map((client) => {
      const clientCommissions = commissionsByClient.get(client.id) ?? [];
      const commissionTotal = clientCommissions.reduce((sum, commission) => sum + Number(commission.amount || 0), 0);
      const hasService = !!client.customer_code && packagesByCode.has(client.customer_code);
      const stage = commissionTotal > 0 ? "commission_added" : hasService ? "service_started" : "account_created";
      return {
        id: client.id, fullname: client.fullname, customer_code: client.customer_code ?? "", created_at: client.created_at,
        stage, commission_total: commissionTotal, commission_count: clientCommissions.length
      };
    });

    return NextResponse.json({
      ok: true,
      affiliate: {
        fullname: aff.fullname, code: aff.code, referral_link: aff.referral_link,
        contract_start: aff.contract_start, contract_end: aff.contract_end, status: aff.status,
        commission_amount: aff.commission_amount, days_left: daysLeft
      },
      commissions: list, totalDue, totalPaid,
      clientsCount: referredClients.length,
      referredClients
    });
  }

  if (action === "logout") {
    const token = cookieValue(req);
    if (token) await svc.from("affiliate_sessions").delete().eq("token_hash", hashToken(token));
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  }

  return NextResponse.json({ ok: false, reason: "Action inconnue." });
}
