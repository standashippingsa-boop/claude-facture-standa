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
  const rl = rateLimit("affiliate-portal:" + clientIp(req), 30, 600000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const config = getSupabaseAdminConfig();
  if (!config) return NextResponse.json({ ok: false, reason: "Configuration serveur incomplète." }, { status: 500 });
  const svc: any = createClient(config.url, config.key, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "login") {
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    if (!username || !password) return NextResponse.json({ ok: false, reason: "Identifiant et mot de passe requis." });

    const { data: aff } = await svc.from("affiliates").select("*").eq("username", username).maybeSingle();
    if (!aff || !verifyPassword(password, aff.password_hash as string)) {
      return NextResponse.json({ ok: false, reason: "Identifiant ou mot de passe incorrect." });
    }
    if (aff.status !== "active") {
      return NextResponse.json({ ok: false, reason: "Ce compte affilié n'est plus actif. Contactez STANDA COMMERCIAL." });
    }

    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
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

    const { data: commissions } = await svc.from("affiliate_commissions")
      .select("id, amount, status, paid_at, payout_method, created_at, client_id, invoice_id")
      .eq("affiliate_id", aff.id as string).order("created_at", { ascending: false });
    const list: any[] = commissions ?? [];
    const totalDue = list.filter((c) => c.status === "due").reduce((s: number, c) => s + Number(c.amount), 0);
    const totalPaid = list.filter((c) => c.status === "paid").reduce((s: number, c) => s + Number(c.amount), 0);
    const daysLeft = Math.max(0, Math.ceil((new Date(aff.contract_end as string).getTime() - Date.now()) / 86400000));

    return NextResponse.json({
      ok: true,
      affiliate: {
        fullname: aff.fullname, code: aff.code, referral_link: aff.referral_link,
        contract_start: aff.contract_start, contract_end: aff.contract_end, status: aff.status,
        commission_amount: aff.commission_amount, days_left: daysLeft
      },
      commissions: list, totalDue, totalPaid,
      clientsCount: new Set(list.map((c) => c.client_id).filter(Boolean)).size
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
