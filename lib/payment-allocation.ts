/**
 * Répartition d'un paiement sur plusieurs factures d'un même client — calcul
 * PUR, partagé par les écrans (aperçu avant confirmation) et les routes
 * serveur (lib/invoice-payment-server.ts). Un seul calcul : l'aperçu affiché
 * au caissier est exactement ce que le serveur enregistrera.
 */
import { invoicePayableAmounts, money, paymentIsWithinRoundingMargin, paymentStatusFromAmounts } from "@/lib/invoice-payable";

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
