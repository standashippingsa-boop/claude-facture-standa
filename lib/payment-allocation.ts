/**
 * Répartition d'un paiement sur plusieurs factures d'un même client — calcul
 * PUR, partagé par les écrans (aperçu avant confirmation) et les routes
 * serveur (lib/invoice-payment-server.ts). Un seul calcul : l'aperçu affiché
 * au caissier est exactement ce que le serveur enregistrera.
 */
import { hasSignificantInvoiceBalance, invoicePayableAmounts, money, paymentIsWithinRoundingMargin, paymentStatusFromAmounts } from "@/lib/invoice-payable";

export const PAYMENT_METHODS = ["Espèces", "MonCash", "NatCash", "Zelle", "Virement bancaire"] as const;
export const PAYMENT_METHOD_SET = new Set<string>(PAYMENT_METHODS);

export const PAYMENT_INVOICE_COLUMNS = "id, invoice_number, customer_code, grand_total, total_usd, total_htg, exchange_rate_used, order_deposit, balance_due, has_pdf, payment_paid_usd, payment_paid_htg, created_at";

export type PaymentInvoice = {
  id: string; invoice_number: string; customer_code: string;
  grand_total: number | null; total_usd: number | null; total_htg: number | null; exchange_rate_used: number | null;
  order_deposit: number | null; balance_due: number | null; has_pdf: boolean | null;
  payment_paid_usd: number | null; payment_paid_htg: number | null; created_at: string | null;
};

export type PaymentAllocation = {
  invoice: PaymentInvoice; rate: number;
  amount: number; amountUsd: number; amountHtg: number;
  appliedUsd: number; appliedHtg: number; overpayment: number;
  priorUsd: number; priorHtg: number; newUsd: number; newHtg: number; status: string;
};

/**
 * Une LIGNE de paiement : un montant, une devise, un moyen. Un client peut
 * régler en plusieurs lignes (ex. 5 000 HTG en espèces + le reste en USD par
 * Zelle) : chaque ligne devient sa propre écriture `invoice_payments`.
 */
export type PaymentLine = { amount: number; currency: "USD" | "HTG"; method: string; reference: string };
export const MAX_PAYMENT_LINES = 6;

export type LinesPlan =
  | { ok: true; allocations: Array<PaymentAllocation & { line: PaymentLine }>; dueUsd: number; dueHtg: number; remainingUsd: number; remainingHtg: number }
  | { ok: false; reason: string };

export type AllocationPlan =
  | { ok: true; allocations: PaymentAllocation[]; dueUsd: number; dueHtg: number }
  | { ok: false; reason: string };

function invoiceRate(invoice: PaymentInvoice) {
  const payable = invoicePayableAmounts(invoice);
  const stored = Number(invoice.exchange_rate_used);
  return stored > 0 ? stored : payable.payableHtg / Math.max(payable.payableUsd, 1);
}

/** Répartit `amount` (dans `currency`) sur les factures, de la plus ancienne à la plus récente. */
export function planPaymentAllocation(invoices: PaymentInvoice[], amount: number, currency: "USD" | "HTG"): AllocationPlan {
  const ordered = [...invoices].sort((left, right) => String(left.created_at ?? "").localeCompare(String(right.created_at ?? "")) || left.invoice_number.localeCompare(right.invoice_number));
  const due = ordered.map((invoice) => {
    const payable = invoicePayableAmounts(invoice);
    const priorUsd = money(invoice.payment_paid_usd);
    const priorHtg = money(invoice.payment_paid_htg);
    return {
      invoice, rate: invoiceRate(invoice), priorUsd, priorHtg,
      remainingUsd: Math.max(0, money(payable.payableUsd - priorUsd)),
      remainingHtg: Math.max(0, money(payable.payableHtg - priorHtg))
    };
  }).filter((row) => row.remainingUsd > 0.009 || row.remainingHtg > 0.009);

  if (!due.length) return { ok: false, reason: "Ces factures sont déjà réglées." };
  const badRate = due.find((row) => !Number.isFinite(row.rate) || row.rate <= 0);
  if (badRate) return { ok: false, reason: `Taux de la facture ${badRate.invoice.invoice_number} introuvable. Contactez un administrateur.` };

  const dueUsd = money(due.reduce((total, row) => total + row.remainingUsd, 0));
  const dueHtg = money(due.reduce((total, row) => total + row.remainingHtg, 0));
  const allocations: PaymentAllocation[] = [];
  let left = money(amount);

  for (let index = 0; index < due.length && left > 0.009; index++) {
    const row = due[index];
    const isLast = index === due.length - 1;
    const remainingInCurrency = currency === "HTG" ? row.remainingHtg : row.remainingUsd;
    // La dernière facture absorbe un léger arrondi (< 50 HTG) ; au-delà, refus.
    const take = isLast ? left : Math.min(left, remainingInCurrency);
    const takeHtg = currency === "HTG" ? take : money(take * row.rate);
    if (isLast && !paymentIsWithinRoundingMargin(takeHtg, row.remainingHtg)) {
      return { ok: false, reason: `Le montant dépasse le total dû : ${dueUsd.toFixed(2)} USD · ${new Intl.NumberFormat("fr-HT", { maximumFractionDigits: 2 }).format(dueHtg)} HTG.` };
    }
    const amountUsd = currency === "USD" ? take : money(take / row.rate);
    const amountHtg = currency === "HTG" ? take : money(take * row.rate);
    const appliedUsd = Math.min(amountUsd, row.remainingUsd);
    const appliedHtg = Math.min(amountHtg, row.remainingHtg);
    const newUsd = money(row.priorUsd + appliedUsd);
    const newHtg = money(row.priorHtg + appliedHtg);
    allocations.push({
      invoice: row.invoice, rate: row.rate, amount: money(take), amountUsd, amountHtg, appliedUsd, appliedHtg,
      overpayment: money(currency === "HTG" ? take - appliedHtg : take - appliedUsd),
      priorUsd: row.priorUsd, priorHtg: row.priorHtg, newUsd, newHtg,
      status: paymentStatusFromAmounts({ ...row.invoice, payment_paid_usd: newUsd, payment_paid_htg: newHtg })
    });
    left = money(left - take);
  }
  return { ok: true, allocations, dueUsd, dueHtg };
}

/** Solde encore dû (USD et HTG) sur un ensemble de factures. */
export function outstandingOf(invoices: PaymentInvoice[]) {
  let usd = 0, htg = 0;
  for (const invoice of invoices) {
    if (!hasSignificantInvoiceBalance(invoice)) continue;
    const payable = invoicePayableAmounts(invoice);
    usd += Math.max(0, money(payable.payableUsd - money(invoice.payment_paid_usd)));
    htg += Math.max(0, money(payable.payableHtg - money(invoice.payment_paid_htg)));
  }
  return { usd: money(usd), htg: money(htg) };
}

/**
 * Répartit PLUSIEURS lignes de paiement, l'une après l'autre : chaque ligne
 * voit le solde laissé par les précédentes. Tout est validé AVANT la moindre
 * écriture — si une ligne est refusée, rien n'est enregistré.
 */
export function planPaymentLines(invoices: PaymentInvoice[], lines: PaymentLine[]): LinesPlan {
  if (!lines.length) return { ok: false, reason: "Ajoutez au moins un montant." };
  if (lines.length > MAX_PAYMENT_LINES) return { ok: false, reason: `Pas plus de ${MAX_PAYMENT_LINES} moyens de paiement à la fois.` };
  const due = outstandingOf(invoices);
  const label = (index: number) => lines.length > 1 ? `Ligne ${index + 1} : ` : "";
  let current = invoices.map((invoice) => ({ ...invoice }));
  const allocations: Array<PaymentAllocation & { line: PaymentLine }> = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    // Une facture soldée par les lignes précédentes (reste < 50 HTG) ne reçoit plus rien.
    const open = current.filter((invoice) => hasSignificantInvoiceBalance(invoice));
    if (!open.length) {
      return { ok: false, reason: index === 0 ? "Ces factures sont déjà réglées." : `${label(index)}les montants précédents couvrent déjà tout le solde. Retirez cette ligne.` };
    }
    const plan = planPaymentAllocation(open, line.amount, line.currency);
    if (!plan.ok) return { ok: false, reason: label(index) + plan.reason };
    for (const allocation of plan.allocations) {
      allocations.push({ ...allocation, line });
      current = current.map((invoice) => invoice.id === allocation.invoice.id
        ? { ...invoice, payment_paid_usd: allocation.newUsd, payment_paid_htg: allocation.newHtg }
        : invoice);
    }
  }
  const remaining = outstandingOf(current);
  return { ok: true, allocations, dueUsd: due.usd, dueHtg: due.htg, remainingUsd: remaining.usd, remainingHtg: remaining.htg };
}

/** Dernier statut de chaque facture après un paiement (une facture peut recevoir plusieurs lignes). */
export function invoiceStatusLines(payments: Array<{ invoice_number: string; payment_status: string }>): string {
  const last = new Map<string, string>();
  for (const payment of payments) last.set(payment.invoice_number, payment.payment_status);
  return Array.from(last.entries()).map(([number, status]) => `${number} : ${status}`).join("\n");
}
