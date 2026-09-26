/**
 * PWOGRAM AFFILIATION — kondisyon peman (menm valè ak kontra PDF la, atik 6).
 * Komisyon yo kalkile an USD men yo peye SÈLMAN an goud, a to fiks sa a,
 * pa MonCash oswa NatCash. Si to a chanje, fò kontra PDF la chanje tou.
 */
export const AFFILIATE_PAYOUT_RATE_HTG = 132.5;
export const AFFILIATE_PAYOUT_METHODS = ["MonCash", "NatCash"] as const;
export type AffiliatePayoutMethod = typeof AFFILIATE_PAYOUT_METHODS[number];

export const toPayoutHtg = (usd: number) => Math.round(Number(usd || 0) * AFFILIATE_PAYOUT_RATE_HTG * 100) / 100;

export const formatHtg = (value: number) =>
  `${new Intl.NumberFormat("fr-HT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))} HTG`;

/** Kontra siyen: PDF (eskane) oswa foto. Limit = bucket affiliate-contracts. */
export const SIGNED_CONTRACT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};
export const SIGNED_CONTRACT_MAX_BYTES = 15 * 1024 * 1024;
