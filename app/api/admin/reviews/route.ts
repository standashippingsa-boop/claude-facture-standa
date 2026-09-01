import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";

const ADMIN_COLUMNS = "id, author_name, rating, message, is_visible, moderated_at, created_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function service() {
  const config = getSupabaseAdminConfig();
  return config ? createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

function reply(body: object, init?: ResponseInit) {
  return NextResponse.json(body, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

async function requireAdmin(token: string) {
  const db = service();
  if (!db) return { ok: false as const, status: 503, error: "Service temporairement indisponible." };
  const { data: auth } = await db.auth.getUser(token);
  if (!auth.user) return { ok: false as const, status: 401, error: "Session obligatoire." };
  const { data: staff } = await db.from("staff").select("role").eq("auth_user_id", auth.user.id).maybeSingle();
  if (staff?.role !== "admin") return { ok: false as const, status: 403, error: "Réservé aux administrateurs." };
  return { ok: true as const, db, userId: auth.user.id };
}

export async function POST(request: NextRequest) {
  const rate = rateLimit(`admin-reviews:${clientIp(request)}`, 120, 60 * 1000);
  if (!rate.ok) return tooMany(rate.retryAfter);

  let body: { token?: unknown; action?: unknown; id?: unknown; visible?: unknown };
  try { body = await request.json() as typeof body; } catch { return reply({ error: "Requête invalide." }, { status: 400 }); }

  const gate = await requireAdmin(String(body.token ?? ""));
  if (!gate.ok) return reply({ error: gate.error }, { status: gate.status });

  if (body.action === "list") {
    const { data, error } = await gate.db.from("site_reviews").select(ADMIN_COLUMNS).order("created_at", { ascending: false }).limit(100);
    if (error) return reply({ error: "Impossible de charger les commentaires." }, { status: 503 });
    return reply({ reviews: data ?? [] });
  }

  if (body.action === "visibility") {
    const id = String(body.id ?? "");
    if (!UUID.test(id) || typeof body.visible !== "boolean") return reply({ error: "Modification invalide." }, { status: 400 });
    const { data, error } = await gate.db
      .from("site_reviews")
      .update({ is_visible: body.visible, moderated_at: new Date().toISOString(), moderated_by: gate.userId })
      .eq("id", id)
      .select(ADMIN_COLUMNS)
      .single();
    if (error) return reply({ error: "Impossible de modifier ce commentaire." }, { status: 503 });
    return reply({ review: data });
  }

  return reply({ error: "Action non autorisée." }, { status: 400 });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
