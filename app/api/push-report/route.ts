import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";

/**
 * Rapò echèk aktivasyon notifikasyon — pou ekip la wè POUKISA yon telefòn
 * pa rive anrejistre (navigatè, rezon egzat), olye li devine.
 * Sesyon obligatwa; yon sèl liy jounal, limite pa IP.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`push-report:${clientIp(req)}`, 6, 60 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);
  try {
    const config = getSupabaseAdminConfig();
    if (!config) return NextResponse.json({ ok: false }, { status: 503 });
    const body = await req.json().catch(() => null);
    const token = String(body?.token ?? "").trim();
    if (!token) return NextResponse.json({ ok: false }, { status: 401 });
    const db: any = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth } = await db.auth.getUser(token);
    if (!auth.user) return NextResponse.json({ ok: false }, { status: 401 });

    const [{ data: client }, { data: staff }] = await Promise.all([
      db.from("clients").select("customer_code").eq("auth_user_id", auth.user.id).maybeSingle(),
      db.from("staff").select("username, role").eq("auth_user_id", auth.user.id).maybeSingle()
    ]);
    const who = client?.customer_code || (staff ? `${staff.username} · ${staff.role}` : "inconnu");
    const reason = String(body?.reason ?? "").slice(0, 200);
    const platform = String(body?.platform ?? "").slice(0, 40);
    const agent = (req.headers.get("user-agent") ?? "").slice(0, 300);

    await db.from("journal").insert({
      user_name: who, action: "Notifications : activation échouée",
      details: `${platform} · ${reason}`, package_ref: "", customer_code: client?.customer_code ?? "",
      ip_address: clientIp(req), user_agent: agent
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[push-report]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
