import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";

/**
 * NUMÉROS DE CONDUCE POUR L'APP CLIENT
 * La table conduces reste réservée au personnel (RLS). Cette route renvoie au
 * client connecté SEULEMENT les numéros de Conduce de SES propres colis :
 * le client vient toujours de la session, jamais de ce qu'envoie le navigateur.
 * Réponse : { ok: true, conduces: { [conduce_id]: "16398", … } }
 */
export async function GET(req: Request) {
  const rl = rateLimit(`client-conduces:${clientIp(req)}`, 120, 10 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const config = getSupabaseAdminConfig();
  if (!config) return NextResponse.json({ ok: false, reason: "config" }, { status: 503 });
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token.length > 5000) return NextResponse.json({ ok: false, reason: "session" }, { status: 401 });

  const db = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who } = await db.auth.getUser(token);
  if (!who.user) return NextResponse.json({ ok: false, reason: "session" }, { status: 401 });

  const { data: client } = await db.from("clients").select("customer_code").eq("auth_user_id", who.user.id).maybeSingle();
  const code = String(client?.customer_code ?? "").trim();
  if (!code) return NextResponse.json({ ok: true, conduces: {} }, { headers: { "Cache-Control": "no-store" } });

  const ids = new Set<string>();
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await db.from("packages").select("conduce_id")
      .eq("customer_code", code).not("conduce_id", "is", null).order("id").range(from, from + 999);
    if (error) break;
    (data ?? []).forEach((row: { conduce_id: string | null }) => { if (row.conduce_id) ids.add(row.conduce_id); });
    if (!data || data.length < 1000) break;
  }
  const conduces: Record<string, string> = {};
  const list = Array.from(ids);
  for (let i = 0; i < list.length; i += 200) {
    const { data } = await db.from("conduces").select("id, conduce_number").in("id", list.slice(i, i + 200));
    (data ?? []).forEach((row: { id: string; conduce_number: string | number | null }) => {
      if (row.conduce_number !== null && row.conduce_number !== undefined) conduces[row.id] = String(row.conduce_number);
    });
  }
  return NextResponse.json({ ok: true, conduces }, { headers: { "Cache-Control": "no-store" } });
}
