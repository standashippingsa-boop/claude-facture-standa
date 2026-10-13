/**
 * Vérification du calcul des paiements en plusieurs lignes (lib/payment-allocation.ts).
 * Lancer : npx tsx scripts/test-payment-lines.ts
 */
import { planPaymentLines, type PaymentInvoice, type PaymentLine } from "../lib/payment-allocation";

const invoice = (id: string, usd: number, rate = 132, paidUsd = 0, paidHtg = 0, created = "2026-10-01"): PaymentInvoice => ({
  id, invoice_number: id, customer_code: "MC-1", grand_total: usd, total_usd: usd, total_htg: Math.round(usd * rate * 100) / 100,
  exchange_rate_used: rate, order_deposit: 0, balance_due: usd, has_pdf: true,
  payment_paid_usd: paidUsd, payment_paid_htg: paidHtg, created_at: created
});
const line = (amount: number, currency: "USD" | "HTG", method = "Espèces"): PaymentLine => ({ amount, currency, method, reference: "" });

let failed = 0;
function check(name: string, condition: boolean, detail = "") {
  if (!condition) failed++;
  console.log(`${condition ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}
const lastStatus = (plan: ReturnType<typeof planPaymentLines>, id: string) =>
  plan.ok ? [...plan.allocations].reverse().find((allocation) => allocation.invoice.id === id)?.status : undefined;

// 1. Gourdes en espèces + le reste en dollars par Zelle.
let plan = planPaymentLines([invoice("A", 100)], [line(5000, "HTG"), line(62.12, "USD", "Zelle")]);
check("HTG + reste USD solde la facture", plan.ok && lastStatus(plan, "A") === "Payé" && plan.remainingUsd === 0, JSON.stringify(plan.ok ? { rest: plan.remainingUsd, n: plan.allocations.length } : plan));

// 2. L'inverse : dollars d'abord, reste en gourdes.
plan = planPaymentLines([invoice("A", 100)], [line(40, "USD", "Zelle"), line(7920, "HTG", "MonCash")]);
check("USD + reste HTG solde la facture", plan.ok && lastStatus(plan, "A") === "Payé");

// 3. Trois moyens, paiement partiel.
plan = planPaymentLines([invoice("A", 100)], [line(2000, "HTG", "NatCash"), line(2000, "HTG", "MonCash"), line(10, "USD")]);
check("3 moyens, partiel", plan.ok && lastStatus(plan, "A") === "Payé partiel" && plan.remainingUsd > 59 && plan.remainingUsd < 60, plan.ok ? String(plan.remainingUsd) : "");

// 4. Dépassement refusé, rien n'est planifié.
plan = planPaymentLines([invoice("A", 100)], [line(5000, "HTG"), line(80, "USD")]);
check("dépassement sur la 2e ligne refusé", !plan.ok && /Ligne 2/.test(plan.ok ? "" : plan.reason), plan.ok ? "" : plan.reason);

// 5. Ligne en trop après solde complet.
plan = planPaymentLines([invoice("A", 100)], [line(100, "USD"), line(10, "HTG")]);
check("ligne après solde complet refusée", !plan.ok && /Ligne 2/.test(plan.ok ? "" : plan.reason), plan.ok ? "" : plan.reason);

// 6. Deux factures : la plus ancienne d'abord, sur deux lignes.
plan = planPaymentLines([invoice("B", 50, 132, 0, 0, "2026-10-05"), invoice("A", 100)], [line(13200, "HTG"), line(50, "USD", "Zelle")]);
check("2 factures soldées dans l'ordre", plan.ok && lastStatus(plan, "A") === "Payé" && lastStatus(plan, "B") === "Payé" && plan.allocations[0].invoice.id === "A");

// 7. Chaque écriture repart du solde laissé par la précédente (verrou optimiste du serveur).
plan = planPaymentLines([invoice("A", 100)], [line(5000, "HTG"), line(62.12, "USD")]);
check("priorUsd de la ligne 2 = newUsd de la ligne 1", plan.ok && plan.allocations[1].priorUsd === plan.allocations[0].newUsd);

// 8. Arrondi < 50 HTG accepté, pas au-delà.
plan = planPaymentLines([invoice("A", 100)], [line(13240, "HTG")]);
check("arrondi de 40 HTG accepté", plan.ok && lastStatus(plan, "A") === "Payé");
plan = planPaymentLines([invoice("A", 100)], [line(13260, "HTG")]);
check("excédent de 60 HTG refusé", !plan.ok);

// 9. Entrées invalides.
check("aucune ligne refusée", !planPaymentLines([invoice("A", 100)], []).ok);
check("7 lignes refusées", !planPaymentLines([invoice("A", 100)], Array.from({ length: 7 }, () => line(1, "USD"))).ok);
check("facture déjà payée refusée", !planPaymentLines([invoice("A", 100, 132, 100, 13200)], [line(1, "USD")]).ok);

// 10. Ancien format (une seule ligne) inchangé.
plan = planPaymentLines([invoice("A", 100)], [line(100, "USD")]);
check("une seule ligne, comme avant", plan.ok && plan.allocations.length === 1 && lastStatus(plan, "A") === "Payé");

console.log(failed ? `\n${failed} test(s) en échec` : "\nTous les tests passent");
process.exit(failed ? 1 : 0);
