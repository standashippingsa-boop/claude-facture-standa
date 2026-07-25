import { AccountType, Client, Pkg, Ville } from "./types";
import { round2, isSmallParcel, SmallParcelConfig } from "./pricing";

/**
 * MOTEUR DE FACTURATION — NIVEAU FINANCIER (STANDA COMMERCIAL)
 * ═══════════════════════════════════════════════════════════════
 * Règ absoli:
 *  - Prix/LB soti SÈLMAN nan Paramètres (vil kliyan an). Jamè yon ansyen
 *    pri, yon cache, yon fakti anvan, yon package, oswa yon import.
 *  - Okenn devinèt. Si yon kontwòl echwe, fakti a PA jenere.
 *  - Prix/LB PA JANM modifye ni awondi. Awondi fèt sèlman sou montan liy/total.
 *  - Total verifye anvan kreyasyon PDF (kalkile == afiche).
 */

export interface InvoiceInput {
  client: Client;
  pkgs: Pkg[];
  rate: number;                              // to USD->HTG
  smallCfg: SmallParcelConfig;               // paramèt ti koli (Paramètres)
  mode: "addition" | "small_control";
  taxeFixe: number;                          // 0 si dezaktive
  fraisDga: number;                          // 0 si dezaktive
  discount: number;                          // 0 si dezaktive
}

export interface InvoiceLine {
  pkg: Pkg;
  weight: number;
  perLb: number;                             // Prix/LB EGZAK (Paramètres)
  isSmall: boolean;
  amount: number;                            // montan liy lan (USD)
}

export interface InvoiceComputation {
  ok: boolean;
  errors: string[];                          // rezon si validasyon echwe
  // Enfo tarifè (pou jounal finansye)
  ville: string;
  zone: string;                              // menm ak vil la (zòn tarifè)
  perLb: number;
  accountType: AccountType;
  // Liy yo
  lines: InvoiceLine[];
  // Montan yo (USD)
  totalWeight: number;
  subtotal: number;
  taxeFixe: number;
  fraisDga: number;
  discount: number;
  totalUsd: number;
  totalHtg: number;
}

/** Pri/LB kliyan an SÈLMAN soti nan vil la (Paramètres). */
function perLbFromSettings(ville: Ville, accountType: AccountType): number {
  return accountType === "Business"
    ? Number(ville.price_business)
    : Number(ville.price_personal);
}

/**
 * VALIDE + KALKILE. Se sèl fonksyon ki gen dwa pwodui montan yon fakti.
 * Li pa touche bazdone — li retounen yon rezilta verifye (oswa erè).
 */
export function computeInvoice(input: InvoiceInput): InvoiceComputation {
  const { client, pkgs, rate, smallCfg, mode, taxeFixe, fraisDga, discount } = input;
  const errors: string[] = [];

  // ---- DOUBLE VALIDATION (§3) ----
  const ville = client.ville ?? null;
  if (!ville) errors.push("Ville du client introuvable — associez une ville tarifaire au client.");
  if (ville && !ville.active) errors.push(`La ville "${ville.name}" est désactivée dans Paramètres.`);
  const accountType: AccountType = client.account_type ?? "Personnel";

  let perLb = 0;
  if (ville) {
    perLb = perLbFromSettings(ville, accountType);
    if (!Number.isFinite(perLb) || perLb <= 0) {
      errors.push(`Prix/LB introuvable ou invalide pour "${ville.name}" (${accountType}). Vérifiez Paramètres.`);
    }
  }
  if (!pkgs.length) errors.push("Aucun colis sélectionné.");
  for (const p of pkgs) {
    if (!Number.isFinite(p.weight) || p.weight <= 0) {
      errors.push(`Poids invalide pour le colis ${p.tracking_number || p.id}.`);
    }
  }
  // Frè yo dwe valab (pa negatif, se nonm)
  const taxe = round2(Math.max(0, Number(taxeFixe) || 0));
  const dga = round2(Math.max(0, Number(fraisDga) || 0));
  const disc = round2(Math.max(0, Number(discount) || 0));
  if (Number(taxeFixe) < 0) errors.push("Taxe Fixe invalide (négative).");
  if (Number(fraisDga) < 0) errors.push("Frais DGA invalide (négatif).");
  if (Number(discount) < 0) errors.push("Discount invalide (négatif).");
  if (!Number.isFinite(rate) || rate <= 0) errors.push("Taux USD→HTG invalide (Paramètres).");
  if (mode === "small_control") {
    if (!(smallCfg.min >= 0) || !(smallCfg.max > 0) || !(smallCfg.price > 0)) {
      errors.push("Paramètres des petits colis invalides (min/max/prix).");
    }
  }

  if (errors.length) {
    return {
      ok: false, errors, ville: ville?.name ?? "", zone: ville?.name ?? "",
      perLb: 0, accountType, lines: [], totalWeight: 0, subtotal: 0,
      taxeFixe: taxe, fraisDga: dga, discount: disc, totalUsd: 0, totalHtg: 0
    };
  }

  // ---- KALKIL (§5) — nan lòd egzak, Prix/LB pa touche (§6) ----
  const lines: InvoiceLine[] = pkgs.map((p) => {
    const small = mode === "small_control" && isSmallParcel(p.weight, smallCfg);
    // Ti koli -> pri fiks; sinon pwa × pri/lb (awondi SOU MONTAN an, pa sou pri/lb)
    const amount = small ? round2(smallCfg.price) : round2(p.weight * perLb);
    return { pkg: p, weight: p.weight, perLb, isSmall: small, amount };
  });

  const totalWeight = round2(pkgs.reduce((s, p) => s + p.weight, 0));
  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const totalUsd = round2(subtotal + taxe + dga - disc);
  const totalHtg = round2(totalUsd * rate);

  return {
    ok: true, errors: [],
    ville: ville!.name, zone: ville!.name,
    perLb, accountType, lines,
    totalWeight, subtotal, taxeFixe: taxe, fraisDga: dga, discount: disc,
    totalUsd, totalHtg
  };
}

/**
 * VALIDATION FINALE (§8) — rekalkile total la depi liy yo epi konpare ak
 * total afiche a. Retounen true si yo idantik (tolerans 0.01 pou awondi).
 */
export function verifyTotal(comp: InvoiceComputation): boolean {
  const recomputed = round2(
    round2(comp.lines.reduce((s, l) => s + l.amount, 0))
    + comp.taxeFixe + comp.fraisDga - comp.discount
  );
  return Math.abs(recomputed - comp.totalUsd) < 0.011;
}
