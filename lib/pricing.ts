import { AccountType, Ville } from "./types";

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Règ espesyal: 0.01–0.99 lb = pri fiks (USD), pou TOUT kliyan. */
export const SMALL_PARCEL_MAX = 0.99;
export const DEFAULT_SMALL_PARCEL_MIN = 0.1;
export const DEFAULT_SMALL_PARCEL_PRICE = 3.7;

/** Konfigirasyon ti koli (soti nan Paramètres — admin sèlman). */
export interface SmallParcelConfig {
  min: number;    // pwa minimòm (ex 0.10 lb)
  max: number;    // pwa maksimòm (ex 0.99 lb)
  price: number;  // pri fiks (ex 3.70 USD)
}
export const DEFAULT_SMALL_PARCEL: SmallParcelConfig = {
  min: DEFAULT_SMALL_PARCEL_MIN, max: SMALL_PARCEL_MAX, price: DEFAULT_SMALL_PARCEL_PRICE
};

/** Èske yon koli antre nan entèval ti koli a? */
export function isSmallParcel(weight: number, cfg: SmallParcelConfig): boolean {
  return weight >= cfg.min && weight <= cfg.max;
}

/**
 * Kalkil pri yon SÈL koli selon mòd la:
 *  - "addition"      : pwa × pri/lb (pri/lb PA JANM chanje/awondi)
 *  - "small_control" : si koli a nan entèval ti koli a -> pri fiks;
 *                      sinon pwa × pri/lb.
 * Retounen {price, isSmall}. Prix/LB itilize EGZAK (san awondi sou pri/lb).
 */
export function computeLinePrice(
  weight: number, perLb: number, mode: "addition" | "small_control", cfg: SmallParcelConfig
): { price: number; isSmall: boolean } {
  if (mode === "small_control" && isSmallParcel(weight, cfg)) {
    return { price: round2(cfg.price), isSmall: true };
  }
  return { price: round2(weight * perLb), isSmall: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// TAXE FIXE SOU PWA TOTAL — règ STANDA COMMERCIAL
// ───────────────────────────────────────────────────────────────────────────
// Depi pwa TOTAL koli yo rive nan 6.50 lb, yon taxe fiks 10 USD ajoute.
// Se yon sèl fwa pa fakti (pa pa koli). Chanje valè yo isit la sèlman.
// ═══════════════════════════════════════════════════════════════════════════
export const TAX_THRESHOLD_LB = 6.5;
export const TAX_FIXED_USD = 10;

/** Taxe fiks la pou yon pwa total bay. */
export function fixedTaxForWeight(totalWeight: number): number {
  const w = Number(totalWeight);
  return Number.isFinite(w) && w >= TAX_THRESHOLD_LB ? TAX_FIXED_USD : 0;
}

export interface EstimateResult {
  count: number;        // kantite koli
  totalWeight: number;  // pwa total (lb)
  subtotal: number;     // transpò sèlman (USD)
  fixedTax: number;     // 0 oswa TAX_FIXED_USD
  total: number;        // subtotal + fixedTax
  perLb: number;        // pri/lb ki sèvi
  smallCount: number;   // konbyen koli ki pase kòm "ti koli"
}

/**
 * ESTIMASYON POU YON ANSANM KOLI (app kliyan an + apèsi admin).
 *
 * Business : TOUT pwa yo adisyone ANVAN, epi miltipliye pa pri/lb Business la.
 * Lòt kont: chak koli apa —
 *            0.10 ≤ pwa ≤ 0.99 lb  -> pri fiks ti koli (Paramètres)
 *            sinon                 -> pwa × pri/lb Personnel
 * Nan toude ka: si pwa TOTAL ≥ 6.50 lb -> + 10 USD taxe fiks (yon sèl fwa).
 *
 * Retounen null si vil kliyan an pa konfigire/aktif — nou pa devine okenn pri.
 */
export function estimateForPackages(
  weights: number[],
  accountType: AccountType,
  ville: Ville | null | undefined,
  cfg: SmallParcelConfig
): EstimateResult | null {
  if (!ville || !ville.active) return null;
  const perLb = accountType === "Business" ? Number(ville.price_business) : Number(ville.price_personal);
  if (!Number.isFinite(perLb) || perLb <= 0) return null;

  const ws = weights.map((w) => (Number.isFinite(Number(w)) && Number(w) > 0 ? Number(w) : 0));
  const totalWeight = round2(ws.reduce((s, w) => s + w, 0));

  let subtotal = 0;
  let smallCount = 0;
  if (accountType === "Business") {
    // Adisyone tout pwa yo ANVAN, apre sa miltipliye pa pri/lb la.
    subtotal = round2(totalWeight * perLb);
  } else {
    for (const w of ws) {
      if (isSmallParcel(w, cfg)) { subtotal += round2(cfg.price); smallCount++; }
      else subtotal += round2(w * perLb);
    }
    subtotal = round2(subtotal);
  }

  const fixedTax = fixedTaxForWeight(totalWeight);
  return {
    count: ws.length, totalWeight, subtotal, fixedTax,
    total: round2(subtotal + fixedTax), perLb, smallCount
  };
}

export interface PriceResult {
  /** PRIX LIV LA KOUTE A — transpò SÈLMAN (pwa × pri/lb). Pa gen okenn frè ladan l. */
  price: number;          // USD
  /** TAX FIX — frè fiks vil la + tax pa liv (soti nan Paramètres). Separe nèt de pri a. */
  taxFix: number;         // USD
  /** Alias konpatibilite (menm valè ak taxFix). */
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
  ville: Ville | null | undefined
): PriceResult | null {
  // v8: TOUT koli (menm sa ki poko rive 1 lb yo) kalkile pwa × pri/lb vil la.
  // Ex: vil 3.99 USD/lb, koli 0.60 lb -> 3.99 × 0.60 = 2.39 USD.
  if (!ville || !ville.active) return null;
  const perLb = accountType === "Business" ? Number(ville.price_business) : Number(ville.price_personal);
  const taxLb = accountType === "Business" ? Number(ville.tax_business) : Number(ville.tax_personal);
  // Pri transpò a PA JANM gen frè ladan l (frais fixe / tax ale nan taxFix).
  const price = round2(weight * perLb);
  const taxFix = round2(weight * taxLb + Number(ville.fixed_fee || 0));
  return { price, taxFix, tax: taxFix, rule: "ville" };
}
