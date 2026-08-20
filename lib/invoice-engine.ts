import { AccountType, Client, Pkg, Ville } from "./types";
import { round2, isSmallParcel, SmallParcelConfig, FixedPriceMap, TAX_THRESHOLD_LB, TAX_FIXED_USD } from "./pricing";

/**
 * MOTEUR DE FACTURATION — NIVEAU FINANCIER (STANDA COMMERCIAL)
 * ═══════════════════════════════════════════════════════════════
 * Règ absoli:
 *  - Prix/LB soti SÈLMAN nan Paramètres (vil kliyan an). Jamè yon ansyen
 *    pri, yon cache, yon fakti anvan, yon package, oswa yon import.
 *  - Okenn devinèt. Si yon kontwòl echwe, fakti a PA jenere.
 *  - Prix/LB PA JANM modifye ni awondi. Awondi fèt sèlman sou montan liy/total.
 *  - Total verifye anvan kreyasyon PDF (kalkile == afiche).
 *
 * RÈG KONT BUSINESS (V13):
 *  Pou yon kont Business, nou ADISYONE TOUT PWA yo ANVAN, epi nou miltipliye
 *  yon sèl fwa pa Prix/LB Business la:
 *        subtotal = round2( pwa_total × prix_lb )
 *  Liy yo toujou parèt koli pa koli sou PDF la; montan chak liy kalkile
 *  pwopòsyonèlman, epi dènye liy lan absòbe rès awondi a pou som liy yo
 *  egal EGZAKTEMAN subtotal la (verifyTotal rete valab).
 *  Tarif "ti koli" PA aplike sou Business — se sèlman lòt kont yo.
 *
 * ARTICLES À PRIX FIXE (V14):
 *  Kèk koli PA fakti pa liv (telefòn, laptòp, kamera, televizyon…).
 *  Admin chwazi yon atik nan katalòg la pou koli sa a; montan liy lan vin
 *  yon FÒFÈ. Pwa koli sa a:
 *    - PA miltipliye pa Prix/LB
 *    - PA antre nan adisyon Business la
 *    - MEN li antre nan Pwa Total la (li reyèl, li parèt sou fakti a)
 *  Yon koli ak fòfè PA janm sèvi ak tarif "ti koli".
 *
 * TAXE FIKS:
 *  Motè a PA ajoute okenn taks pou kont li. Se ADMIN ki mete taks yo nan
 *  fenèt fakti a. Motè a jis SIGNALE lè pwa total la rive nan sèy la
 *  (fixedTaxSuggested), pou fenèt la ka pwopoze montan an davans.
 */

export interface InvoiceInput {
  client: Client;
  pkgs: Pkg[];
  rate: number;                              // to USD->HTG
  smallCfg: SmallParcelConfig;               // paramèt ti koli (Paramètres)
  mode: "addition" | "small_control";
  taxeFixe: number;                          // 0 si dezaktive
  /** Pri fòfè pa koli: { [pkg.id]: { label, price } }. Vid = tout pa liv. */
  fixedPrices?: FixedPriceMap;
  fraisDga: number;                          // 0 si dezaktive
  discount: number;                          // 0 si dezaktive
}

export interface InvoiceLine {
  pkg: Pkg;
  weight: number;
  perLb: number;                             // Prix/LB EGZAK (Paramètres)
  isSmall: boolean;
  /** true si liy lan se yon FÒFÈ (atik a pri fiks) — pwa pa antre nan kalkil. */
  isFixed: boolean;
  /** Non atik la lè isFixed (ex: "Laptop"). Vid sinon. */
  fixedLabel: string;
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
  /** true si pwa total ≥ sèy la — fenèt fakti a pwopoze taks la (admin deside). */
  taxThresholdReached: boolean;
  /** Montan taks ki pwopoze (0 si sèy la pa rive). Se yon SIJESYON, pa yon obligasyon. */
  fixedTaxSuggested: number;
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
  const fixedPrices: FixedPriceMap = input.fixedPrices ?? {};
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
    // Yon koli a pri fòfè pa bezwen yon pwa valab — pwa a pa antre nan kalkil la.
    if (fixedPrices[p.id]) {
      const fp = Number(fixedPrices[p.id].price);
      if (!Number.isFinite(fp) || fp <= 0) {
        errors.push(`Prix forfaitaire invalide pour le colis ${p.tracking_number || p.id}.`);
      }
      continue;
    }
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
      taxeFixe: taxe, fraisDga: dga, discount: disc, totalUsd: 0, totalHtg: 0,
      taxThresholdReached: false, fixedTaxSuggested: 0
    };
  }

  // ---- KALKIL (§5) — nan lòd egzak, Prix/LB pa touche (§6) ----
  const w = (p: Pkg) => (Number.isFinite(p.weight) && p.weight > 0 ? p.weight : 0);
  const totalWeight = round2(pkgs.reduce((s, p) => s + w(p), 0));

  // Koli a FÒFÈ (atik a pri fiks) vs koli ki fakti PA LIV
  const isFix = (p: Pkg) => !!fixedPrices[p.id];
  const auPoids = pkgs.filter((p) => !isFix(p));
  const forfaits = round2(pkgs.filter(isFix).reduce((s, p) => s + round2(fixedPrices[p.id].price), 0));

  let lines: InvoiceLine[];
  let subtotal: number;

  if (accountType === "Business") {
    // BUSINESS: adisyone pwa KOLI AU POIDS yo ANVAN, miltipliye YON SÈL FWA.
    // Koli fòfè yo rete deyò adisyon an — yo ajoute apre, pri fiks yo.
    const poidsAuPoids = round2(auPoids.reduce((s, p) => s + w(p), 0));
    const partPoids = round2(poidsAuPoids * perLb);
    subtotal = round2(partPoids + forfaits);

    // Reparti `partPoids` sou koli au poids yo; dènye a absòbe rès awondi a,
    // konsa som liy yo egal EGZAKTEMAN subtotal la (verifyTotal rete valab).
    let cumul = 0;
    let vus = 0;
    lines = pkgs.map((p) => {
      if (isFix(p)) {
        const f = fixedPrices[p.id];
        return { pkg: p, weight: w(p), perLb: 0, isSmall: false,
                 isFixed: true, fixedLabel: f.label, amount: round2(f.price) };
      }
      vus++;
      const last = vus === auPoids.length;
      const amount = last ? round2(partPoids - cumul) : round2(w(p) * perLb);
      if (!last) cumul = round2(cumul + amount);
      return { pkg: p, weight: w(p), perLb, isSmall: false, isFixed: false, fixedLabel: "", amount };
    });
  } else {
    // LÒT KONT: chak koli apa — fòfè; sinon ti koli; sinon pwa × pri/lb.
    lines = pkgs.map((p) => {
      if (isFix(p)) {
        const f = fixedPrices[p.id];
        return { pkg: p, weight: w(p), perLb: 0, isSmall: false,
                 isFixed: true, fixedLabel: f.label, amount: round2(f.price) };
      }
      const small = mode === "small_control" && isSmallParcel(p.weight, smallCfg);
      const amount = small ? round2(smallCfg.price) : round2(p.weight * perLb);
      return { pkg: p, weight: w(p), perLb, isSmall: small, isFixed: false, fixedLabel: "", amount };
    });
    subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  }

  // Siyal taks la — SIJESYON sèlman. Motè a PA ajoute anyen pou kont li.
  const taxThresholdReached = totalWeight >= TAX_THRESHOLD_LB;
  const fixedTaxSuggested = taxThresholdReached ? TAX_FIXED_USD : 0;
  const totalUsd = round2(subtotal + taxe + dga - disc);
  const totalHtg = round2(totalUsd * rate);

  return {
    ok: true, errors: [],
    ville: ville!.name, zone: ville!.name,
    perLb, accountType, lines,
    totalWeight, subtotal, taxeFixe: taxe, fraisDga: dga, discount: disc,
    totalUsd, totalHtg, taxThresholdReached, fixedTaxSuggested
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
