/**
 * Encaissement d'un paiement sur UNE ou PLUSIEURS factures d'un même client.
 *
 * Le caissier (administration ou point de retrait) saisit le montant total
 * remis par le client ; le serveur le répartit lui-même, de la facture la plus
 * ancienne à la plus récente. Chaque facture reçoit sa propre ligne
 * `invoice_payments` (donc son propre reçu) et son statut est recalculé.
 *
 * Module serveur uniquement : il reçoit le client Supabase « service » créé
 * par la route après la vérification de la session et du rôle.
 */
import { parsePaymentAmount, paymentStatusFromAmounts } from "@/lib/invoice-payable";
import { MAX_PAYMENT_LINES, PAYMENT_METHOD_SET, type PaymentAllocation, type PaymentLine } from "@/lib/payment-allocation";

export { PAYMENT_INVOICE_COLUMNS, PAYMENT_METHOD_SET, PAYMENT_METHODS, planPaymentAllocation, planPaymentLines } from "@/lib/payment-allocation";
export type { PaymentAllocation, PaymentInvoice, PaymentLine } from "@/lib/payment-allocation";

export type PaymentRecorder = { staffId: string; staffName: string; role: "admin" | "agent_retrait" };
export type CommittedPayment = { payment_id: string; invoice_id: string; invoice_number: string; amount: number; currency: "USD" | "HTG"; method: string; payment_status: string; overpayment_amount: number };

/**
 * Écrit chaque part : ligne de paiement puis mise à jour optimiste de la
 * facture (le solde ne doit pas avoir changé depuis la lecture). Si une étape
 * échoue, tout ce qui a été écrit dans cet appel est annulé.
 */
export async function commitPaymentAllocations(
  db: any, allocations: Array<PaymentAllocation & { line: PaymentLine }>,
  meta: { recorder: PaymentRecorder }
): Promise<{ ok: true; payments: CommittedPayment[] } | { ok: false; conflict: boolean; reason: string }> {
  const done: Array<{ allocation: PaymentAllocation & { line: PaymentLine }; paymentId: string }> = [];
  const rollback = async () => {
    for (const { allocation, paymentId } of done.reverse()) {
      await db.from("invoices").update({
        payment_status: paymentStatusFromAmounts(allocation.invoice), payment_paid_usd: allocation.priorUsd, payment_paid_htg: allocation.priorHtg,
        payment_paid_at: null, payment_paid_by: null
      }).eq("id", allocation.invoice.id).eq("payment_paid_usd", allocation.newUsd);
      await db.from("invoice_payments").delete().eq("id", paymentId);
    }
  };

  for (const allocation of allocations) {
    const payment = await db.from("invoice_payments").insert({
      invoice_id: allocation.invoice.id, amount: allocation.amount, currency: allocation.line.currency,
      amount_usd: allocation.amountUsd, amount_htg: allocation.amountHtg,
      applied_usd: allocation.appliedUsd, applied_htg: allocation.appliedHtg, overpayment_amount: allocation.overpayment,
      payment_method: allocation.line.method, payment_reference: allocation.line.reference, exchange_rate_used: allocation.rate,
      received_by_staff_id: meta.recorder.staffId, received_by_name: meta.recorder.staffName, recorded_by_role: meta.recorder.role
    }).select("id").single();
    if (payment.error || !payment.data?.id) {
      console.error("[invoice-payment] insert", payment.error);
      await rollback();
      return { ok: false, conflict: false, reason: `Paiement non enregistré sur ${allocation.invoice.invoice_number}${payment.error?.message ? ` : ${payment.error.message}` : "."}` };
    }
    const update = await db.from("invoices").update({
      payment_status: allocation.status, payment_paid_usd: allocation.newUsd, payment_paid_htg: allocation.newHtg,
      payment_paid_at: allocation.status === "Payé" ? new Date().toISOString() : null,
      payment_paid_by: allocation.status === "Payé" ? meta.recorder.staffName : null
    }).eq("id", allocation.invoice.id).eq("payment_paid_usd", allocation.priorUsd).select("id").maybeSingle();
    if (update.error || !update.data) {
      if (update.error) console.error("[invoice-payment] update", update.error);
      await db.from("invoice_payments").delete().eq("id", payment.data.id);
      await rollback();
      return update.error
        ? { ok: false, conflict: false, reason: `Facture ${allocation.invoice.invoice_number} non mise à jour : ${update.error.message ?? "erreur inconnue"}` }
        : { ok: false, conflict: true, reason: "Le solde vient de changer sur un autre appareil. Actualisez puis recommencez." };
    }
    done.push({ allocation, paymentId: payment.data.id });
  }

  return {
    ok: true,
    payments: done.map(({ allocation, paymentId }) => ({
      payment_id: paymentId, invoice_id: allocation.invoice.id, invoice_number: allocation.invoice.invoice_number,
      amount: allocation.amount, currency: allocation.line.currency, method: allocation.line.method,
      payment_status: allocation.status, overpayment_amount: allocation.overpayment
    }))
  };
}

/**
 * Lit les lignes de paiement envoyées par l'écran : `lines: [{ amount,
 * currency, payment_method, payment_reference }]`. L'ancien format (un seul
 * montant à la racine) reste accepté. Tout est validé ici, côté serveur.
 */
export function readPaymentLines(body: any): { ok: true; lines: PaymentLine[] } | { ok: false; reason: string } {
  const raw: any[] = Array.isArray(body?.lines) && body.lines.length ? body.lines : [body];
  if (raw.length > MAX_PAYMENT_LINES) return { ok: false, reason: `Pas plus de ${MAX_PAYMENT_LINES} moyens de paiement à la fois.` };
  const lines: PaymentLine[] = [];
  for (let index = 0; index < raw.length; index++) {
    const row = raw[index] ?? {};
    const label = raw.length > 1 ? `Ligne ${index + 1} : ` : "";
    const amount = parsePaymentAmount(row.amount);
    const currency = String(row.currency ?? "").trim().toUpperCase();
    const method = String(row.payment_method ?? row.method ?? "").trim();
    const reference = String(row.payment_reference ?? row.reference ?? "").trim().slice(0, 120);
    if (amount === null || amount <= 0) return { ok: false, reason: label + "entrez un montant valide." };
    if (currency !== "USD" && currency !== "HTG") return { ok: false, reason: label + "devise invalide." };
    if (!PAYMENT_METHOD_SET.has(method)) return { ok: false, reason: label + "choisissez le moyen de paiement." };
    if ((currency === "USD" && amount > 100000) || (currency === "HTG" && amount > 50000000)) {
      return { ok: false, reason: label + "montant trop élevé : vérifiez votre saisie." };
    }
    lines.push({ amount, currency, method, reference });
  }
  return { ok: true, lines };
}

/** « 5000 HTG Espèces + 62.12 USD Zelle » — pour le journal. */
export function describePaymentLines(lines: PaymentLine[]) {
  return lines.map((line) => `${line.amount} ${line.currency} ${line.method}`).join(" + ");
}

/** Lit la liste d'identifiants de factures envoyée par l'écran (ancien champ `invoice_id` accepté). */
export function readInvoiceIds(body: any, uuid: RegExp) {
  const raw: unknown[] = Array.isArray(body?.invoice_ids) ? body.invoice_ids : body?.invoice_id ? [body.invoice_id] : [];
  const ids = Array.from(new Set(raw.map((value) => String(value ?? "").trim())));
  if (!ids.length || ids.length > 50 || ids.some((id) => !uuid.test(id))) return null;
  return ids;
}

/** Journal : une panne d'écriture du journal ne doit jamais faire échouer un paiement déjà enregistré. */
export async function safeJournal(db: any, row: Record<string, unknown>) {
  try {
    const result = await db.from("journal").insert(row);
    if (result?.error) console.error("[invoice-payment] journal", result.error);
  } catch (error) {
    console.error("[invoice-payment] journal", error);
  }
}
