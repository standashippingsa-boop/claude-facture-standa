import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { rateLimit, tooMany, clientIp } from "@/lib/ratelimit";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

/**
 * LIS KÒD KLIYAN POU EKSTANSYON CHROME LAN
 * ─────────────────────────────────────────
 * Paj MCPACK la pa montre plis pase ~75 liy. Pou okenn koli pa sove, ekstansyon
 * an chèche kliyan pa kliyan sou MCPACK (menm jan ak lè admin tape kòd la).
 * Endpoint sa a ba l lis kòd yo — SÈLMAN kòd yo (pa gen non, telefòn, elatriye).
 * Menm token ak /api/ingest.
 */
export async function GET(req: Request) {
  const rl = rateLimit("ingest-clients:" + clientIp(req), 30, 60000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return NextResponse.json({ ok: false, reason: "Token manquant." }, { status: 401 });

  const config = getSupabaseAdminConfig();
  if (!config) return NextResponse.json({ ok: false, reason: "Configuration serveur incomplète." }, { status: 500 });
  const db = createClient(config.url, config.key, { auth: { persistSession: false } });

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: tok } = await db.from("api_tokens").select("id, active").eq("token_hash", tokenHash).maybeSingle();
  if (!tok || !tok.active) return NextResponse.json({ ok: false, reason: "Token invalide." }, { status: 403 });

  const { data, error } = await db.from("clients").select("customer_code").order("customer_code");
  if (error) return NextResponse.json({ ok: false, reason: "Lecture des clients impossible." }, { status: 500 });
  const codes = Array.from(new Set((data ?? [])
    .map((row: { customer_code: string | null }) => String(row.customer_code ?? "").trim().toUpperCase())
    .filter((code) => /^MC-\d{3,}$/.test(code))));
  return NextResponse.json({ ok: true, codes });
}
