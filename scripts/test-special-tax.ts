/**
 * Colis spécial « au poids + taxe » (lib/invoice-engine.ts).
 * Lancer : npx tsx scripts/test-special-tax.ts
 */
import { computeInvoice, verifyTotal, type InvoiceInput } from "../lib/invoice-engine";

const ville = { id: "v", name: "Gonaïves", active: true, price_personal: 3.5, price_business: 3, tax_personal: 0, tax_business: 0, fixed_fee: 0 };
const pkg = (id: string, weight: number) => ({ id, tracking_number: id, weight, content: "" });
const base = (accountType: "Personnel" | "Business", extra: Partial<InvoiceInput> = {}): InvoiceInput => ({
  client: { customer_code: "MC-1", account_type: accountType, ville } as never,
  pkgs: [pkg("A", 2), pkg("S", 4)] as never, rate: 132,
  smallCfg: { min: 0, max: 1, price: 2 } as never, mode: "addition", taxeFixe: 0, fraisDga: 0, discount: 0, ...extra
});

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => { if (!ok) failed++; console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };

// Personnel : S = 4 lb × 3.50 = 14 + taxe 5 = 19 ; total = 7 + 19 = 26.
let c = computeInvoice(base("Personnel", { specialSurcharges: { S: 5 } }));
let s = c.lines.find((l) => l.pkg.id === "S")!;
check("Personnel : part au poids + taxe séparées", c.ok && s.surcharge === 5 && s.amount === 19 && s.amount - s.surcharge === 14, JSON.stringify({ amount: s?.amount, surcharge: s?.surcharge }));
check("Personnel : total = somme des lignes", c.ok && c.subtotal === 26 && c.totalUsd === 26 && verifyTotal(c));

// Business : (2 + 4) × 3 = 18 + taxe 5 = 23.
c = computeInvoice(base("Business", { specialSurcharges: { S: 5 } }));
s = c.lines.find((l) => l.pkg.id === "S")!;
check("Business : poids additionnés + taxe", c.ok && c.subtotal === 23 && s.surcharge === 5 && verifyTotal(c), JSON.stringify({ subtotal: c.subtotal }));

// Pas de tarif petit colis pour un colis spécial au poids.
c = computeInvoice({ ...base("Personnel", { specialSurcharges: { S: 1 } }), mode: "small_control", pkgs: [pkg("S", 0.5)] as never });
s = c.lines[0];
check("Pas de tarif petit colis", c.ok && !s.isSmall && s.amount === 2.75, JSON.stringify({ amount: s?.amount, small: s?.isSmall }));

// Taxe 0 acceptée ; taxe négative refusée.
check("Taxe 0 acceptée", computeInvoice(base("Personnel", { specialSurcharges: { S: 0 } })).ok);
check("Taxe négative refusée", !computeInvoice(base("Personnel", { specialSurcharges: { S: -1 } })).ok);

// Sans taxe : identique à avant.
c = computeInvoice(base("Personnel"));
check("Sans colis spécial : inchangé", c.ok && c.subtotal === 21 && c.lines.every((l) => l.surcharge === 0));

console.log(failed ? `\n${failed} test(s) en échec` : "\nTous les tests passent");
process.exit(failed ? 1 : 0);
