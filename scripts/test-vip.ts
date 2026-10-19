/**
 * Kont VIP : prix par livre propre au client, poids additionnés, sans petit colis ni taxe fixe.
 * Lancer : npx tsx scripts/test-vip.ts
 */
import { computeInvoice } from "../lib/invoice-engine";
import { computePrice, estimateForPackages, villeForClient } from "../lib/pricing";

const ville = { id: "v", name: "Gonaïves", active: true, price_personal: 3.5, price_business: 3, tax_personal: 0.2, tax_business: 0.1, fixed_fee: 1 };
const vip = (price: number | null) => ({ customer_code: "MC-VIP", account_type: "VIP" as const, vip_price_per_lb: price, ville });
const pkg = (id: string, weight: number) => ({ id, tracking_number: id, weight, content: "" });
const cfg = { min: 0.01, max: 0.99, price: 3.7 };

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => { if (!ok) failed++; console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };

// Facture : (4 + 0.5 + 3) × 2.25 = 16.875 → 16.88 ; pas de petit colis, pas de taxe suggérée même au-dessus du seuil.
const c = computeInvoice({ client: vip(2.25) as never, pkgs: [pkg("A", 4), pkg("B", 0.5), pkg("C", 3)] as never, rate: 132, smallCfg: cfg as never, mode: "small_control", taxeFixe: 0, fraisDga: 0, discount: 0 });
check("Facture VIP : poids additionnés × prix VIP", c.ok && c.subtotal === 16.88 && c.perLb === 2.25, JSON.stringify({ subtotal: c.subtotal, perLb: c.perLb }));
check("Facture VIP : pas de petit colis", c.ok && c.lines.every((l) => !l.isSmall));
check("Facture VIP : aucune taxe fixe suggérée", c.ok && !c.taxThresholdReached && c.fixedTaxSuggested === 0);

// Prix VIP manquant → facture bloquée avec un message clair.
const missing = computeInvoice({ client: vip(null) as never, pkgs: [pkg("A", 4)] as never, rate: 132, smallCfg: cfg as never, mode: "addition", taxeFixe: 0, fraisDga: 0, discount: 0 });
check("Prix VIP manquant : facture refusée", !missing.ok && missing.errors.some((e) => e.includes("Prix VIP")), missing.errors.join(" | "));

// Estimation espace client : même calcul, taxe fixe 0.
const est = estimateForPackages([4, 0.5, 3], "VIP", villeForClient(vip(2.25)), cfg as never);
check("Estimation VIP", !!est && est.subtotal === 16.88 && est.fixedTax === 0 && est.total === 16.88, JSON.stringify(est));

// Tarification d'un colis (Disponible) : prix VIP, aucune taxe/frais de ville.
const p = computePrice(4, "VIP", villeForClient(vip(2.25)));
check("Prix colis VIP", !!p && p.price === 9 && p.taxFix === 0, JSON.stringify(p));
check("Prix colis VIP sans prix défini → null", computePrice(4, "VIP", villeForClient(vip(null))) === null);

// Les autres comptes ne changent pas.
check("Personnel inchangé", computePrice(4, "Personnel", ville)?.price === 14);
check("Business inchangé", computePrice(4, "Business", ville)?.price === 12);

console.log(failed ? `\n${failed} test(s) en échec` : "\nTous les tests passent");
process.exit(failed ? 1 : 0);
