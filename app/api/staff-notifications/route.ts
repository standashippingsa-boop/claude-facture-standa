import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";

type StaffIdentity = { id: string; role: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

function tokenFrom(req: Request) {
  const value = req.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

async function contextFor(req: Request): Promise<
  // Le schéma Supabase est géré en SQL dans ce dépôt, sans types générés.
  // La route reste côté serveur et valide tous les champs d'entrée.
  | { ok: true; db: any; staff: StaffIdentity }
  | { ok: false; response: NextResponse }
> {
  const config = getSupabaseAdminConfig();
  if (!config) return { ok: false, response: NextResponse.json({ ok: false, reason: "Service indisponible." }, { status: 503 }) };
  const token = tokenFrom(req);
  if (!token) return { ok: false, response: NextResponse.json({ ok: false, reason: "Session requise." }, { status: 401 }) };

  const db = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth } = await db.auth.getUser(token);
  if (!auth.user) return { ok: false, response: NextResponse.json({ ok: false, reason: "Session invalide." }, { status: 401 }) };

  const staffResult = await db.from("staff").select("id, role").eq("auth_user_id", auth.user.id).maybeSingle();
  const staff = staffResult.data as StaffIdentity | null;
  if (staffResult.error || !staff) return { ok: false, response: NextResponse.json({ ok: false, reason: "Compte interne requis." }, { status: 403 }) };
  return { ok: true, db, staff };
}

export async function GET(req: Request) {
  const limiter = rateLimit(`staff-notifications:${clientIp(req)}`, 180, 60_000);
  if (!limiter.ok) return tooMany(limiter.retryAfter);
  try {
    const context = await contextFor(req);
    if (!context.ok) return context.response;
    const requested = Number(new URL(req.url).searchParams.get("limit") ?? 20);
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(50, Math.trunc(requested))) : 20;
    const result = await context.db.from("staff_notifications")
      .select("id, kind, title, message, href, created_at, read_at")
      .eq("recipient_staff_id", context.staff.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, notifications: result.data ?? [] });
  } catch (error) {
    console.error("[staff-notifications:get]", error);
    return NextResponse.json({ ok: false, reason: "Notifications indisponibles pour le moment." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const limiter = rateLimit(`staff-notifications:${clientIp(req)}`, 90, 60_000);
  if (!limiter.ok) return tooMany(limiter.retryAfter);
  try {
    const context = await contextFor(req);
    if (!context.ok) return context.response;
    const body = await req.json().catch(() => null);
    const action = String(body?.action ?? "");
    if (action !== "mark_read" && action !== "mark_all_read") {
      return NextResponse.json({ ok: false, reason: "Action inconnue." }, { status: 400 });
    }

    let query = context.db.from("staff_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_staff_id", context.staff.id)
      .is("read_at", null);

    if (action === "mark_read") {
      const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown): id is string => typeof id === "string" && UUID.test(id)).slice(0, 50) : [];
      if (!ids.length) return NextResponse.json({ ok: false, reason: "Notification invalide." }, { status: 400 });
      query = query.in("id", ids);
    }
    const result = await query.select("id");
    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, updated: result.data?.length ?? 0 });
  } catch (error) {
    console.error("[staff-notifications:post]", error);
    return NextResponse.json({ ok: false, reason: "Impossible de mettre à jour les notifications." }, { status: 500 });
  }
}
