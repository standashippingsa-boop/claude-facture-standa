/**
 * Taxe sur n'importe quel colis (colonne « Taxe » de la facture).
 * Lancer : npx tsx scripts/test-package-tax.ts
 */
import { computeInvoice, verifyTotal, type InvoiceInput } from "../lib/invoice-engine";

const ville = { id: "v", name: "Gonaïves", active: true, price_personal: 3.5, price_business: 3, tax_personal: 0, tax_business: 0, fixed_fee: 0 };
const pkg = (id: string, weight: number) => ({ id, tracking_number: id, weight, content: "" });
const base = (accountType: "Personnel" | "Business", extra: Partial<InvoiceInput> = {}): InvoiceInput => ({
  client: { customer_code: "MC-1", account_type: accountType, ville } as never,
  pkgs: [pkg("A", 2), pkg("B", 0.5)] as never, rate: 132,
  smallCfg: { min: 0, max: 1, price: 2 } as never, mode: "small_control", taxeFixe: 0, fraisDga: 0, discount: 0, ...extra
});
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => { if (!ok) failed++; console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };

// Personnel : A = 2 × 3.50 = 7 + taxe 4 = 11 ; B petit colis = 2 (inchangé) ; total 13.
let c = computeInvoice(base("Personnel", { packageTaxes: { A: 4 } }));
const a = c.lines.find((l) => l.pkg.id === "A")!;
check("Taxe ajoutée au prix shipping", c.ok && a.surcharge === 4 && a.amount === 11 && c.subtotal === 13 && verifyTotal(c), JSON.stringify({ amount: a.amount, subtotal: c.subtotal }));
// Petit colis avec taxe : garde son tarif petit colis.
c = computeInvoice(base("Personnel", { packageTaxes: { B: 1.5 } }));
const b = c.lines.find((l) => l.pkg.id === "B")!;
check("Petit colis taxé garde son tarif", c.ok && b.isSmall && b.amount === 3.5 && verifyTotal(c), JSON.stringify({ amount: b.amount, small: b.isSmall }));
// Forfait + taxe.
c = computeInvoice(base("Personnel", { fixedPrices: { A: { label: "Téléphone", price: 25 } }, packageTaxes: { A: 10 } }));
const f = c.lines.find((l) => l.pkg.id === "A")!;
check("Forfait + taxe", c.ok && f.amount === 35 && f.surcharge === 10 && verifyTotal(c), JSON.stringify({ amount: f.amount }));
// Business : (2 + 0.5) × 3 = 7.5 + taxes 4 = 11.5.
c = computeInvoice(base("Business", { packageTaxes: { A: 4 } }));
check("Business : poids additionnés + taxe", c.ok && c.subtotal === 11.5 && verifyTotal(c), JSON.stringify({ subtotal: c.subtotal }));
// Taxe négative refusée ; sans taxe inchangé.
check("Taxe négative refusée", !computeInvoice(base("Personnel", { packageTaxes: { A: -1 } })).ok);
c = computeInvoice(base("Personnel"));
check("Sans taxe : inchangé", c.ok && c.subtotal === 9 && c.lines.every((l) => l.surcharge === 0));
console.log(failed ? `\n${failed} échec(s)` : "\nTous les tests passent");
process.exit(failed ? 1 : 0);
