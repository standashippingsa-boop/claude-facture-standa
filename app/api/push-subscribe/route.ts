import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";

/**
 * ENREGISTREMENT D'UN APPAREIL POUR LES NOTIFICATIONS (Web Push)
 * ═════════════════════════════════════════════════════════════
 * Fait côté serveur pour ne jamais échouer sur les règles d'accès :
 * un même téléphone peut avoir servi à un autre compte (agent, autre client).
 * L'adresse de l'appareil (endpoint) est alors simplement réattribuée à la
 * personne connectée. Le propriétaire vient TOUJOURS de la session, jamais
 * de ce qu'envoie le navigateur.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`push-subscribe:${clientIp(req)}`, 120, 60 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);
  try {
    const config = getSupabaseAdminConfig();
    if (!config) return NextResponse.json({ ok: false, reason: "config" }, { status: 503 });
    const body = await req.json().catch(() => null);
    const token = String(body?.token ?? "").trim();
    const endpoint = String(body?.endpoint ?? "").trim();
    const p256dh = String(body?.p256dh ?? "").trim();
    const auth = String(body?.auth ?? "").trim();
    if (!token) return NextResponse.json({ ok: false, reason: "session" }, { status: 401 });
    if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 300 || auth.length > 100) {
      return NextResponse.json({ ok: false, reason: "invalid_subscription" }, { status: 400 });
    }
    const db = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: who } = await db.auth.getUser(token);
    if (!who.user) return NextResponse.json({ ok: false, reason: "session" }, { status: 401 });

    if (body?.kind === "staff") {
      const { data: staff } = await db.from("staff").select("id").eq("auth_user_id", who.user.id).maybeSingle();
      if (!staff) return NextResponse.json({ ok: false, reason: "not_staff" }, { status: 403 });
      const { error } = await db.from("staff_push_subscriptions")
        .upsert({ staff_id: staff.id, endpoint, p256dh, auth }, { onConflict: "endpoint" });
      if (error) { console.error("[push-subscribe staff]", error.message); return NextResponse.json({ ok: false, reason: "save" }, { status: 500 }); }
      return NextResponse.json({ ok: true });
    }

    const { data: client } = await db.from("clients").select("customer_code").eq("auth_user_id", who.user.id).maybeSingle();
    const code = String(client?.customer_code ?? "").trim();
    if (!code) return NextResponse.json({ ok: false, reason: "not_client" }, { status: 403 });
    const { error } = await db.from("push_subscriptions")
      .upsert({ customer_code: code, endpoint, p256dh, auth }, { onConflict: "endpoint" });
    if (error) { console.error("[push-subscribe client]", error.message); return NextResponse.json({ ok: false, reason: "save" }, { status: 500 }); }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[push-subscribe]", error);
    return NextResponse.json({ ok: false, reason: "server" }, { status: 500 });
  }
}
