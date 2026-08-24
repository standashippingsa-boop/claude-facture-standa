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
// ═══════════════════════════════════════════════════════════════════════════
// ESTIMASYON BENEFIS (Conduce)
// ───────────────────────────────────────────────────────────────────────────
// MCPACK fakti STANDA ~3.00 USD/lb. Maj estime a se 0.80 USD sou chak liv.
// Se yon ESTIMASYON pou pilotaj — li pa yon chif kontabilite.
// Chanje valè a ISIT LA sèlman si maj la chanje.
// ═══════════════════════════════════════════════════════════════════════════
export const MCPACK_COST_PER_LB = 3.00;
export const PROFIT_PER_LB = 0.80;

/** Benefis estime pou yon pwa total bay (USD). */
export function estimateProfit(totalWeight: number): number {
  const w = Number(totalWeight);
  return Number.isFinite(w) && w > 0 ? round2(w * PROFIT_PER_LB) : 0;
}

export const TAX_THRESHOLD_LB = 6.5;
export const TAX_FIXED_USD = 10;

/** Taxe fiks la pou yon pwa total bay. */
export function fixedTaxForWeight(totalWeight: number): number {
  const w = Number(totalWeight);
  return Number.isFinite(w) && w >= TAX_THRESHOLD_LB ? TAX_FIXED_USD : 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// ARTICLES À PRIX FIXE (forfait) — telefòn, laptòp, kamera, elatriye
// ───────────────────────────────────────────────────────────────────────────
// Kèk koli PA fakti pa liv: yon laptòp 4 lb pa gen menm valè ak 4 lb rad.
// Pou koli sa yo, admin chwazi yon ATIK nan katalòg la epi pri a se yon
// FÒFÈ fiks — pwa a pa antre nan kalkil la ditou.
//
// Katalòg la anrejistre nan tab `app_settings` (kle: special_articles),
// donk PA GEN okenn migrasyon SQL pou fè.
// ═══════════════════════════════════════════════════════════════════════════
export interface SpecialArticle {
  id: string;      // idantifyan kout, ex: "laptop"
  label: string;   // non ki parèt: "Laptop / Ordinateur portable"
  price: number;   // pri fòfè an USD
}

/** Katalòg depa — admin ka chanje l nan Paramètres. */
export const DEFAULT_SPECIAL_ARTICLES: SpecialArticle[] = [
  { id: "telephone", label: "Téléphone", price: 25 },
  { id: "laptop",    label: "Laptop / Ordinateur portable", price: 60 },
  { id: "tablette",  label: "Tablette / iPad", price: 40 },
  { id: "camera",    label: "Caméra / Appareil photo", price: 45 },
  { id: "tv",        label: "Téléviseur", price: 90 }
];

/** Li katalòg la depi tèks JSON ki nan Paramètres. Toujou solid. */
export function parseSpecialArticles(json: string | null | undefined): SpecialArticle[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(String(json));
    if (!Array.isArray(raw)) return [];
    return raw
      .map((a: unknown) => {
        const o = a as Record<string, unknown>;
        const price = Number(o?.price);
        return {
          id: String(o?.id ?? "").trim(),
          label: String(o?.label ?? "").trim(),
          price: Number.isFinite(price) && price > 0 ? round2(price) : 0
        };
      })
      .filter((a) => a.id && a.label && a.price > 0);
  } catch { return []; }
}

/** Pri fòfè chwazi pou chak koli: { [package.id]: { label, price } } */
export type FixedPriceMap = Record<string, { label: string; price: number }>;

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

// ═══════════════════════════════════════════════════════════════════════════
// FRAIS DE SERVICE — COMMANDE / ACHAT POUR CLIENT (Service Order)
// ───────────────────────────────────────────────────────────────────────────
// Kèk kliyan pase kòmand nan men STANDA: nou achte pou yo, nou fè yo peye
// pri acha a + yon FRÈ SÈVIS. Frè a depann de pri acha a, dapre yon tablo
// tranch. Frè shipping lan rete SEPARE nèt (menm motè, pa touche).
//
// TABLO OFISYÈL (defo):
//     jiska $50   ->  $5      |   $451 – $550  ->  $25
//     $51 – $250  ->  $10     |   $551 – $650  ->  $30
//     $251 – $350 ->  $15     |   $651 e plis  ->  5% sou pri acha a
//     $351 – $450 ->  $20
//
// Tablo a anrejistre nan `app_settings` (kle: order_fee_tiers), menm jan ak
// atik fòfè yo — donk admin ka chanje pri yo nan Paramètres SAN migrasyon SQL.
//
// RÈG:
//  • Frè a kalkile sou TOTAL tout kòmand yo nan fakti a (yon sèl chif).
//  • Tranch yo sèvi ak "≤" pou pa gen okenn twou: yon kòmand $50.75 tonbe
//    nan tranch $51–$250 (li depase 50). Okenn pri pa ka rete san tranch.
//  • Pri acha ≤ 0 -> frè 0 (se pa yon Service Order).
//  • Yon pri anba $5 pran frè minimòm premye tranch la ($5).
//  • Frè a PA JANM negatif, epi li toujou awondi a 2 desimal.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Yon tranch nan tablo frè sèvis la.
 *  - `upTo`   : limit siperyè tranch la an USD. `null` = dènye tranch, san limit.
 *  - `amount` : fòfè fiks an USD (tranch fiks).
 *  - `percent`: pousantaj sou pri acha a (tranch pousantaj).
 * Yon tranch dwe gen SWA `amount` SWA `percent`, pa toude.
 */
export interface OrderFeeTier {
  upTo: number | null;
  amount?: number;
  percent?: number;
}

/** Tablo depa — admin ka chanje l nan Paramètres (kle: order_fee_tiers). */
export const DEFAULT_ORDER_FEE_TIERS: OrderFeeTier[] = [
  { upTo: 50,   amount: 5 },
  { upTo: 250,  amount: 10 },
  { upTo: 350,  amount: 15 },
  { upTo: 450,  amount: 20 },
  { upTo: 550,  amount: 25 },
  { upTo: 650,  amount: 30 },
  { upTo: null, percent: 5 }
];

/** Klase tranch yo: pi piti an premye, tranch "san limit" (null) an dènye. */
function sortTiers(tiers: OrderFeeTier[]): OrderFeeTier[] {
  return [...tiers].sort((a, b) => {
    if (a.upTo === null) return 1;
    if (b.upTo === null) return -1;
    return a.upTo - b.upTo;
  });
}

/**
 * Chwazi tranch ki koresponn ak yon pri acha. Retounen `null` si pri a ≤ 0.
 * Si tablo a vid oswa kraze, nou tonbe sou tablo defo a — nou PA JANM
 * retounen 0 an kachèt paske sa ta fè STANDA pèdi frè a san moun pa wè l.
 */
export function findOrderFeeTier(
  purchase: number, tiers?: OrderFeeTier[] | null
): OrderFeeTier | null {
  const p = Number(purchase);
  if (!Number.isFinite(p) || p <= 0) return null;
  const list = sortTiers(tiers && tiers.length ? tiers : DEFAULT_ORDER_FEE_TIERS);
  for (const t of list) {
    if (t.upTo === null || p <= Number(t.upTo)) return t;
  }
  // Sekirite: si dènye tranch la gen yon limit epi pri a depase l, nou sèvi
  // ak dènye tranch la kanmenm (pito twòp ke zewo).
  return list[list.length - 1] ?? null;
}

/**
 * FRÈ SÈVIS pou yon pri acha bay (USD).
 * Pri acha ≤ 0 -> 0. Frè a awondi a 2 desimal, jamè negatif.
 */
export function orderServiceFee(
  purchase: number, tiers?: OrderFeeTier[] | null
): number {
  const t = findOrderFeeTier(purchase, tiers);
  if (!t) return 0;
  const p = Number(purchase);
  const fee = typeof t.percent === "number" && Number.isFinite(t.percent)
    ? p * t.percent / 100
    : Number(t.amount);
  return Number.isFinite(fee) && fee > 0 ? round2(fee) : 0;
}

/**
 * Etikèt tranch la pou fakti/PDF: "≤ $50", "$551–$650", "5%".
 * Retounen "" si pa gen tranch (pri ≤ 0).
 */
export function orderFeeLabel(
  purchase: number, tiers?: OrderFeeTier[] | null
): string {
  const p = Number(purchase);
  if (!Number.isFinite(p) || p <= 0) return "";
  const list = sortTiers(tiers && tiers.length ? tiers : DEFAULT_ORDER_FEE_TIERS);
  const t = findOrderFeeTier(p, list);
  if (!t) return "";
  if (typeof t.percent === "number" && Number.isFinite(t.percent)) {
    return `${t.percent}%`;
  }
  const i = list.indexOf(t);
  const prev = i > 0 ? list[i - 1].upTo : null;
  const hi = Number(t.upTo);
  if (prev === null || prev === undefined) return `\u2264 $${hi}`;
  return `$${Number(prev) + 1}\u2013$${hi}`;
}

/**
 * Li tablo a depi tèks JSON ki nan Paramètres. Toujou solid:
 * si JSON an kraze oswa vid, nou retounen [] epi moun k ap rele a
 * dwe sèvi ak DEFAULT_ORDER_FEE_TIERS.
 */
export function parseOrderFeeTiers(json: string | null | undefined): OrderFeeTier[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(String(json));
    if (!Array.isArray(raw)) return [];
    const out: OrderFeeTier[] = [];
    for (const item of raw) {
      const o = item as Record<string, unknown>;
      const rawUpTo = o?.upTo;
      const upTo = rawUpTo === null || rawUpTo === undefined || rawUpTo === ""
        ? null : Number(rawUpTo);
      if (upTo !== null && (!Number.isFinite(upTo) || upTo <= 0)) continue;
      const percent = Number(o?.percent);
      const amount = Number(o?.amount);
      if (Number.isFinite(percent) && percent > 0) {
        out.push({ upTo, percent: round2(percent) });
      } else if (Number.isFinite(amount) && amount > 0) {
        out.push({ upTo, amount: round2(amount) });
      }
    }
    return out.length ? sortTiers(out) : [];
  } catch { return []; }
}

/** Ekri tablo a an JSON pou Paramètres. */
export function serializeOrderFeeTiers(tiers: OrderFeeTier[]): string {
  return JSON.stringify(sortTiers(tiers));
}
