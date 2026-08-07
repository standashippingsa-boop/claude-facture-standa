import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Audit Log Enterprise — kapte IP + Navigateur KOTE SÈVÈ (JS navigatè a
 * pa ka li pwòp IP piblik li fyab). Rele pa lib/db.ts::logAction().
 * Si sa echwe, li p ap janm bloke operasyon k ap fèt la (logAction gen try/catch).
 */
function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const userName = String(body?.user_name ?? "");
    const action = String(body?.action ?? "");
    const details = String(body?.details ?? "");
    const packageRef = String(body?.package_ref ?? "");
    const customerCode = String(body?.customer_code ?? "");
    if (!action) return NextResponse.json({ ok: false, reason: "action manquante." }, { status: 400 });

    // IP: Vercel mete x-forwarded-for (premye a se kliyan an); fallback x-real-ip
    const xff = req.headers.get("x-forwarded-for") ?? "";
    const ip = (xff.split(",")[0] || req.headers.get("x-real-ip") || "").trim();
    const userAgent = req.headers.get("user-agent") ?? "";

    const db = svc();
    await db.from("journal").insert({
      user_name: userName, action, details, package_ref: packageRef, customer_code: customerCode,
      ip_address: ip, user_agent: userAgent
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, reason: (e as Error)?.message ?? "Erreur serveur." }, { status: 500 });
  }
}
