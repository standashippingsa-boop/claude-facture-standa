import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";

const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const METHODS = new Set(["Espèces", "MonCash", "NatCash", "Zelle", "Virement bancaire"]);
const money = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100;
const text = (value: unknown) => String(value ?? "").trim();

/** Paiement saisi par l'administrateur (ex: client qui paie directement). */
export async function POST(req: Request) {
  const rl = rateLimit(`admin-invoice-payment:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    const config = getSupabaseAdminConfig();
    if (!config) return NextResponse.json({ ok: false, reason: "Service indisponible." }, { status: 503 });
    const body = await req.json().catch(() => null);
    const token = text(body?.token);
    const invoiceId = text(body?.invoice_id);
    const amount = money(body?.amount);
    const currency = text(body?.currency).toUpperCase();
    const method = text(body?.payment_method) || "Espèces";
    const reference = text(body?.payment_reference).slice(0, 120);
    if (!token || !UUID.test(invoiceId) || !["USD", "HTG"].includes(currency) || amount <= 0 || !METHODS.has(method)) {
      return NextResponse.json({ ok: false, reason: "Informations de paiement invalides." }, { status: 400 });
    }

    const db: any = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth } = await db.auth.getUser(token);
    if (!auth.user) return NextResponse.json({ ok: false, reason: "Session invalide." }, { status: 401 });
    const { data: staff } = await db.from("staff").select("id, username, prenom, nom, role")
      .eq("auth_user_id", auth.user.id).maybeSingle();
    if (!staff || staff.role !== "admin") return NextResponse.json({ ok: false, reason: "Accès administrateur requis." }, { status: 403 });

    const { data: invoice } = await db.from("invoices")
      .select("id, invoice_number, customer_code, total_usd, total_htg, exchange_rate_used, payment_paid_usd, payment_paid_htg")
      .eq("id", invoiceId).maybeSingle();
    if (!invoice) return NextResponse.json({ ok: false, reason: "Facture introuvable." }, { status: 404 });
    const rate = Number(invoice.exchange_rate_used) > 0 ? Number(invoice.exchange_rate_used) : Number(invoice.total_htg) / Math.max(Number(invoice.total_usd), 1);
    if (!Number.isFinite(rate) || rate <= 0) return NextResponse.json({ ok: false, reason: "Taux de la facture introuvable." }, { status: 409 });

    const amountUsd = currency === "USD" ? amount : money(amount / rate);
    const amountHtg = currency === "HTG" ? amount : money(amount * rate);
    const priorUsd = money(invoice.payment_paid_usd);
    const priorHtg = money(invoice.payment_paid_htg);
    const remainingUsd = Math.max(0, money(Number(invoice.total_usd) - priorUsd));
    const remainingHtg = Math.max(0, money(Number(invoice.total_htg) - priorHtg));
    const toleranceUsd = currency === "HTG" ? Math.max(0.05, money(5 / rate)) : 0.05;
    if (amountUsd > remainingUsd + toleranceUsd) {
      return NextResponse.json({ ok: false, reason: `Le montant dépasse le reste à payer (${remainingUsd.toFixed(2)} USD).` }, { status: 409 });
    }

    const appliedUsd = Math.min(amountUsd, remainingUsd);
    const appliedHtg = Math.min(amountHtg, remainingHtg);
    const overpaymentAmount = money(currency === "HTG" ? amount - appliedHtg : amount - appliedUsd);
    const newUsd = money(priorUsd + appliedUsd);
    const newHtg = money(priorHtg + appliedHtg);
    const status = newUsd + 0.01 >= money(invoice.total_usd) ? "Payé" : "Payé partiel";
    const staffName = [text(staff.prenom), text(staff.nom)].filter(Boolean).join(" ") || text(staff.username) || "Administrateur";

    const payment = await db.from("invoice_payments").insert({
      invoice_id: invoice.id, amount, currency, amount_usd: amountUsd, amount_htg: amountHtg,
      applied_usd: appliedUsd, applied_htg: appliedHtg, overpayment_amount: overpaymentAmount,
      payment_method: method, payment_reference: reference, exchange_rate_used: rate,
      received_by_staff_id: staff.id, received_by_name: staffName, recorded_by_role: "admin"
    }).select("id").single();
    if (payment.error || !payment.data?.id) throw payment.error ?? new Error("Paiement non enregistré.");

    const update = await db.from("invoices").update({
      payment_status: status, payment_paid_usd: newUsd, payment_paid_htg: newHtg,
      payment_paid_at: status === "Payé" ? new Date().toISOString() : null,
      payment_paid_by: status === "Payé" ? staffName : null
    }).eq("id", invoice.id).eq("payment_paid_usd", priorUsd).select("id").maybeSingle();
    if (update.error || !update.data) {
      await db.from("invoice_payments").delete().eq("id", payment.data.id);
      if (update.error) throw update.error;
      return NextResponse.json({ ok: false, reason: "Le solde a changé. Actualisez avant d'enregistrer le paiement." }, { status: 409 });
    }

    const xff = req.headers.get("x-forwarded-for") ?? "";
    await db.from("journal").insert({
      user_name: `${staffName} (admin)`, action: "Paiement client reçu",
      details: `${invoice.invoice_number} · ${amount} ${currency} · ${method} · paiement direct admin`,
      package_ref: invoice.invoice_number, customer_code: invoice.customer_code,
      ip_address: (xff.split(",")[0] || req.headers.get("x-real-ip") || "").trim(),
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400)
    }).catch(() => null);

    return NextResponse.json({ ok: true, payment_status: status, overpayment_amount: overpaymentAmount, currency });
  } catch (error) {
    console.error("[admin-invoice-payment]", error);
    return NextResponse.json({ ok: false, reason: "Impossible d'enregistrer le paiement." }, { status: 500 });
  }
}
