import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Invoice, InvoiceItem } from "./types";
import { supabase } from "./supabase";
import { dateFr, htg, usd } from "./utils";
import { DEFAULT_INVOICE_ADVICE, INVOICE_ADVICE_KEY, INVOICE_PATENT_KEY, parseInvoiceAdvice } from "./invoice-advice";
import { SITE } from "./site";
import { SITE_URL } from "./branding";
import { DEPOT } from "./depot";

export type InvoiceExtras = { advice: string[]; patent: string };

/** Conseils et numéro de patente (Paramètres), relus à chaque facture. */
async function loadExtras(): Promise<InvoiceExtras> {
  try {
    const { data } = await supabase.from("app_settings").select("key, value").in("key", [INVOICE_ADVICE_KEY, INVOICE_PATENT_KEY]);
    const map = Object.fromEntries(((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
    return { advice: parseInvoiceAdvice(map[INVOICE_ADVICE_KEY]), patent: String(map[INVOICE_PATENT_KEY] ?? "").trim() };
  } catch { return { advice: DEFAULT_INVOICE_ADVICE, patent: "" }; }
}

const NAVY: [number, number, number] = [18, 43, 92];
const MIST: [number, number, number] = [243, 245, 249];
/** Hauteur réservée en bas de chaque page pour le pied de page (mm). */
const FOOTER_ZONE = 18;

/**
 * Logo ofisyèl la: mete fichye a nan /public/logo.png (PNG, fon transparan si posib).
 * Si li pa la, sistèm nan itilize monogram "SC" a — anyen pa kraze.
 */
let logoCache: string | null | undefined;
export async function loadLogo(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    const res = await fetch("/logo.png");
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    logoCache = await new Promise<string>((ok, ko) => {
      const r = new FileReader();
      r.onload = () => ok(r.result as string);
      r.onerror = ko;
      r.readAsDataURL(blob);
    });
  } catch {
    logoCache = null;
  }
  return logoCache;
}

export function generateInvoicePdf(
  inv: Invoice, items: InvoiceItem[], footer: string, logo: string | null,
  advice: string[] = DEFAULT_INVOICE_ADVICE, patent = ""
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // ===== EN-TÊTE : STANDA COMMERCIAL =====
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 3, "F");
  if (logo) {
    doc.addImage(logo, "PNG", 14, 9, 22, 22, undefined, "FAST");
  } else {
    doc.setFillColor(...NAVY);
    doc.roundedRect(14, 9, 22, 22, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("SC", 25, 23, { align: "center" });
  }
  const cx = 41;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("STANDA COMMERCIAL", cx, 14.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(70, 70, 70);
  doc.text("Standa Shipping S.A.", cx, 19);
  doc.setFontSize(7.5);
  doc.setTextColor(95, 95, 95);
  // La patente n'apparaît que lorsqu'elle est saisie dans Paramètres.
  const company = [
    ...(patent ? [`Patente : ${patent}`] : []),
    `Téléphone et WhatsApp : ${SITE.phone}`,
    `Courriel : ${SITE.email}`,
    `Site : ${SITE_URL.replace("https://", "")}`,
    `Dépôt de Miami : ${DEPOT.address1}, Miami, ${DEPOT.state} ${DEPOT.zip}, USA`,
  ];
  company.forEach((line, i) => doc.text(line, cx, 23.5 + i * 3.6));

  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("FACTURE", W - 14, 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  doc.text(`N° ${inv.invoice_number}`, W - 14, 22, { align: "right" });
  doc.text(`Date : ${dateFr(inv.created_at || new Date())}`, W - 14, 26.5, { align: "right" });

  // ===== SERVICE ORDER — li valè yo, tou dousman (fakti shipping -> 0) =====
  const purchase = Number(inv.order_purchase) || 0;
  const svcFee = Number(inv.order_service_fee) || 0;
  const deposit = Number(inv.order_deposit) || 0;
  const isOrder = inv.invoice_kind === "service_order" || purchase > 0 || svcFee > 0;
  if (isOrder) doc.text("Service Order", W - 14, 31, { align: "right" });

  doc.setDrawColor(215, 220, 230);
  doc.setLineWidth(0.3);
  doc.line(14, 44, W - 14, 44);

  // ===== FACTURÉ À : le client =====
  const clientTop = 48;
  doc.setFillColor(...MIST);
  doc.roundedRect(14, clientTop, W - 28, 27, 2, 2, "F");
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("FACTURÉ À", 19, clientTop + 6);
  const field = (label: string, value: string, fx: number, fy: number) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(110, 110, 110);
    doc.text(label, fx, fy);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(35, 35, 35);
    doc.text(value || "·", fx, fy + 4);
  };
  const col2 = W / 2 + 4;
  field("Nom du client", inv.customer_name, 19, clientTop + 11.5);
  field("Code client", inv.customer_code, col2, clientTop + 11.5);
  field("WhatsApp", inv.whatsapp, 19, clientTop + 20);
  field("Lieu de récupération", [inv.pickup_location, inv.ville && !String(inv.pickup_location).includes(inv.ville) ? inv.ville : ""].filter(Boolean).join(", "), col2, clientTop + 20);

  // ===== Tablo =====
  autoTable(doc, {
    startY: clientTop + 33,
    head: [["#", "Tracking ID", "Tracking Number", "Poids (lb)", "Taxe (USD)", "Montant (USD)"]],
    body: items.map((k, i) => {
      const w = Number(k.weight) || 0;
      const tax = Number(k.tax) || 0;
      // Colonne « Taxe » : la taxe ajoutée sur ce colis (sinon « — »). Le montant
      // de la ligne = prix shipping + taxe.
      const prixCell = tax > 0 ? tax.toFixed(2) : "·";
      const montant = tax > 0 ? Number(k.total ?? Number(k.price) + tax) : Number(k.price);
      return [
        String(i + 1),
        k.tracking_number,
        k.tracking_manual || "·",
        w.toFixed(2),
        prixCell,
        montant.toFixed(2)
      ];
    }),
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: MIST },
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    // Marge du bas : le tableau ne descend jamais sur la ligne de pied de page.
    margin: { left: 14, right: 14, top: 16, bottom: FOOTER_ZONE }
  });

  let yTable = (doc as any).lastAutoTable.finalY;

  // ===== Rezime pwa (agoch) =====
  const pkgCount = inv.package_count || items.length;
  const totalWeight = inv.total_weight ||
    Math.round(items.reduce((s, k) => s + Number(k.weight), 0) * 100) / 100;

  // ===== Totals (adwat): USD + Taux + HTG =====
  const boxW = 82;
  const x = W - 14 - boxW;
  const rate = Number(inv.exchange_rate_used) || 0;
  const grand = Number(inv.grand_total) || 0;
  // Balans: sa kliyan an rete dwe. Sou yon fakti shipping, acompte = 0
  // donk balans == total, epi tout sa ki anba a rete EGZAKteman menm jan.
  const balance = Number.isFinite(Number(inv.balance_due)) && inv.balance_due !== null && inv.balance_due !== undefined
    ? Number(inv.balance_due)
    : Math.round((grand - deposit) * 100) / 100;
  const totalHtg = Number(inv.total_htg) || balance * rate;

  // ===== ESTRIKTI FAKTI (liy yo parèt SÈLMAN si yo gen yon valè) =====
  const dga = Number(inv.frais_dga) || 0;
  const taxFix = Number(inv.tax) || 0;
  const disc = Number(inv.discount) || 0;

  const lines: { label: string; value: number; bold?: boolean; htgNote?: number }[] = [];
  // Pati KÒMAND lan vin an premye — se li ki pi gwo montan an.
  if (purchase > 0) lines.push({ label: "Prix d'achat de la commande :", value: purchase, htgNote: purchase * rate });
  if (svcFee > 0) lines.push({ label: "Frais de service :", value: svcFee, htgNote: svcFee * rate });
  lines.push({ label: "Total partiel colis :", value: Number(inv.subtotal) || 0 });
  if (taxFix > 0) lines.push({ label: "Taxe fixe :", value: taxFix });
  if (dga > 0) lines.push({ label: "Frais DGA :", value: dga });
  if (disc > 0) lines.push({ label: "Réduction :", value: -disc });

  // De liy anplis (Acompte + BALANCE) SÈLMAN si gen yon acompte reyèl.
  const extraRows = deposit > 0 ? 2 : 0;
  // Montant en gourdes en petit sous la ligne (Service Order) : 3.5 mm de plus par ligne concernée.
  const noteRows = lines.filter((l) => l.htgNote && rate > 0).length + (deposit > 0 && rate > 0 ? 1 : 0);
  const boxH = 10 + lines.length * 7 + 8 + extraRows * 7 + noteRows * 3.5;

  // ===== GARDE-FOU : le bloc des totaux doit tenir ENTIER sur la page =====
  // Avant, une facture longue (≈ 27 colis et plus) poussait les totaux hors de
  // la page A4 : le client ne voyait pas le TOTAL. Si la place manque sous le
  // tableau, les totaux passent sur une nouvelle page, jamais coupés.
  const summaryH = 8 + Math.max(18, boxH + 11) + 4;
  if (yTable + summaryH > H - FOOTER_ZONE) {
    doc.addPage();
    yTable = 16;
  }
  doc.setFillColor(...MIST);
  doc.roundedRect(14, yTable + 8, 80, 18, 2, 2, "F");
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(`Nombre de colis : ${pkgCount}`, 20, yTable + 15);
  doc.text(`Poids total : ${totalWeight.toFixed(2)} LB`, 20, yTable + 22);
  const y = yTable + 8;
  doc.setFillColor(...MIST);
  doc.roundedRect(x, y, boxW, boxH, 2, 2, "F");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "normal");

  let ly = y + 7;
  for (const l of lines) {
    doc.text(l.label, x + 5, ly);
    doc.text((l.value < 0 ? "-" : "") + usd(Math.abs(l.value)), x + boxW - 5, ly, { align: "right" });
    ly += 7;
    if (l.htgNote && rate > 0) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
      doc.text(htg(l.htgNote), x + boxW - 5, ly - 3, { align: "right" });
      doc.setFontSize(10); doc.setTextColor(40, 40, 40);
      ly += 3.5;
    }
  }
  doc.setDrawColor(180, 180, 180);
  doc.line(x + 5, ly - 3.5, x + boxW - 5, ly - 3.5);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL USD :", x + 5, ly + 1);
  doc.text(usd(grand), x + boxW - 5, ly + 1, { align: "right" });

  // ===== ACOMPTE + BALANCE (Service Order sèlman) =====
  let ry = ly + 1;
  if (deposit > 0) {
    doc.setFont("helvetica", "normal");
    ry += 7;
    doc.text("Acompte versé :", x + 5, ry);
    doc.text("-" + usd(deposit), x + boxW - 5, ry, { align: "right" });
    if (rate > 0) {
      doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
      doc.text(htg(deposit * rate), x + boxW - 5, ry + 3.5, { align: "right" });
      doc.setFontSize(10); doc.setTextColor(40, 40, 40);
      ry += 3.5;
    }
    ry += 7;
    doc.setDrawColor(180, 180, 180);
    doc.line(x + 5, ry - 3.5, x + boxW - 5, ry - 3.5);
    doc.setFont("helvetica", "bold");
    doc.text("BALANCE À PAYER:", x + 5, ry);
    doc.text(usd(balance), x + boxW - 5, ry, { align: "right" });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  doc.text(`Taux: 1 USD = ${rate.toFixed(2)} HTG`, x + 5, ry + 5.5);

  doc.setFillColor(...NAVY);
  doc.roundedRect(x, y + boxH, boxW, 11, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(deposit > 0 ? "SOLDE HTG :" : "TOTAL HTG :", x + 5, y + boxH + 7);
  doc.text(htg(totalHtg), x + boxW - 5, y + boxH + 7, { align: "right" });

  // ===== CONSEILS ET RÈGLES (sur toutes les factures) =====
  // Chaque conseil est mesuré avant d'être écrit : s'il ne tient pas en entier
  // sur la page, il passe sur la page suivante (jamais coupé en deux).
  if (advice.length) {
    const left = 14, width = W - 28, numW = 5, lineH = 3.2, gap = 1.3;
    const bottom = H - FOOTER_ZONE;
    let ay = Math.max(y + boxH + 11, yTable + 26) + 9;
    const title = (suite: boolean) => {
      doc.setFillColor(...NAVY);
      doc.roundedRect(left, ay, width, 6.5, 1.2, 1.2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(suite ? "SA POU W KONNEN LÈ W AP VIN CHÈCHE KOLI W (swit)" : "SA POU W KONNEN LÈ W AP VIN CHÈCHE KOLI W", left + 3.5, ay + 4.4);
      ay += 10;
    };
    doc.setFontSize(7);
    const blocks = advice.map((a) => doc.splitTextToSize(a, width - numW - 4) as string[]);
    const firstH = 10 + blocks[0].length * lineH + gap;
    if (ay + firstH > bottom) { doc.addPage(); ay = 16; }
    title(false);
    blocks.forEach((lines, i) => {
      const h = lines.length * lineH + gap;
      if (ay + h > bottom) { doc.addPage(); ay = 16; title(true); }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...NAVY);
      doc.text(`${i + 1}.`, left + 2, ay);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(55, 55, 55);
      lines.forEach((line, j) => doc.text(line, left + numW + 2, ay + j * lineH));
      ay += h;
    });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  // Pied de page + numéro sur CHAQUE page.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(footer, 14, H - 10);
    if (pages > 1) doc.text(`Page ${p}/${pages} · ${inv.invoice_number}`, W - 14, H - 10, { align: "right" });
  }

  return doc;
}

export interface PdfResult {
  path: string | null;   // chemin privé Storage (null si upload echwe)
  blob: Blob;            // fichye PDF la — pou pataj WhatsApp
  filename: string;
}

/** Jenere + telechaje lokalman + monte sou Storage prive. */
export async function generateUploadDownload(
  inv: Invoice, items: InvoiceItem[], footer: string,
  opts: { download?: boolean; autoPrint?: boolean } = {}
): Promise<PdfResult> {
  const [logo, extras] = await Promise.all([loadLogo(), loadExtras()]);
  const doc = generateInvoicePdf(inv, items, footer, logo, extras.advice, extras.patent);
  const filename = `Facture_${inv.invoice_number}_${inv.customer_code}.pdf`;
  const blob = doc.output("blob");

  if (opts.autoPrint) {
    (doc as any).autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  } else if (opts.download) {
    doc.save(filename);
  }

  let path: string | null = null;
  try {
    // Bucket la prive. Yon jeton o aza rete yon dezyèm pwoteksyon kont
    // devinèt; PDF la li sèlman atravè /api/documents apre verifikasyon.
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    path = `${inv.invoice_number}-${token}.pdf`;
    const { error } = await supabase.storage.from("invoices")
      .upload(path, blob, { upsert: true, contentType: "application/pdf" });
    if (error) throw error;
  } catch { /* offline oswa bucket pa la — PDF la toujou disponib lokalman */ }

  return { path, blob, filename };
}

export async function openInvoicePdf(inv: Invoice, items: InvoiceItem[], footer: string) {
  const [logo, extras] = await Promise.all([loadLogo(), loadExtras()]);
  const doc = generateInvoicePdf(inv, items, footer, logo, extras.advice, extras.patent);
  window.open(doc.output("bloburl"), "_blank");
}
