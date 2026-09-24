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

export const money = (value: unknown) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
};

/**
 * Lit un montant saisi dans les formats réellement utilisés par les clients
 * et les équipes: `8146,23`, `8 146,23`, `8,146.23` ou `8146.23`.
 *
 * Les écrans de paiement doivent tous passer ici. Ainsi, un séparateur de
 * milliers ou une virgule décimale ne peut plus se transformer en `NaN` et
 * être affiché à tort comme un dépassement de solde.
 */
export function parsePaymentAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? money(value) : null;
  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (!raw || !/^[\d\s\u00a0\u202f.,]+$/.test(raw)) return null;
  const compact = raw.replace(/[\s\u00a0\u202f]/g, "");
  if (!compact || !/\d/.test(compact)) return null;

  const commas = [...compact].filter((character) => character === ",").length;
  const dots = [...compact].filter((character) => character === ".").length;
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");

  let normalized = compact;
  if (commas && dots) {
    // Le dernier séparateur est le séparateur décimal: 8.146,23 et
    // 8,146.23 restent donc tous deux lisibles.
    const decimal = lastComma > lastDot ? "," : ".";
    const grouping = decimal === "," ? /\./g : /,/g;
    normalized = compact.replace(grouping, "").replace(decimal, ".");
  } else if (commas || dots) {
    const separator = commas ? "," : ".";
    const parts = compact.split(separator);
    if (parts.some((part) => !/^\d+$/.test(part))) return null;
    const last = parts.at(-1) ?? "";
    const groupsAreValid = parts.length > 1
      && parts[0].length >= 1
      && parts[0].length <= 3
      && parts.slice(1).every((part) => part.length === 3);

    if (last.length <= 2) {
      // Une ou deux décimales : 8146,23 ou 8.146,23.
      normalized = parts.slice(0, -1).join("") + "." + last;
    } else if (groupsAreValid) {
      // Séparateur de milliers seul : 8,146 ou 8.146.
      normalized = parts.join("");
    } else {
      return null;
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? money(parsed) : null;
}

/**
 * Une différence inférieure à 50 gourdes ne devient jamais un solde client.
 * Cette règle métier est utilisée par l'administration, les agents, l'espace
 * client et les routes serveur pour éviter que chaque écran interprète un
 * même paiement différemment.
 */
export const HTG_BALANCE_THRESHOLD = 50;
export const HTG_ROUNDING_MARGIN = HTG_BALANCE_THRESHOLD - 0.01;

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
  const computedBalance = Math.max(0, money(grandTotal - deposit));
  // Des factures créées avant l'ajout de `balance_due` peuvent avoir reçu la
  // valeur par défaut 0 malgré un total encore dû. Dans ce cas, le total moins
  // l'acompte reste la référence plutôt que de bloquer ou masquer le solde.
  const payableUsd = Math.max(0,
    explicitBalance === null || (explicitBalance === 0 && computedBalance > 0.009)
      ? computedBalance
      : explicitBalance
  );
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

/** Vrai uniquement si le reste atteint au moins 50 gourdes. */
export function hasSignificantInvoiceBalance(invoice: InvoicePayableSource) {
  const amounts = invoiceRemainingAmounts(invoice);
  // `total_htg` est normalement enregistré sur chaque facture. Le fallback
  // protège les anciennes factures USD qui ne l'auraient pas encore.
  const rate = Math.max(0, definedMoney(invoice.exchange_rate_used) ?? 0);
  const remainingHtg = amounts.remainingHtg > 0
    ? amounts.remainingHtg
    : money(amounts.remainingUsd * rate);
  return remainingHtg >= HTG_BALANCE_THRESHOLD;
}

/**
 * Accepte un léger excédent de caisse (< 50 HTG), sans créditer un montant
 * qui n'appartient pas à la facture. À 50 HTG ou plus, la saisie est refusée
 * afin d'éviter une erreur de montant.
 */
export function paymentIsWithinRoundingMargin(amountHtg: unknown, remainingHtg: unknown) {
  const amount = Number(amountHtg);
  const remaining = Number(remainingHtg);
  return Number.isFinite(amount)
    && Number.isFinite(remaining)
    && money(amount) <= money(remaining) + HTG_ROUNDING_MARGIN;
}

export function paymentStatusFromAmounts(invoice: InvoicePayableSource) {
  const amounts = invoiceRemainingAmounts(invoice);
  if (!hasSignificantInvoiceBalance(invoice)) return "Payé";
  if (amounts.paidUsd > 0.009 || amounts.paidHtg > 0.009) return "Payé partiel";
  return "Non payé";
}
