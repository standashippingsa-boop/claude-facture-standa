import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { clientAuthEmail, isClientAuthEmailForCode } from "@/lib/client-auth";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { normalizeMcCode } from "@/lib/utils";

/**
 * Répare discrètement les comptes historiques après une connexion réussie.
 * Le jeton Supabase prouve que la personne connaît déjà le mot de passe; on
 * ne réinitialise jamais un mot de passe ni ne crée un compte depuis cette API.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`client-auth-reconcile:${clientIp(req)}`, 30, 10 * 60_000);
  if (!limit.ok) return tooMany(limit.retryAfter);

  try {
    const config = getSupabaseAdminConfig();
    if (!config) return NextResponse.json({ ok: false, reason: "configuration" }, { status: 503 });
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? "");
    const code = normalizeMcCode(String(body.code ?? ""));
    if (!token || !code) return NextResponse.json({ ok: false }, { status: 400 });

    const svc = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth } = await svc.auth.getUser(token);
    const user = auth.user;
    if (!user || !isClientAuthEmailForCode(user.email, code)) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const [{ data: byCode }, { data: byUsername }] = await Promise.all([
      svc.from("clients").select("id, auth_user_id").eq("customer_code", code).maybeSingle(),
      svc.from("clients").select("id, auth_user_id").eq("username", code).maybeSingle(),
    ]);
    const client = byCode ?? byUsername;
    if (!client || (client.auth_user_id && client.auth_user_id !== user.id)) {
      return NextResponse.json({ ok: false, reason: "profile" }, { status: 409 });
    }

    // On conserve les anciennes variantes uniquement le temps de les réparer.
    // L'adresse technique devient ensuite la forme unique du code MC.
    if (String(user.email ?? "").toLowerCase() !== clientAuthEmail(code)) {
      const { error } = await svc.auth.admin.updateUserById(user.id, {
        email: clientAuthEmail(code),
        email_confirm: true,
      });
      if (error) return NextResponse.json({ ok: false, reason: "identity" }, { status: 409 });
    }
    const { error: profileError } = await svc.from("clients").update({
      auth_user_id: user.id,
      username: code,
      must_change_password: false,
    }).eq("id", client.id);
    if (profileError) return NextResponse.json({ ok: false, reason: "profile" }, { status: 409 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
