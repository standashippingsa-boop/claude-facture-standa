/**
 * RAPPORT PDF D'UN POINT DE RETRAIT — généré dans l'app de l'agent (jsPDF).
 * Contenu : caisse à remettre, détail par moyen de paiement (Espèces, MonCash,
 * NatCash, Zelle…), paiements reçus, colis remis, clients avec un solde.
 * Mêmes chiffres que l'onglet « Rapport » : rien n'est recalculé autrement.
 */
export type ReportPayment = { invoice_number: string; customer_code: string; customer_name: string; amount: number; currency: string; payment_method: string; payment_reference: string; created_at: string };
export type ReportBalance = { customer_code: string; customer_name: string; balance_usd: number; balance_htg: number; invoice_number: string; invoice_count: number };
export type ReportDelivery = { customer_code: string; customer_name: string; tracking: string; invoice_number: string; delivered_at: string };

export type AgentReportInput = {
  agentName: string; zone: string; since: string;
  payments: ReportPayment[]; balances: ReportBalance[]; deliveries: ReportDelivery[];
};

const NAVY: [number, number, number] = [11, 42, 91];
const MIST: [number, number, number] = [242, 244, 248];
const usd = (value: number) => "$" + Number(value || 0).toFixed(2);
// Les polices standard du PDF ne connaissent pas les espaces insécables : espace simple.
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, " ");
const htg = (value: number) => plain(new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 2 }).format(Number(value || 0))) + " HTG";
const when = (value: string) => value ? plain(new Date(value).toLocaleString("fr-CA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })) : "";

export function methodLabel(method: string) {
  const value = (method || "").trim();
  if (/^(esp[eè]ces?|cash)$/i.test(value)) return "Espèces";
  if (/^mon\s*cash$/i.test(value)) return "MonCash";
  if (/^nat\s*cash$/i.test(value)) return "NatCash";
  if (/^zelle$/i.test(value)) return "Zelle";
  return value || "Non précisé";
}

export function reportTotals(payments: ReportPayment[]) {
  const byMethod = new Map<string, { usd: number; htg: number; count: number }>(["Espèces", "MonCash", "NatCash", "Zelle"].map((label) => [label, { usd: 0, htg: 0, count: 0 }]));
  const cash = { usd: 0, htg: 0 };
  for (const payment of payments) {
    const label = methodLabel(payment.payment_method);
    const row = byMethod.get(label) ?? { usd: 0, htg: 0, count: 0 };
    const amount = Number(payment.amount || 0);
    if (payment.currency === "HTG") row.htg += amount; else row.usd += amount;
    row.count += 1;
    byMethod.set(label, row);
    // Zelle arrive directement sur le compte STANDA : hors caisse à remettre.
    if (label !== "Zelle") { if (payment.currency === "HTG") cash.htg += amount; else cash.usd += amount; }
  }
  return { cash, byMethod };
}

export async function buildAgentReportPdf(input: AgentReportInput) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const { cash, byMethod } = reportTotals(input.payments);
  const now = new Date();

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("STANDA COMMERCIAL", 14, 13);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text(`Rapport du point de retrait : ${input.zone}`, 14, 21);
  doc.setFontSize(9);
  doc.text(`Édité le ${when(now.toISOString())}`, W - 14, 13, { align: "right" });

  doc.setTextColor(30, 30, 30); doc.setFontSize(10);
  doc.text(`Agent : ${input.agentName}`, 14, 40);
  doc.text(`Période : depuis le ${when(input.since)} (dernière clôture)`, 14, 46);

  // Caisse à remettre
  doc.setFillColor(...MIST);
  doc.roundedRect(14, 52, W - 28, 22, 2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...NAVY);
  doc.text("CAISSE À REMETTRE (hors Zelle)", 20, 60);
  doc.setFontSize(15);
  doc.text(`${usd(cash.usd)}   ·   ${htg(cash.htg)}`, 20, 69);

  let y = 82;
  const section = (title: string) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...NAVY);
    doc.text(title, 14, y); y += 3;
  };
  const table = (head: string[], body: string[][], right: number[] = []) => {
    autoTable(doc, {
      startY: y, head: [head], body: body.length ? body : [[{ content: "Aucune ligne", colSpan: head.length, styles: { halign: "center", textColor: 120 } } as never]],
      theme: "grid", headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: MIST }, styles: { fontSize: 8, cellPadding: 1.8, overflow: "linebreak" },
      columnStyles: Object.fromEntries(right.map((index) => [index, { halign: "right" }])), margin: { left: 14, right: 14 }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 9;
  };

  section("Détail par moyen de paiement");
  table(["Moyen", "Paiements", "Montant USD", "Montant HTG"], Array.from(byMethod, ([label, row]) => [
    label === "Zelle" ? "Zelle (hors caisse)" : label, String(row.count), usd(row.usd), htg(row.htg)
  ]), [1, 2, 3]);

  section(`Paiements reçus (${input.payments.length})`);
  table(["Date", "Client", "Facture", "Moyen", "Référence", "Montant"], input.payments.map((payment) => [
    when(payment.created_at), `${payment.customer_code}${payment.customer_name ? " · " + payment.customer_name : ""}`,
    payment.invoice_number || "", methodLabel(payment.payment_method), payment.payment_reference || "",
    payment.currency === "HTG" ? htg(payment.amount) : usd(payment.amount)
  ]), [5]);

  section(`Colis remis (${input.deliveries.length})`);
  table(["Date de remise", "Client", "Tracking", "Facture"], input.deliveries.map((item) => [
    when(item.delivered_at), `${item.customer_code}${item.customer_name ? " · " + item.customer_name : ""}`, item.tracking, item.invoice_number || ""
  ]));

  section(`Clients avec un solde à régler (${input.balances.length})`);
  table(["Client", "Factures", "Solde USD", "Solde HTG"], input.balances.map((balance) => [
    `${balance.customer_code}${balance.customer_name ? " · " + balance.customer_name : ""}`, `${balance.invoice_count} · ${balance.invoice_number}`,
    usd(balance.balance_usd), htg(balance.balance_htg)
  ]), [2, 3]);

  if (y > 255) { doc.addPage(); y = 30; }
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
  doc.text("Signature de l'agent :", 14, y + 8);
  doc.text("Reçu par l'administration :", W / 2 + 2, y + 8);
  doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.3);
  doc.line(14, y + 20, W / 2 - 8, y + 20);
  doc.line(W / 2 + 2, y + 20, W - 14, y + 20);

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setFontSize(8); doc.setTextColor(140, 140, 140);
    doc.text(`STANDA COMMERCIAL · ${input.zone} · page ${page}/${pages}`, W / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
  }
  const day = now.toISOString().slice(0, 10);
  const fileName = `Rapport-${input.zone.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-")}-${day}.pdf`;
  return { doc, fileName, cash };
}
