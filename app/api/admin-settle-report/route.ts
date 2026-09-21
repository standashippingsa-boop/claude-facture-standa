import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";

const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const MAX_PAYMENTS = 3000;
const CHUNK = 100;
const text = (value: unknown) => String(value ?? "").trim();
const money = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100;

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/**
 * Clôture du rapport d'un point de retrait, réservée à l'administrateur.
 *
 * Quand les agents ont remis l'argent des clients à l'administration, les
 * paiements qu'ils ont encaissés reçoivent une date `settled_at` : ils sortent
 * du rapport (agent et admin) sans JAMAIS être supprimés. Le paiement, son reçu
 * et le solde des clients restent intacts ; les clients avec un solde restent
 * donc dans la liste des soldes.
 *
 * L'administrateur clôture exactement les paiements qu'il a vus à l'écran
 * (`payment_ids`) : un paiement encaissé par l'agent après l'affichage n'est
 * pas clôturé à son insu. Seuls les paiements encore ouverts et encaissés par
 * un point de retrait sont modifiés.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`admin-settle-report:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    const config = getSupabaseAdminConfig();
    if (!config) return NextResponse.json({ ok: false, reason: "Service indisponible." }, { status: 503 });
    const token = bearerToken(req);
    if (!token) return NextResponse.json({ ok: false, reason: "Session requise." }, { status: 401 });

    const body = await req.json().catch(() => null);
    const rawIds: unknown[] = Array.isArray(body?.payment_ids) ? body.payment_ids : [];
    const paymentIds = Array.from(new Set(rawIds.map(text).filter((id) => UUID.test(id))));
    if (!paymentIds.length || paymentIds.length !== rawIds.length || paymentIds.length > MAX_PAYMENTS) {
      return NextResponse.json({ ok: false, reason: "Aucun paiement valide à clôturer." }, { status: 400 });
    }
    const cityName = text(body?.ville_name).slice(0, 80);

    const db: any = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth } = await db.auth.getUser(token);
    if (!auth.user) return NextResponse.json({ ok: false, reason: "Session invalide." }, { status: 401 });
    const { data: staff } = await db.from("staff").select("id, username, prenom, nom, role")
      .eq("auth_user_id", auth.user.id).maybeSingle();
    if (!staff || staff.role !== "admin") return NextResponse.json({ ok: false, reason: "Accès administrateur requis." }, { status: 403 });
    const staffName = [staff.prenom, staff.nom].filter(Boolean).join(" ") || staff.username;

    const settledAt = new Date().toISOString();
    let count = 0;
    let usd = 0;
    let htg = 0;
    for (let start = 0; start < paymentIds.length; start += CHUNK) {
      const result = await db.from("invoice_payments")
        .update({ settled_at: settledAt, settled_by: staffName })
        .in("id", paymentIds.slice(start, start + CHUNK))
        .eq("recorded_by_role", "agent_retrait")
        .is("settled_at", null)
        .select("id, amount, currency");
      if (result.error) {
        if (/settled_(at|by)/i.test(String(result.error.message ?? ""))) {
          return NextResponse.json({ ok: false, reason: "Exécutez d'abord supabase/20260920_report_settlement.sql dans Supabase (SQL Editor)." }, { status: 409 });
        }
        throw result.error;
      }
      for (const row of (result.data ?? []) as Array<{ amount: number | null; currency: string | null }>) {
        count += 1;
        if (text(row.currency).toUpperCase() === "USD") usd = money(usd + money(row.amount));
        else htg = money(htg + money(row.amount));
      }
    }

    const xff = req.headers.get("x-forwarded-for") ?? "";
    await db.from("journal").insert({
      user_name: `${staffName} (admin)`, action: "Rapport clôturé",
      details: `${count} paiement(s) de point de retrait clôturés${cityName ? ` · ${cityName}` : ""} · ${usd.toFixed(2)} USD · ${htg.toFixed(2)} HTG`,
      package_ref: "", customer_code: "",
      ip_address: (xff.split(",")[0] || req.headers.get("x-real-ip") || "").trim(),
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400)
    }).catch(() => null);

    return NextResponse.json({ ok: true, settled: count, total_usd: usd, total_htg: htg });
  } catch (error) {
    console.error("[admin-settle-report]", error);
    return NextResponse.json({ ok: false, reason: "Impossible de clôturer le rapport." }, { status: 500 });
  }
}
