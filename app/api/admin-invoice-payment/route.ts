import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { parsePaymentAmount } from "@/lib/invoice-payable";
import { commitPaymentAllocations, PAYMENT_INVOICE_COLUMNS, PAYMENT_METHOD_SET, planPaymentAllocation, readInvoiceIds, safeJournal, type PaymentInvoice } from "@/lib/invoice-payment-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const text = (value: unknown) => String(value ?? "").trim();

/**
 * Paiement saisi par l'administrateur (client qui paie directement, Zelle…).
 * Le montant total remis par le client est réparti automatiquement sur ses
 * factures sélectionnées, de la plus ancienne à la plus récente.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`admin-invoice-payment:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    const config = getSupabaseAdminConfig();
    if (!config) return NextResponse.json({ ok: false, reason: "Service indisponible." }, { status: 503 });
    const body = await req.json().catch(() => null);
    const token = text(body?.token) || (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    const invoiceIds = readInvoiceIds(body, UUID);
    const amount = parsePaymentAmount(body?.amount);
    const currency = text(body?.currency).toUpperCase() as "USD" | "HTG";
    const method = text(body?.payment_method) || "Espèces";
    const reference = text(body?.payment_reference).slice(0, 120);
    if (!token) return NextResponse.json({ ok: false, reason: "Session expirée. Reconnectez-vous." }, { status: 401 });
    if (!invoiceIds) return NextResponse.json({ ok: false, reason: "Choisissez au moins une facture." }, { status: 400 });
    if (!["USD", "HTG"].includes(currency)) return NextResponse.json({ ok: false, reason: "Devise invalide." }, { status: 400 });
    if (amount === null || amount <= 0) return NextResponse.json({ ok: false, reason: "Entrez un montant valide." }, { status: 400 });
    if (!PAYMENT_METHOD_SET.has(method)) return NextResponse.json({ ok: false, reason: "Moyen de paiement invalide." }, { status: 400 });
    if ((currency === "USD" && amount > 100000) || (currency === "HTG" && amount > 50000000)) {
      return NextResponse.json({ ok: false, reason: "Montant trop élevé : vérifiez votre saisie." }, { status: 400 });
    }

    const db: any = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth } = await db.auth.getUser(token);
    if (!auth.user) return NextResponse.json({ ok: false, reason: "Session expirée. Reconnectez-vous." }, { status: 401 });
    const { data: staff } = await db.from("staff").select("id, username, prenom, nom, role")
      .eq("auth_user_id", auth.user.id).maybeSingle();
    if (!staff || staff.role !== "admin") return NextResponse.json({ ok: false, reason: "Accès administrateur requis." }, { status: 403 });

    const invoicesResult = await db.from("invoices").select(PAYMENT_INVOICE_COLUMNS).in("id", invoiceIds);
    if (invoicesResult.error) throw invoicesResult.error;
    const invoices = (invoicesResult.data ?? []) as PaymentInvoice[];
    if (invoices.length !== invoiceIds.length) return NextResponse.json({ ok: false, reason: "Facture introuvable. Actualisez la page." }, { status: 404 });
    if (new Set(invoices.map((invoice) => text(invoice.customer_code))).size > 1) {
      return NextResponse.json({ ok: false, reason: "Un paiement ne peut couvrir que les factures d'un seul client." }, { status: 400 });
    }
    const withoutPdf = invoices.find((invoice) => !invoice.has_pdf);
    if (withoutPdf) return NextResponse.json({ ok: false, reason: `Générez d'abord la facture ${withoutPdf.invoice_number} destinée au client.` }, { status: 409 });

    const plan = planPaymentAllocation(invoices, amount, currency);
    if (!plan.ok) return NextResponse.json({ ok: false, reason: plan.reason }, { status: 409 });

    const staffName = [text(staff.prenom), text(staff.nom)].filter(Boolean).join(" ") || text(staff.username) || "Administrateur";
    const committed = await commitPaymentAllocations(db, plan.allocations, {
      currency, method, reference, recorder: { staffId: staff.id, staffName, role: "admin" }
    });
    if (!committed.ok) return NextResponse.json({ ok: false, reason: committed.reason }, { status: committed.conflict ? 409 : 500 });

    const customerCode = text(invoices[0].customer_code);
    const numbers = committed.payments.map((payment) => payment.invoice_number).join(", ");
    await safeJournal(db, {
      user_name: `${staffName} (admin)`, action: "Paiement client reçu",
      details: `${numbers} · ${amount} ${currency} · ${method} · paiement direct admin`,
      package_ref: numbers.slice(0, 120), customer_code: customerCode,
      ip_address: clientIp(req),
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400)
    });

    const last = committed.payments[committed.payments.length - 1];
    return NextResponse.json({
      ok: true, currency,
      payments: committed.payments,
      payment_status: last?.payment_status ?? "",
      overpayment_amount: committed.payments.reduce((total, payment) => total + payment.overpayment_amount, 0)
    });
  } catch (error) {
    console.error("[admin-invoice-payment]", error);
    return NextResponse.json({ ok: false, reason: "Impossible d'enregistrer le paiement. Réessayez." }, { status: 500 });
  }
}
