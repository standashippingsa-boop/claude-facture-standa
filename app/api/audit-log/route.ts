import { NextResponse } from "next/server";
import { rateLimit, tooMany, clientIp } from "@/lib/ratelimit";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

/**
 * Audit Log Enterprise — kapte IP + Navigateur KOTE SÈVÈ (JS navigatè a
 * pa ka li pwòp IP piblik li fyab). Rele pa lib/db.ts::logAction().
 * Si sa echwe, li p ap janm bloke operasyon k ap fèt la (logAction gen try/catch).
 *
 * SEKIRITE
 * ────────
 *  1) Fòk moun nan otantifye (jeton Supabase valab).
 *  2) IDANTITE a DERIVE KOTE SÈVÈ apati jeton an — nou pa fè konfyans ak
 *     `user_name` kliyan an voye. Anvan, nenpòt moun ki konekte te ka ekri
 *     "Jean Admin (admin)" nan jounal la epi falsifye tras odit la.
 *  3) Longè chan yo plafonnen (anti-spam / anti-flood jounal).
 */
function svc() {
  const config = getSupabaseAdminConfig();
  if (!config) throw new Error("Configuration serveur incomplète.");
  return createClient(
    config.url,
    config.key,
    { auth: { persistSession: false } }
  );
}

const cut = (v: unknown, max: number) => String(v ?? "").slice(0, max);

export async function POST(req: Request) {
  // Rate limiting — jounal: 120 / min pa IP (itilizasyon nòmal wo)
  const rl = rateLimit("audit:" + clientIp(req), 120, 60000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    const body = await req.json().catch(() => null);

    const db = svc();
    const token = String(body?.token ?? "");
    if (!token) return NextResponse.json({ ok: false, reason: "Session requise." }, { status: 401 });
    const { data: au } = await db.auth.getUser(token);
    if (!au?.user) return NextResponse.json({ ok: false, reason: "Session invalide." }, { status: 401 });

    // ── IDANTITE DERIVE KOTE SÈVÈ (jamè sa kliyan an di) ──────────────────
    let userName = "";
    const { data: staff } = await db.from("staff")
      .select("prenom, nom, role").eq("auth_user_id", au.user.id).maybeSingle();
    if (staff) {
      userName = `${(staff.prenom ? staff.prenom + " " : "")}${staff.nom ?? ""}`.trim()
        + ` (${staff.role})`;
    } else {
      const { data: cli } = await db.from("clients")
        .select("customer_code, fullname").eq("auth_user_id", au.user.id).maybeSingle();
      if (!cli) return NextResponse.json({ ok: false, reason: "Compte inconnu." }, { status: 403 });
      userName = `${cli.customer_code ?? cli.fullname ?? "client"} (client)`.trim();
    }

    const action = cut(body?.action, 120).trim();
    const details = cut(body?.details, 2000);
    const packageRef = cut(body?.package_ref, 120);
    const customerCode = cut(body?.customer_code, 60);
    if (!action) return NextResponse.json({ ok: false, reason: "action manquante." }, { status: 400 });

    // IP: Vercel mete x-forwarded-for (premye a se kliyan an); fallback x-real-ip
    const xff = req.headers.get("x-forwarded-for") ?? "";
    const ip = (xff.split(",")[0] || req.headers.get("x-real-ip") || "").trim();
    const userAgent = cut(req.headers.get("user-agent"), 400);

    await db.from("journal").insert({
      user_name: userName, action, details, package_ref: packageRef, customer_code: customerCode,
      ip_address: ip, user_agent: userAgent
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("[audit-log]", e);
    return NextResponse.json({ ok: false, reason: "Erreur serveur." }, { status: 500 });
  }
}
