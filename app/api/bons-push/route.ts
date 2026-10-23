import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { notifyPickupAgents } from "@/lib/bon-remise-push";

/**
 * NOTIFIKASYON BON DE REMISE KI POKO VOYE — rele pa pg_cron (bons_remise_tick,
 * supabase/20261023_bons_per_conduce_safety_net.sql) chak 2 minit lè gen bon
 * ki poko gen push_sent_at. Sekirite: kle prive ki nan tab internal_secrets
 * (kle sèvis sèlman ka li l), konpare an tan konstan.
 */
export async function POST(req: Request) {
  const config = getSupabaseAdminConfig();
  if (!config) return NextResponse.json({ ok: false }, { status: 500 });
  const svc = createClient(config.url, config.key, { auth: { persistSession: false } });

  const provided = Buffer.from(String(req.headers.get("x-bons-secret") ?? ""));
  const { data: secretRow } = await svc.from("internal_secrets").select("value").eq("key", "bons_push_secret").maybeSingle();
  const expected = Buffer.from(String(secretRow?.value ?? ""));
  if (!expected.length || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const since = new Date(Date.now() - 2 * 86400000).toISOString();
  const before = new Date(Date.now() - 60000).toISOString();
  const { data: bons } = await svc.from("bons_remise").select("id, bon_number, destination, package_count")
    .is("push_sent_at", null).gte("created_at", since).lte("created_at", before).limit(50);
  let notified = 0;
  for (const bon of (bons ?? []) as Array<{ id: string; bon_number: string; destination: string; package_count: number }>) {
    // Marke anvan voye: de apèl an menm tan pa janm voye menm bon an de fwa.
    const { data: claimed } = await svc.from("bons_remise").update({ push_sent_at: new Date().toISOString() })
      .eq("id", bon.id).is("push_sent_at", null).select("id");
    if (!claimed?.length) continue;
    notified += await notifyPickupAgents(config, svc, bon.destination, bon.bon_number, Number(bon.package_count) || 0).catch(() => 0);
  }
  return NextResponse.json({ ok: true, bons: bons?.length ?? 0, notified });
}
