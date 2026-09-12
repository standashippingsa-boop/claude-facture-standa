import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";

const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const text = (value: unknown) => String(value ?? "").trim();

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function receiptNumber(paymentId: string, createdAt: string) {
  const day = String(createdAt || "").slice(0, 10).replaceAll("-", "") || "PAIEMENT";
  return `RC-${day}-${paymentId.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

/** Reçu consultable et imprimable, protégé pour l'admin et l'agent concerné. */
export async function GET(req: Request) {
  const rl = rateLimit(`payment-receipt:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    const config = getSupabaseAdminConfig();
    const token = bearerToken(req);
    const paymentId = text(new URL(req.url).searchParams.get("id"));
    if (!config) return NextResponse.json({ ok: false, reason: "Service indisponible." }, { status: 503 });
    if (!token) return NextResponse.json({ ok: false, reason: "Session requise." }, { status: 401 });
    if (!UUID.test(paymentId)) return NextResponse.json({ ok: false, reason: "Identifiant de reçu invalide." }, { status: 400 });

    const db: any = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth } = await db.auth.getUser(token);
    if (!auth.user) return NextResponse.json({ ok: false, reason: "Session invalide." }, { status: 401 });
    const staffResult = await db.from("staff").select("role, pickup_ville_id").eq("auth_user_id", auth.user.id).maybeSingle();
    const staff = staffResult.data as { role?: string; pickup_ville_id?: string | null } | null;
    if (!staff || !["admin", "agent_retrait"].includes(text(staff.role))) {
      return NextResponse.json({ ok: false, reason: "Accès non autorisé." }, { status: 403 });
    }

    const paymentResult = await db.from("invoice_payments")
      .select("id, invoice_id, amount, currency, amount_usd, amount_htg, applied_usd, applied_htg, overpayment_amount, payment_method, payment_reference, exchange_rate_used, received_by_name, recorded_by_role, created_at")
      .eq("id", paymentId).maybeSingle();
    const payment = paymentResult.data;
    if (paymentResult.error) throw paymentResult.error;
    if (!payment) return NextResponse.json({ ok: false, reason: "Paiement introuvable." }, { status: 404 });

    const invoiceResult = await db.from("invoices")
      .select("id, invoice_number, customer_code, total_usd, total_htg, grand_total, order_deposit, balance_due, payment_status")
      .eq("id", payment.invoice_id).maybeSingle();
    const invoice = invoiceResult.data;
    if (invoiceResult.error) throw invoiceResult.error;
    if (!invoice) return NextResponse.json({ ok: false, reason: "Facture introuvable." }, { status: 404 });

    const customerResult = await db.from("clients").select("customer_code, fullname, surname, ville_id").eq("customer_code", invoice.customer_code).maybeSingle();
    const customer = customerResult.data;
    if (customerResult.error) throw customerResult.error;
    if (staff.role === "agent_retrait" && (!staff.pickup_ville_id || customer?.ville_id !== staff.pickup_ville_id)) {
      return NextResponse.json({ ok: false, reason: "Ce reçu ne fait pas partie de votre point de retrait." }, { status: 403 });
    }

    const cityResult = customer?.ville_id ? await db.from("villes").select("name").eq("id", customer.ville_id).maybeSingle() : { data: null, error: null };
    if (cityResult.error) throw cityResult.error;

    return NextResponse.json({
      ok: true,
      receipt_number: receiptNumber(payment.id, payment.created_at),
      payment,
      invoice,
      customer: {
        code: text(customer?.customer_code) || text(invoice.customer_code),
        name: [text(customer?.fullname), text(customer?.surname)].filter(Boolean).join(" "),
        city: text(cityResult.data?.name)
      }
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[payment-receipt]", error);
    return NextResponse.json({ ok: false, reason: "Reçu indisponible." }, { status: 500 });
  }
}
