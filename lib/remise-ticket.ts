/**
 * TICKET DE REMISE — ti fakti tèmik (80 mm / 58 mm) kliyan an resevwa lè
 * yon ajan oswa yon admin remèt li koli li yo.
 *
 * Modil sa a pa manyen bazdone a (li ka itilize nan navigatè a): li
 * defini fòm done ticket la, fòmataj montan yo, matris QR la, epi PDF
 * tèmik la. Done yo menm soti SÈLMAN nan /api/remise-ticket (sèvè).
 *
 * Fòma a swiv resi kès tèmik yo (FedEx Office, Caribe Tours): tèks
 * monospace, liy an tirè, total aliyen adwat, QR + kòd sekirite anba.
 */
import { jsPDF } from "jspdf";
import { loadLogo } from "./pdf";

export type RemiseTicketPayment = {
  method: string; reference: string; amount: number; currency: string;
  created_at: string; received_by: string;
};

export type RemiseTicketInvoice = {
  invoice_number: string; created_at: string;
  total_usd: number; deposit_usd: number;
  payable_usd: number; payable_htg: number;
  paid_usd: number; paid_htg: number;
  remaining_usd: number; remaining_htg: number;
  payment_status: string;
  payments: RemiseTicketPayment[];
};

export type RemiseTicketPackage = {
  id: string; guia: string; tracking: string; content: string;
  quantity: number; weight: number; invoice_number: string;
};

export type RemiseTicket = {
  ticket_number: string;
  security_code: string;
  company: { name: string; phone: string; website: string; email?: string };
  /** Agence qui remet les colis (table `agences`), si elle est configurée. */
  agency?: { name: string; address: string; phone: string; hours: string } | null;
  point: string;
  delivered_at: string;
  delivered_by: string;
  printed_by: string;
  printed_at: string;
  customer: { code: string; name: string; phone: string; city: string; is_central: boolean };
  packages: RemiseTicketPackage[];
  invoices: RemiseTicketInvoice[];
  totals: {
    packages: number; articles: number; weight_lb: number;
    payable_usd: number; payable_htg: number;
    paid_usd: number; paid_htg: number;
    remaining_usd: number; remaining_htg: number;
  };
  qr_payload: string;
};

/** Lajè papye tèmik yo sipòte (mm). */
export type TicketWidth = 80 | 58;

const round2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Espas nòmal (pa U+202F) pou separe milye yo: jsPDF ak kèk enprimant
 * tèmik pa konnen espas fin Intl la, yo ta enprime yon karaktè fatra.
 */
function groupThousands(value: number, decimals: number): string {
  const fixed = Math.abs(round2(value)).toFixed(decimals);
  const [whole, fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (value < 0 ? "-" : "") + grouped + (fraction ? "," + fraction : "");
}

export const ticketUsd = (value: number) => "$" + round2(value).toFixed(2);
export const ticketHtg = (value: number) => {
  const rounded = round2(value);
  return groupThousands(rounded, Number.isInteger(rounded) ? 0 : 2) + " HTG";
};
export const ticketAmount = (value: number, currency: string) =>
  currency === "HTG" ? ticketHtg(value) : ticketUsd(value);

const pad2 = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 29 septembre 2026 14:31 » — lè lokal aparèy ki enprime a (Ayiti). */
export function ticketDateTime(value: string): string {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "—";
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** « 29/09/2026 14:31 » — pou liy peman yo ki bezwen rete kout. */
export function ticketShortDateTime(value: string): string {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "—";
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Matris QR (true = kare nwa), jenere ak @zxing/library ki deja nan pwojè a. */
export async function ticketQrMatrix(payload: string): Promise<boolean[][] | null> {
  try {
    const zxing: any = await import("@zxing/library");
    const hints = new Map();
    hints.set(zxing.EncodeHintType.CHARACTER_SET, "UTF-8");
    const qr = zxing.QRCodeEncoder.encode(payload, zxing.QRCodeDecoderErrorCorrectionLevel.M, hints);
    const matrix = qr.getMatrix();
    const size = matrix.getWidth();
    return Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, x) => matrix.get(x, y) === 1));
  } catch (error) {
    console.error("[remise-ticket:qr]", error);
    return null;
  }
}

/** Chemen SVG QR la (yon sèl <path>, rapid pou enprimant tèmik yo). */
export function qrSvgPath(matrix: boolean[][]): string {
  let d = "";
  matrix.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x + 4} ${y + 4}h1v1h-1z`; }));
  return d;
}

/* ================================================================
 * PDF TÈMIK — menm kontni ak ekran an, sou yon woulo 80 mm / 58 mm.
 * Wotè paj la kalkile an de pas: premye pas la mezire, dezyèm lan desine.
 * ================================================================ */
export async function generateRemiseTicketPdf(ticket: RemiseTicket, width: TicketWidth = 80): Promise<void> {
  const [logo, qr] = await Promise.all([loadLogo(), ticketQrMatrix(ticket.qr_payload)]);
  const measure = new jsPDF({ unit: "mm", format: [width, 2000] });
  const height = drawTicket(measure, ticket, width, logo, qr) + 8;
  const doc = new jsPDF({ unit: "mm", format: [width, Math.max(height, 80)] });
  drawTicket(doc, ticket, width, logo, qr);
  doc.save(`Ticket_${ticket.ticket_number.replace(/[^A-Za-z0-9-]+/g, "_")}.pdf`);
}

function drawTicket(doc: jsPDF, t: RemiseTicket, width: TicketWidth, logo: string | null, qr: boolean[][] | null): number {
  const margin = width === 80 ? 4 : 2.5;
  const inner = width - margin * 2;
  const base = width === 80 ? 8.5 : 7.2;
  const line = base * 0.45;
  const center = width / 2;
  let y = margin + 2;

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  const font = (size = base, style: "normal" | "bold" = "normal") => { doc.setFont("courier", style); doc.setFontSize(size); };
  const wrap = (text: string) => doc.splitTextToSize(text, inner) as string[];
  const centered = (text: string, size = base, style: "normal" | "bold" = "normal") => {
    font(size, style);
    for (const part of wrap(text)) { doc.text(part, center, y, { align: "center" }); y += size * 0.45; }
  };
  const left = (text: string, style: "normal" | "bold" = "normal", indent = 0) => {
    font(base, style);
    for (const part of doc.splitTextToSize(text, inner - indent) as string[]) { doc.text(part, margin + indent, y); y += line; }
  };
  const row = (label: string, value: string, style: "normal" | "bold" = "normal") => {
    font(base, style);
    const valueWidth = doc.getTextWidth(value);
    const labelLines = doc.splitTextToSize(label, Math.max(inner - valueWidth - 2, inner * 0.4)) as string[];
    doc.text(labelLines, margin, y);
    doc.text(value, width - margin, y, { align: "right" });
    y += line * labelLines.length;
  };
  const dashed = () => {
    y += 0.6;
    doc.setLineDashPattern([0.8, 0.8], 0);
    doc.setLineWidth(0.2);
    doc.line(margin, y, width - margin, y);
    doc.setLineDashPattern([], 0);
    y += line;
  };
  const stars = (text: string) => {
    font(base, "bold");
    const starWidth = doc.getTextWidth("*");
    const free = Math.max(0, inner - doc.getTextWidth(` ${text} `));
    const side = "*".repeat(Math.max(1, Math.floor(free / 2 / starWidth)));
    doc.text(`${side} ${text} ${side}`, center, y, { align: "center" });
    y += line;
  };

  // ===== Antèt =====
  if (logo) {
    const size = width === 80 ? 16 : 13;
    try { doc.addImage(logo, "PNG", center - size / 2, y - 1, size, size, undefined, "FAST"); y += size + 1.5; } catch { /* logo opsyonèl */ }
  }
  centered(t.company.name, base + 4, "bold");
  y += 0.5;
  centered(`Tél / WhatsApp : ${t.company.phone}`);
  if (t.company.email) centered(t.company.email);
  centered(t.company.website);
  if (t.point || t.agency) {
    y += 1;
    centered(`Agence : ${t.agency?.name || t.point}`, base, "bold");
    if (t.agency?.address) centered(t.agency.address);
    if (t.agency?.phone && t.agency.phone !== t.company.phone) centered(`Tél agence : ${t.agency.phone}`);
    if (t.agency?.hours) centered(t.agency.hours);
  }
  dashed();

  centered("TICKET DE REMISE", base + 2, "bold");
  y += 0.5;
  left(`Date : ${ticketDateTime(t.delivered_at)}`);
  left(`Ticket # : ${t.ticket_number}`);
  dashed();

  // ===== Kliyan =====
  left(t.customer.is_central ? "Compte central" : "Client", "bold");
  left(t.customer.code, "bold");
  if (t.customer.name) left(t.customer.name);
  if (t.customer.phone) left(`Tél : ${t.customer.phone}`);
  if (t.customer.city) left(`Ville : ${t.customer.city}`);
  dashed();

  // ===== Koli yo =====
  left(`COLIS REMIS (${t.packages.length})`, "bold");
  y += 0.5;
  t.packages.forEach((item, index) => {
    left(`${index + 1}. ${item.guia || item.tracking || "—"}`, "bold");
    if (item.tracking && item.tracking !== item.guia) left(`Trk : ${item.tracking}`, "normal", 3);
    const details = [item.content, `Qté ${item.quantity}`, `${item.weight.toFixed(2)} lb`].filter(Boolean).join(" · ");
    left(details, "normal", 3);
    if (item.invoice_number) left(`Facture : ${item.invoice_number}`, "normal", 3);
    y += 0.8;
  });
  dashed();
  row("Nombre de colis", String(t.totals.packages));
  row("Articles", String(t.totals.articles));
  row("Poids total", `${t.totals.weight_lb.toFixed(2)} lb`);
  dashed();

  // ===== Fakti + peman =====
  for (const invoice of t.invoices) {
    row(`Facture ${invoice.invoice_number}`, ticketUsd(invoice.total_usd), "bold");
    if (invoice.deposit_usd > 0.009) {
      row("  Acompte versé", "-" + ticketUsd(invoice.deposit_usd));
      row("  Solde facturé", ticketUsd(invoice.payable_usd));
    }
    row("  Équivalent HTG", ticketHtg(invoice.payable_htg));
    row("  Payé", ticketUsd(invoice.paid_usd));
    row("  Reste", ticketUsd(invoice.remaining_usd));
    row("  Statut", invoice.payment_status || "—");
    for (const payment of invoice.payments) {
      y += 0.4;
      row(`  ${payment.method || "Espèces"}`, ticketAmount(payment.amount, payment.currency));
      left(`${ticketShortDateTime(payment.created_at)}${payment.received_by ? " · " + payment.received_by : ""}`, "normal", 4);
      if (payment.reference) left(`Réf : ${payment.reference}`, "normal", 4);
    }
    y += 0.8;
  }
  if (t.invoices.length) dashed();

  row("Total facturé", ticketUsd(t.totals.payable_usd), "bold");
  row("", ticketHtg(t.totals.payable_htg));
  row("Total payé", ticketUsd(t.totals.paid_usd), "bold");
  row("Solde restant", ticketUsd(t.totals.remaining_usd), "bold");
  y += 1;
  stars("REMISE CONFIRMÉE");
  y += 0.5;
  left(`Remis par : ${t.delivered_by || "—"}`);
  left(`Imprimé par : ${t.printed_by || "—"}`);
  left(`Le : ${ticketDateTime(t.printed_at)}`);
  dashed();

  // ===== QR + sekirite =====
  if (qr) {
    const size = width === 80 ? 30 : 26;
    const cell = size / qr.length;
    doc.setFillColor(0, 0, 0);
    qr.forEach((cells, row) => cells.forEach((dark, col) => {
      if (dark) doc.rect(center - size / 2 + col * cell, y + row * cell, cell + 0.02, cell + 0.02, "F");
    }));
    y += size + 3;
  }
  centered(`Code de sécurité : ${t.security_code}`, base, "bold");
  dashed();

  // ===== Siyati kliyan =====
  y += 5;
  left("Signature du client :");
  y += 6;
  doc.setLineWidth(0.25);
  doc.line(margin, y, width - margin, y);
  y += line + 1;
  centered("Le client confirme avoir reçu les colis ci-dessus en bon état.", base - 1);
  y += 1;
  centered("MERCI DE VOTRE CONFIANCE !", base, "bold");
  centered("Conservez ce ticket comme preuve de remise.", base - 1);
  return y;
}
