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
const when = (value: string) => value ? plain(new Date(value).toLocaleString("fr-CA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })) : "·";

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
  doc.text(`Rapport du point de retrait · ${input.zone}`, 14, 21);
  doc.setFontSize(9);
  doc.text(`Édité le ${when(now.toISOString())}`, W - 14, 13, { align: "right" });

  doc.setTextColor(30, 30, 30); doc.setFontSize(10);
  doc.text(`Agent : ${input.agentName}`, 14, 40);
  doc.text(`Période : depuis le ${when(input.since)} (dernière clôture)`, 14, 46);

  // Caisse à remettre
  doc.setFillColor(...MIST);
  doc.roundedRect(14, 52, W - 28, 22, 2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...NAVY);
  doc.text("TOTAL À VERSER À STANDA (espèces, MonCash, NatCash)", 20, 60);
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
  {
    const sorted = [...input.payments].sort((a, b) => String(a.invoice_number).localeCompare(String(b.invoice_number)));
    const sumUsd = sorted.reduce((s, p) => s + (p.currency === "HTG" ? 0 : Number(p.amount || 0)), 0);
    const sumHtg = sorted.reduce((s, p) => s + (p.currency === "HTG" ? Number(p.amount || 0) : 0), 0);
    const body = sorted.map((p) => [
      p.invoice_number || "", p.customer_code || "", p.customer_name || "",
      methodLabel(p.payment_method) + (p.payment_reference ? `
Réf. ${p.payment_reference}` : ""),
      when(p.created_at),
      p.currency === "HTG" ? "" : usd(p.amount), p.currency === "HTG" ? htg(p.amount) : ""
    ]);
    autoTable(doc, {
      startY: y,
      head: [["N° facture", "Code", "Nom du client", "Paiement", "Date", "USD", "HTG"]],
      body: body.length ? body : [[{ content: "Aucun paiement", colSpan: 7, styles: { halign: "center", textColor: 120 } } as never]],
      foot: body.length ? [
        [{ content: "Total encaissé (tous moyens)", colSpan: 5, styles: { halign: "right" } } as never, usd(sumUsd), htg(sumHtg)],
        [{ content: "Dont Zelle (déjà sur le compte STANDA)", colSpan: 5, styles: { halign: "right", fontStyle: "normal" } } as never,
          usd(byMethod.get("Zelle")?.usd ?? 0), htg(byMethod.get("Zelle")?.htg ?? 0)],
        [{ content: "TOTAL À VERSER À STANDA", colSpan: 5, styles: { halign: "right" } } as never, usd(cash.usd), htg(cash.htg)],
      ] : undefined,
      theme: "grid", headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: MIST, textColor: NAVY, fontStyle: "bold" },
      alternateRowStyles: { fillColor: MIST }, styles: { fontSize: 8, cellPadding: 1.8, overflow: "linebreak" },
      columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 20 }, 4: { cellWidth: 26 }, 5: { halign: "right", cellWidth: 20 }, 6: { halign: "right", cellWidth: 26 } },
      margin: { left: 14, right: 14 }, showFoot: "lastPage"
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 9;
  }

  section(`Colis remis (${input.deliveries.length})`);
  table(["Date de remise", "Client", "Tracking", "Facture"], input.deliveries.map((item) => [
    when(item.delivered_at), `${item.customer_code}${item.customer_name ? " · " + item.customer_name : ""}`, item.tracking, item.invoice_number || "·"
  ]));

  section(`Clients avec un solde à régler (${input.balances.length})`);
  table(["Client", "Factures", "Solde USD", "Solde HTG"], input.balances.map((balance) => [
    `${balance.customer_code}${balance.customer_name ? " · " + balance.customer_name : ""}`, `${balance.invoice_count} · ${balance.invoice_number}`,
    usd(balance.balance_usd), htg(balance.balance_htg)
  ]), [2, 3]);

  if (y > 235) { doc.addPage(); y = 20; }
  doc.setFillColor(...NAVY);
  doc.roundedRect(14, y, W - 28, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("MONTANT QUE L'AGENCE DOIT VERSER À STANDA", 20, y + 7);
  doc.setFontSize(14);
  doc.text(`${usd(cash.usd)}   ·   ${htg(cash.htg)}`, 20, y + 14.5);
  y += 24;

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
