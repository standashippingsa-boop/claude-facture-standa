/**
 * Montants de caisse d'une facture.
 *
 * Le PDF est la référence remise au client : pour une facture de commande
 * avec acompte, il affiche le total puis le solde restant. La caisse ne doit
 * encaisser que ce solde. Ce module est partagé par les écrans et les routes
 * serveur afin qu'aucun calcul parallèle ne puisse diverger du PDF.
 */
export type InvoicePayableSource = {
  grand_total?: unknown;
  total_usd?: unknown;
  total_htg?: unknown;
  exchange_rate_used?: unknown;
  order_deposit?: unknown;
  balance_due?: unknown;
  payment_paid_usd?: unknown;
  payment_paid_htg?: unknown;
};

export const money = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100;

function definedMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? money(amount) : null;
}

/** Retounen egzak montan kliyan an dwe peye, menm jan PDF la prezante li. */
export function invoicePayableAmounts(invoice: InvoicePayableSource) {
  const grandTotal = definedMoney(invoice.grand_total) ?? definedMoney(invoice.total_usd) ?? 0;
  const deposit = Math.max(0, definedMoney(invoice.order_deposit) ?? 0);
  const explicitBalance = definedMoney(invoice.balance_due);
  const payableUsd = Math.max(0, explicitBalance ?? money(grandTotal - deposit));
  const rate = Math.max(0, definedMoney(invoice.exchange_rate_used) ?? 0);
  // Menm fallback ak lib/pdf.ts: total_htg estoke a deja se balans HTG a.
  const storedHtg = definedMoney(invoice.total_htg);
  const payableHtg = storedHtg !== null && storedHtg !== 0
    ? Math.max(0, storedHtg)
    : money(payableUsd * rate);

  return {
    grandTotalUsd: grandTotal,
    depositUsd: deposit,
    payableUsd,
    payableHtg,
    hasDeposit: deposit > 0
  };
}

export function invoiceRemainingAmounts(invoice: InvoicePayableSource) {
  const amounts = invoicePayableAmounts(invoice);
  return {
    ...amounts,
    paidUsd: Math.max(0, money(invoice.payment_paid_usd)),
    paidHtg: Math.max(0, money(invoice.payment_paid_htg)),
    remainingUsd: Math.max(0, money(amounts.payableUsd - money(invoice.payment_paid_usd))),
    remainingHtg: Math.max(0, money(amounts.payableHtg - money(invoice.payment_paid_htg)))
  };
}

export function paymentStatusFromAmounts(invoice: InvoicePayableSource) {
  const amounts = invoiceRemainingAmounts(invoice);
  if (amounts.remainingUsd <= 0.01) return "Payé";
  if (amounts.paidUsd > 0.009 || amounts.paidHtg > 0.009) return "Payé partiel";
  return "Non payé";
}
