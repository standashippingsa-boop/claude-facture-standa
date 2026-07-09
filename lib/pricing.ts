import { AccountType, Ville } from "./types";

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Règ espesyal: 0.01–0.99 lb = pri fiks (USD), pou TOUT kliyan. */
export const SMALL_PARCEL_MAX = 0.99;
export const DEFAULT_SMALL_PARCEL_PRICE = 3.7;

export interface PriceResult {
  price: number;          // USD
  tax: number;            // USD
  rule: "small" | "ville";
}

/**
 * Kalkil otomatik (USD):
 * 1) Si 0.01 <= pwa <= 0.99 lb  -> Prix = pri fiks ti koli (3.70 USD pa defo),
 *    kèlkeswa vil la ak tip kont lan. Tax = 0 (administratè a ka antre l manyèlman).
 * 2) Sinon -> tarif vil la dapre tip kont kliyan an:
 *    Personnel: Prix = Pwa × price_personal + fixed_fee ; Tax = Pwa × tax_personal
 *    Business : Prix = Pwa × price_business + fixed_fee ; Tax = Pwa × tax_business
 * Retounen null si (pou règ vil la) kliyan an pa gen vil aktif.
 */
export function computePrice(
  weight: number,
  accountType: AccountType,
  ville: Ville | null | undefined,
  smallParcelPrice: number = DEFAULT_SMALL_PARCEL_PRICE
): PriceResult | null {
  if (weight > 0 && weight <= SMALL_PARCEL_MAX) {
    return { price: round2(smallParcelPrice), tax: 0, rule: "small" };
  }
  if (!ville || !ville.active) return null;
  const perLb = accountType === "Business" ? Number(ville.price_business) : Number(ville.price_personal);
  const taxLb = accountType === "Business" ? Number(ville.tax_business) : Number(ville.tax_personal);
  return {
    price: round2(weight * perLb + Number(ville.fixed_fee || 0)),
    tax: round2(weight * taxLb),
    rule: "ville"
  };
}
