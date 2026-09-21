import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";

const text = (value: unknown) => String(value ?? "").trim();

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/**
 * Vue financière consolidée, réservée à l'administrateur.
 * Les chiffres sensibles ne transitent jamais directement par le navigateur
 * avec une clé privilégiée : ce point d'entrée valide la session et le rôle.
 */
export async function GET(req: Request) {
  const rl = rateLimit(`admin-financial-report:${clientIp(req)}`, 40, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    const config = getSupabaseAdminConfig();
    const token = bearerToken(req);
    if (!config) return NextResponse.json({ ok: false, reason: "Service indisponible." }, { status: 503 });
    if (!token) return NextResponse.json({ ok: false, reason: "Session requise." }, { status: 401 });

    const db: any = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth } = await db.auth.getUser(token);
    if (!auth.user) return NextResponse.json({ ok: false, reason: "Session invalide." }, { status: 401 });

    const staffResult = await db.from("staff").select("role").eq("auth_user_id", auth.user.id).maybeSingle();
    if (staffResult.data?.role !== "admin") {
      return NextResponse.json({ ok: false, reason: "Accès administrateur requis." }, { status: 403 });
    }

    const paymentColumns = "id, invoice_id, amount, currency, amount_usd, amount_htg, applied_usd, applied_htg, overpayment_amount, payment_method, payment_reference, received_by_name, received_by_staff_id, recorded_by_role, created_at";
    const [invoicesResult, initialPaymentsResult, clientsResult, villesResult, agentsResult] = await Promise.all([
      db.from("invoices").select("id, invoice_number, customer_code, grand_total, total_usd, total_htg, exchange_rate_used, order_deposit, balance_due, has_pdf, payment_status, payment_paid_usd, payment_paid_htg, created_at").order("created_at", { ascending: false }).limit(5000),
      // `settled_at` / `settled_by` viennent de supabase/20260920_report_settlement.sql.
      db.from("invoice_payments").select(paymentColumns + ", settled_at, settled_by").order("created_at", { ascending: false }).limit(5000),
      db.from("clients").select("customer_code, fullname, surname, ville_id").limit(5000),
      db.from("villes").select("id, name, active").order("name", { ascending: true }),
      // Zone de chaque point de retrait : sert à rattacher un paiement à sa ville
      // (y compris pour le compte central, qui n'a pas de ville client).
      db.from("staff").select("id, pickup_ville_id").eq("role", "agent_retrait")
    ]);
    let paymentsResult = initialPaymentsResult;
    let settlementReady = true;
    if (paymentsResult.error && /settled_(at|by)/i.test(String(paymentsResult.error.message ?? ""))) {
      // Le site reste utilisable avant l'exécution de la migration de clôture.
      settlementReady = false;
      paymentsResult = await db.from("invoice_payments").select(paymentColumns).order("created_at", { ascending: false }).limit(5000);
    }
    for (const result of [invoicesResult, paymentsResult, clientsResult, villesResult, agentsResult]) {
      if (result.error) throw result.error;
    }

    return NextResponse.json({
      ok: true,
      invoices: invoicesResult.data ?? [],
      payments: paymentsResult.data ?? [],
      clients: clientsResult.data ?? [],
      villes: villesResult.data ?? [],
      agents: agentsResult.data ?? [],
      settlement_ready: settlementReady
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[admin-financial-report]", error);
    return NextResponse.json({ ok: false, reason: "Rapport financier indisponible." }, { status: 500 });
  }
}
