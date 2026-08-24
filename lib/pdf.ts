import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Invoice, InvoiceItem } from "./types";
import { supabase } from "./supabase";
import { dateFr, htg, usd } from "./utils";

const NAVY: [number, number, number] = [18, 43, 92];
const MIST: [number, number, number] = [243, 245, 249];

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
  inv: Invoice, items: InvoiceItem[], footer: string, logo: string | null
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // ===== Header =====
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 34, "F");
  if (logo) {
    // Kare blan + logo an bòn rezolisyon
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, 7, 20, 20, 2, 2, "F");
    doc.addImage(logo, "PNG", 15.5, 8.5, 17, 17, undefined, "FAST");
  } else {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, 8, 18, 18, 2, 2, "F");
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("SC", 23, 20, { align: "center" });
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("STANDA COMMERCIAL", 38, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Sèvis livrezon koli", 38, 23);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("FACTURE", W - 14, 15, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`No: ${inv.invoice_number}`, W - 14, 21, { align: "right" });
  doc.text(`Date: ${dateFr(inv.created_at || new Date())}`, W - 14, 26, { align: "right" });

  // ===== SERVICE ORDER — li valè yo, tou dousman (fakti shipping -> 0) =====
  const purchase = Number(inv.order_purchase) || 0;
  const svcFee = Number(inv.order_service_fee) || 0;
  const deposit = Number(inv.order_deposit) || 0;
  const isOrder = inv.invoice_kind === "service_order" || purchase > 0 || svcFee > 0;
  if (isOrder) {
    doc.setFontSize(8);
    doc.text("Service Order", W - 14, 31, { align: "right" });
    doc.setFontSize(9);
  }

  // ===== Client =====
  doc.setFillColor(...MIST);
  doc.roundedRect(14, 42, W - 28, 32, 2, 2, "F");
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("CLIENT", 20, 50);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  doc.text(`Code: ${inv.customer_code}`, 20, 57);
  doc.text(`Nom: ${inv.customer_name}`, 20, 63);
  doc.text(`Ville: ${inv.ville || "—"}`, W / 2 + 4, 57);
  doc.text(`WhatsApp: ${inv.whatsapp}`, W / 2 + 4, 63);
  doc.text(`Lieu de récupération: ${inv.pickup_location}`, 20, 69);

  // ===== Tablo =====
  autoTable(doc, {
    startY: 80,
    head: [["#", "Tracking ID (Guía)", "Tracking Number", "Poids (lb)", "Prix/LB", "Montant (USD)"]],
    body: items.map((k, i) => {
      const w = Number(k.weight) || 0;
      // Si koli a sèvi ak tarif Petit Colis -> montre sa olye Prix/LB
      // Fòfè (atik a pri fiks): per_lb = 0 epi non atik la nan fixed_label
      const prixLbCell = k.fixed_label
        ? `Forfait — ${k.fixed_label}`
        : k.is_small
          ? "Tarif Petit Colis"
          : (k.per_lb && k.per_lb > 0 ? Number(k.per_lb).toFixed(2)
             : (w > 0 ? (Number(k.price) / w).toFixed(2) : "—"));
      return [
        String(i + 1),
        k.tracking_number,
        k.tracking_manual || "—",
        w.toFixed(2),
        prixLbCell,
        Number(k.price).toFixed(2)
      ];
    }),
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: MIST },
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    margin: { left: 14, right: 14 }
  });

  const yTable = (doc as any).lastAutoTable.finalY;

  // ===== Rezime pwa (agoch) =====
  const pkgCount = inv.package_count || items.length;
  const totalWeight = inv.total_weight ||
    Math.round(items.reduce((s, k) => s + Number(k.weight), 0) * 100) / 100;

  doc.setFillColor(...MIST);
  doc.roundedRect(14, yTable + 8, 80, 18, 2, 2, "F");
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(`Nombre de colis : ${pkgCount}`, 20, yTable + 15);
  doc.text(`Poids total : ${totalWeight.toFixed(2)} LB`, 20, yTable + 22);

  // ===== Totals (adwat): USD + Taux + HTG =====
  const y = yTable + 8;
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

  const lines: { label: string; value: number; bold?: boolean }[] = [];
  // Pati KÒMAND lan vin an premye — se li ki pi gwo montan an.
  if (purchase > 0) lines.push({ label: "Prix d'achat commande:", value: purchase });
  if (svcFee > 0) lines.push({ label: "Frais de service:", value: svcFee });
  lines.push({ label: "Sous-total colis:", value: Number(inv.subtotal) || 0 });
  if (taxFix > 0) lines.push({ label: "Taxe Fixe:", value: taxFix });
  if (dga > 0) lines.push({ label: "Frais DGA:", value: dga });
  if (disc > 0) lines.push({ label: "Discount:", value: -disc });

  // De liy anplis (Acompte + BALANCE) SÈLMAN si gen yon acompte reyèl.
  const extraRows = deposit > 0 ? 2 : 0;
  const boxH = 10 + lines.length * 7 + 8 + extraRows * 7;
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
  }
  doc.setDrawColor(180, 180, 180);
  doc.line(x + 5, ly - 3.5, x + boxW - 5, ly - 3.5);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL USD:", x + 5, ly + 1);
  doc.text(usd(grand), x + boxW - 5, ly + 1, { align: "right" });

  // ===== ACOMPTE + BALANCE (Service Order sèlman) =====
  let ry = ly + 1;
  if (deposit > 0) {
    doc.setFont("helvetica", "normal");
    ry += 7;
    doc.text("Acompte versé:", x + 5, ry);
    doc.text("-" + usd(deposit), x + boxW - 5, ry, { align: "right" });
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
  doc.text(deposit > 0 ? "BALANCE HTG:" : "TOTAL HTG:", x + 5, y + boxH + 7);
  doc.text(htg(totalHtg), x + boxW - 5, y + boxH + 7, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(footer, 14, 285);

  return doc;
}

export interface PdfResult {
  url: string | null;    // URL piblik Supabase Storage (null si upload echwe)
  blob: Blob;            // fichye PDF la — pou pataj WhatsApp
  filename: string;
}

/** Jenere + telechaje lokalman + monte sou Supabase Storage. */
export async function generateUploadDownload(
  inv: Invoice, items: InvoiceItem[], footer: string,
  opts: { download?: boolean; autoPrint?: boolean } = {}
): Promise<PdfResult> {
  const logo = await loadLogo();
  const doc = generateInvoicePdf(inv, items, footer, logo);
  const filename = `Facture_${inv.invoice_number}_${inv.customer_code}.pdf`;
  const blob = doc.output("blob");

  if (opts.autoPrint) {
    (doc as any).autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  } else if (opts.download) {
    doc.save(filename);
  }

  let url: string | null = null;
  try {
    const path = `${inv.invoice_number}.pdf`;
    const { error } = await supabase.storage.from("invoices")
      .upload(path, blob, { upsert: true, contentType: "application/pdf" });
    if (error) throw error;
    url = supabase.storage.from("invoices").getPublicUrl(path).data.publicUrl;
  } catch { /* offline oswa bucket pa la — PDF la toujou disponib lokalman */ }

  return { url, blob, filename };
}

export async function openInvoicePdf(inv: Invoice, items: InvoiceItem[], footer: string) {
  const logo = await loadLogo();
  const doc = generateInvoicePdf(inv, items, footer, logo);
  window.open(doc.output("bloburl"), "_blank");
}
