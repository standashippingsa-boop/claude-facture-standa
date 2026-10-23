import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, tooMany, clientIp } from "@/lib/ratelimit";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { notifyPickupAgents } from "@/lib/bon-remise-push";

/**
 * Notifikasyon PUSH pou AJAN RETRAIT — lè yon nouvo Bon de Remise kreye pou
 * zòn li. Rele pa lib/db.ts (createBonRemiseRecord) apre Bon an fin kreye
 * ak siksè — yon echèk isit la PA JANM dwe fè kreyasyon Bon an rate, se
 * poutèt sa lib/db.ts vlope apèl la nan yon try/catch pwòp li.
 *
 * SEKIRITE: menm modèl ak /api/notify — sesyon staff (admin/employé)
 * obligatwa, kle sèvis la sèvi apre verifikasyon an sèlman.
 */
async function requireStaff(svc: any, token: string): Promise<boolean> {
  if (!token) return false;
  const { data: au } = await svc.auth.getUser(token);
  if (!au?.user) return false;
  const { data: staff } = await svc.from("staff").select("role").eq("auth_user_id", au.user.id).maybeSingle();
  return !!staff && (staff.role === "admin" || staff.role === "employe");
}

export async function POST(req: Request) {
  const rl = rateLimit("notify-agent:" + clientIp(req), 60, 3600000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const config = getSupabaseAdminConfig();
  if (!config) return NextResponse.json({ ok: false, reason: "Configuration serveur incomplète." }, { status: 500 });
  const svc = createClient(config.url, config.key, { auth: { persistSession: false } });

  const ok = await requireStaff(svc, String(body.token ?? ""));
  if (!ok) return NextResponse.json({ ok: false, reason: "Accès refusé." }, { status: 403 });

  const destination = String(body.destination ?? "").trim();
  const bonNumber = String(body.bon_number ?? "").trim();
  const packageCount = Math.max(0, Math.trunc(Number(body.package_count) || 0));
  if (!destination) return NextResponse.json({ ok: true, notified: 0 });


  // Bon an make « voye » : filè sekirite /api/bons-push pa re-voye l.
  if (bonNumber) await svc.from("bons_remise").update({ push_sent_at: new Date().toISOString() }).eq("bon_number", bonNumber).is("push_sent_at", null);
  const notified = await notifyPickupAgents(config, svc, destination, bonNumber, packageCount);
  return NextResponse.json({ ok: true, notified });
}
