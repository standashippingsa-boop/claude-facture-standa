import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Invoice, InvoiceItem } from "./types";
import { supabase } from "./supabase";
import { dateFr, htg, usd } from "./utils";
import { DEFAULT_INVOICE_ADVICE, INVOICE_ADVICE_KEY, INVOICE_PATENT_KEY, parseInvoiceAdvice } from "./invoice-advice";
import { SITE } from "./site";
import { SITE_URL } from "./branding";
import { DEPOT } from "./depot";
import { DOKASAV_BRAND_KEY, DOKASAV_LOGO, DOKASAV_NAME, dokasavAdvice, dokasavCodesFrom, isDokasavCode, parseDokasavBrand, type DokasavBrand } from "./invoice-brand";

export type InvoiceExtras = { advice: string[]; patent: string; dokasavCodes: Set<string>; dokasav: DokasavBrand };
/** Modèle de facture d'un partenaire (Dokasav) au lieu du modèle STANDA. */
export type InvoiceBrand = { kind: "dokasav"; logo: string | null; info: DokasavBrand; fonts?: PdfFonts | null };
/** Polices TrueType (base64) intégrées au PDF : Poppins pour les factures Dokasav. */
export type PdfFonts = { regular: string; bold: string };

/** Conseils, patente et réglages Dokasav (Paramètres), relus à chaque facture. */
async function loadExtras(): Promise<InvoiceExtras> {
  try {
    const { data } = await supabase.from("app_settings").select("key, value")
      .in("key", [INVOICE_ADVICE_KEY, INVOICE_PATENT_KEY, "mcpack_ergens_codes", DOKASAV_BRAND_KEY]);
    const map = Object.fromEntries(((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
    return {
      advice: parseInvoiceAdvice(map[INVOICE_ADVICE_KEY]),
      patent: String(map[INVOICE_PATENT_KEY] ?? "").trim(),
      dokasavCodes: dokasavCodesFrom(map.mcpack_ergens_codes),
      dokasav: parseDokasavBrand(map[DOKASAV_BRAND_KEY]),
    };
  } catch { return { advice: DEFAULT_INVOICE_ADVICE, patent: "", dokasavCodes: new Set(), dokasav: parseDokasavBrand("") }; }
}

let dokasavLogoCache: string | null | undefined;
async function loadDokasavLogo(): Promise<string | null> {
  if (dokasavLogoCache !== undefined) return dokasavLogoCache;
  try {
    const res = await fetch(DOKASAV_LOGO);
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    dokasavLogoCache = await new Promise<string>((ok, ko) => {
      const r = new FileReader(); r.onload = () => ok(r.result as string); r.onerror = ko; r.readAsDataURL(blob);
    });
  } catch { dokasavLogoCache = null; }
  return dokasavLogoCache;
}

/** Facture d'un client Dokasav → modèle Dokasav ; sinon modèle STANDA (undefined). */
let poppinsCache: PdfFonts | null | undefined;
/** Poppins (licence libre OFL, public/fonts) : chargée une fois ; sans elle la facture garde Helvetica. */
async function loadPoppins(): Promise<PdfFonts | null> {
  if (poppinsCache !== undefined) return poppinsCache;
  const toBase64 = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(url);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
    return btoa(bin);
  };
  try {
    const [regular, bold] = await Promise.all([toBase64("/fonts/Poppins-Regular.ttf"), toBase64("/fonts/Poppins-SemiBold.ttf")]);
    poppinsCache = { regular, bold };
  } catch { poppinsCache = null; }
  return poppinsCache;
}

async function brandFor(inv: Invoice, extras: InvoiceExtras): Promise<InvoiceBrand | undefined> {
  if (!isDokasavCode(extras.dokasavCodes, inv.customer_code, inv.customer_name)) return undefined;
  const [logo, fonts] = await Promise.all([loadDokasavLogo(), loadPoppins()]);
  return { kind: "dokasav", logo, info: extras.dokasav, fonts };
}

/** Couleurs du modèle Dokasav (noir, bleu nuit et or du logo). */
const DK_NAVY: [number, number, number] = [22, 36, 82];
const DK_GOLD: [number, number, number] = [204, 150, 30];
const DK_SOFT: [number, number, number] = [248, 244, 234];

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
  advice: string[] = DEFAULT_INVOICE_ADVICE, patent = "", brand?: InvoiceBrand
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const dk = brand?.kind === "dokasav";
  // Police : Poppins sur les factures Dokasav (différente de STANDA), Helvetica sinon.
  let FONT = "helvetica";
  if (dk && brand?.fonts) {
    try {
      doc.addFileToVFS("Poppins-Regular.ttf", brand.fonts.regular);
      doc.addFont("Poppins-Regular.ttf", "Poppins", "normal");
      doc.addFileToVFS("Poppins-SemiBold.ttf", brand.fonts.bold);
      doc.addFont("Poppins-SemiBold.ttf", "Poppins", "bold");
      FONT = "Poppins";
    } catch { FONT = "helvetica"; }
  }
  if (dk && brand) advice = dokasavAdvice(brand.info);
  // Couleurs du modèle : STANDA (bleu marine) ou Dokasav (bleu nuit et or).
  const PRI = dk ? DK_NAVY : NAVY;
  const SOFT = dk ? DK_SOFT : MIST;

  // Bas de l'en-tête (mm) : la carte client commence juste après.
  let headerBottom = 44;
  if (dk) {
    // ===== EN-TÊTE : DOKASAV SÈVIS AK BOUTIK (compact, fond blanc, logo détouré) =====
    doc.setFillColor(...DK_NAVY);
    doc.rect(0, 0, W, 3, "F");
    doc.setFillColor(...DK_GOLD);
    doc.rect(0, 3, W, 0.7, "F");
    if (brand?.logo) {
      doc.addImage(brand.logo, "PNG", 14, 7.5, 52, 12.1, undefined, "FAST");
    } else {
      doc.setTextColor(...DK_NAVY); doc.setFont(FONT, "bold"); doc.setFontSize(14);
      doc.text(DOKASAV_NAME, 14, 15);
    }
    // Coordonnées Dokasav (seulement celles saisies), retour à la ligne si besoin : rien n'est coupé.
    const info = brand?.info;
    const contact = [
      info?.phone ? `Téléphone et WhatsApp : ${info.phone}` : "",
      info?.email ? `Courriel : ${info.email}` : "",
      info?.address ? `Adresse : ${info.address}` : "",
    ].filter(Boolean);
    doc.setFont(FONT, "normal"); doc.setFontSize(6.4); doc.setTextColor(95, 95, 95);
    let cy = 23.5;
    for (const line of contact) {
      for (const part of doc.splitTextToSize(line, 110) as string[]) { doc.text(part, 14, cy); cy += 2.9; }
    }

    doc.setTextColor(...DK_NAVY);
    doc.setFont(FONT, "bold");
    doc.setFontSize(17);
    doc.text("FACTURE", W - 14, 14, { align: "right" });
    // Numéro dans une pastille or.
    doc.setFontSize(7.2);
    const num = `N° ${inv.invoice_number}`;
    const pillW = doc.getTextWidth(num) + 7;
    doc.setFillColor(...DK_GOLD);
    doc.roundedRect(W - 14 - pillW, 16.5, pillW, 5, 2.5, 2.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(num, W - 14 - pillW / 2, 19.9, { align: "center" });
    doc.setFont(FONT, "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(95, 95, 95);
    doc.text(`Date : ${dateFr(inv.created_at || new Date())}`, W - 14, 25.5, { align: "right" });
    headerBottom = Math.max(30, cy + 1.5);
  } else {
  // ===== EN-TÊTE : STANDA COMMERCIAL =====
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 3, "F");
  if (logo) {
    doc.addImage(logo, "PNG", 14, 9, 22, 22, undefined, "FAST");
  } else {
    doc.setFillColor(...NAVY);
    doc.roundedRect(14, 9, 22, 22, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont(FONT, "bold");
    doc.setFontSize(14);
    doc.text("SC", 25, 23, { align: "center" });
  }
  const cx = 41;
  doc.setTextColor(...NAVY);
  doc.setFont(FONT, "bold");
  doc.setFontSize(13);
  doc.text("STANDA COMMERCIAL", cx, 14.5);
  doc.setFont(FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(70, 70, 70);
  doc.text("Standa Shipping S.A.", cx, 19);
  doc.setFontSize(6.8);
  doc.setTextColor(95, 95, 95);
  // La patente n'apparaît que lorsqu'elle est saisie dans Paramètres.
  const company = [
    ...(patent ? [`Patente : ${patent}`] : []),
    `Téléphone et WhatsApp : ${SITE.phone}`,
    `Courriel : ${SITE.email}`,
    `Site : ${SITE_URL.replace("https://", "")}`,
    `Dépôt de Miami : ${DEPOT.address1}, Miami, ${DEPOT.state} ${DEPOT.zip}, USA`,
  ];
  company.forEach((line, i) => doc.text(line, cx, 22.5 + i * 3.2));

  doc.setTextColor(...NAVY);
  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  doc.text("FACTURE", W - 14, 16, { align: "right" });
  doc.setFont(FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.text(`N° ${inv.invoice_number}`, W - 14, 22, { align: "right" });
  doc.text(`Date : ${dateFr(inv.created_at || new Date())}`, W - 14, 26.5, { align: "right" });
  }

  // ===== SERVICE ORDER — li valè yo, tou dousman (fakti shipping -> 0) =====
  const purchase = Number(inv.order_purchase) || 0;
  const svcFee = Number(inv.order_service_fee) || 0;
  const deposit = Number(inv.order_deposit) || 0;
  const isOrder = inv.invoice_kind === "service_order" || purchase > 0 || svcFee > 0;
  if (isOrder) { if (dk) doc.setTextColor(...DK_GOLD); doc.text("Service Order", W - 14, dk ? 29 : 31, { align: "right" }); }

  if (!dk) {
    doc.setDrawColor(215, 220, 230);
    doc.setLineWidth(0.3);
    doc.line(14, 44, W - 14, 44);
  }

  // ===== FACTURÉ À : le client =====
  const clientTop = dk ? headerBottom + 2 : 48;
  const col2 = W / 2 + 4;
  const valW = W / 2 - 22;                        // largeur d'une valeur : jamais sur l'autre colonne
  const labelSize = dk ? 5.8 : 6.5, valueSize = dk ? 7.2 : 8, valueLine = dk ? 2.9 : 3.4;
  const pickup = [String(inv.pickup_location ?? "").replace(/\s*[—–]\s*/g, ", "), inv.ville && !String(inv.pickup_location).includes(inv.ville) ? inv.ville : ""].filter(Boolean).join(", ");
  doc.setFont(FONT, "bold"); doc.setFontSize(valueSize);
  const wrap = (v: string) => (doc.splitTextToSize(v || "·", valW) as string[]).slice(0, 2);
  const nameLines = wrap(inv.customer_name), pickupLines = wrap(pickup);
  const rowGap = dk ? 7.2 : 8.5;
  const row1 = clientTop + (dk ? 8.5 : 11.5);
  const row2 = row1 + rowGap + (nameLines.length - 1) * valueLine;
  const cardH = (row2 - clientTop) + (dk ? 5.5 : 7) + (pickupLines.length - 1) * valueLine;
  doc.setFillColor(...SOFT);
  doc.roundedRect(14, clientTop, W - 28, cardH, 2, 2, "F");
  if (dk) { doc.setFillColor(...DK_GOLD); doc.roundedRect(14, clientTop, 1.4, cardH, 0.7, 0.7, "F"); }
  doc.setTextColor(...PRI);
  doc.setFont(FONT, "bold");
  doc.setFontSize(dk ? 6.4 : 7);
  doc.text("FACTURÉ À", 19, clientTop + (dk ? 4.6 : 6));
  const field = (label: string, lines: string[], fx: number, fy: number) => {
    doc.setFont(FONT, "normal"); doc.setFontSize(labelSize); doc.setTextColor(110, 110, 110);
    doc.text(label, fx, fy);
    doc.setFont(FONT, "bold"); doc.setFontSize(valueSize); doc.setTextColor(35, 35, 35);
    lines.forEach((line, i) => doc.text(line, fx, fy + (dk ? 3.3 : 4) + i * valueLine));
  };
  field("Nom du client", nameLines, 19, row1);
  field("Code client", wrap(inv.customer_code), col2, row1);
  field("WhatsApp", wrap(inv.whatsapp), 19, row2);
  field("Lieu de récupération", pickupLines, col2, row2);

  // ===== Tablo =====
  autoTable(doc, {
    startY: clientTop + cardH + (dk ? 4 : 6),
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
    headStyles: { fillColor: PRI, textColor: 255, fontStyle: "bold", ...(dk ? { fontSize: 6.5, cellPadding: 1.2 } : {}) },
    didDrawCell: (data) => {
      if (!dk || data.section !== "head") return;
      doc.setFillColor(...DK_GOLD);
      doc.rect(data.cell.x, data.cell.y + data.cell.height - 0.6, data.cell.width, 0.6, "F");
    },
    alternateRowStyles: { fillColor: SOFT },
    styles: dk ? { font: FONT, fontSize: 6.1, cellPadding: { top: 0.8, bottom: 0.8, left: 1.4, right: 1.4 }, overflow: "linebreak" } : { fontSize: 7, cellPadding: 1.6, overflow: "linebreak" },
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
  doc.setFillColor(...SOFT);
  doc.roundedRect(14, yTable + 8, 80, 18, 2, 2, "F");
  doc.setTextColor(...PRI);
  doc.setFont(FONT, "bold");
  doc.setFontSize(8);
  doc.text(`Nombre de colis : ${pkgCount}`, 20, yTable + 15);
  doc.text(`Poids total : ${totalWeight.toFixed(2)} LB`, 20, yTable + 22);
  const y = yTable + 8;
  doc.setFillColor(...SOFT);
  doc.roundedRect(x, y, boxW, boxH, 2, 2, "F");
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  doc.setFont(FONT, "normal");

  let ly = y + 7;
  for (const l of lines) {
    doc.text(l.label, x + 5, ly);
    doc.text((l.value < 0 ? "-" : "") + usd(Math.abs(l.value)), x + boxW - 5, ly, { align: "right" });
    ly += 7;
    if (l.htgNote && rate > 0) {
      doc.setFont(FONT, "normal"); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
      doc.text(htg(l.htgNote), x + boxW - 5, ly - 3, { align: "right" });
      doc.setFontSize(8.5); doc.setTextColor(40, 40, 40);
      ly += 3.5;
    }
  }
  doc.setDrawColor(180, 180, 180);
  doc.line(x + 5, ly - 3.5, x + boxW - 5, ly - 3.5);
  doc.setFont(FONT, "bold");
  doc.text("TOTAL USD :", x + 5, ly + 1);
  doc.text(usd(grand), x + boxW - 5, ly + 1, { align: "right" });

  // ===== ACOMPTE + BALANCE (Service Order sèlman) =====
  let ry = ly + 1;
  if (deposit > 0) {
    doc.setFont(FONT, "normal");
    ry += 7;
    doc.text("Acompte versé :", x + 5, ry);
    doc.text("-" + usd(deposit), x + boxW - 5, ry, { align: "right" });
    if (rate > 0) {
      doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
      doc.text(htg(deposit * rate), x + boxW - 5, ry + 3.5, { align: "right" });
      doc.setFontSize(8.5); doc.setTextColor(40, 40, 40);
      ry += 3.5;
    }
    ry += 7;
    doc.setDrawColor(180, 180, 180);
    doc.line(x + 5, ry - 3.5, x + boxW - 5, ry - 3.5);
    doc.setFont(FONT, "bold");
    doc.text("BALANCE À PAYER:", x + 5, ry);
    doc.text(usd(balance), x + boxW - 5, ry, { align: "right" });
  }

  doc.setFont(FONT, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  doc.text(`Taux: 1 USD = ${rate.toFixed(2)} HTG`, x + 5, ry + 5.5);

  doc.setFillColor(...(dk ? DK_GOLD : PRI));
  doc.roundedRect(x, y + boxH, boxW, 11, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont(FONT, "bold");
  doc.setFontSize(9.5);
  doc.text(deposit > 0 ? "SOLDE HTG :" : "TOTAL HTG :", x + 5, y + boxH + 7);
  doc.text(htg(totalHtg), x + boxW - 5, y + boxH + 7, { align: "right" });

  // ===== CONSEILS ET RÈGLES (sur toutes les factures) =====
  // Chaque conseil est mesuré avant d'être écrit : s'il ne tient pas en entier
  // sur la page, il passe sur la page suivante (jamais coupé en deux).
  // Bas du contenu sur la dernière page (le pied de page se place dessous).
  let contentEnd = Math.max(y + boxH + 11, yTable + 26);
  if (advice.length) {
    const left = 14, width = W - 28, numW = 5, lineH = dk ? 2.8 : 3.2, gap = dk ? 1 : 1.3;
    const adviceSize = dk ? 6.4 : 7, titleH = dk ? 5.5 : 6.5;
    const bottom = H - FOOTER_ZONE;
    let ay = contentEnd + (dk ? 6 : 9);
    const title = (suite: boolean) => {
      doc.setFillColor(...(dk ? SOFT : PRI));
      doc.roundedRect(left, ay, width, titleH, 1.2, 1.2, "F");
      if (dk) { doc.setFillColor(...DK_GOLD); doc.rect(left, ay, 1.4, titleH, "F"); }
      doc.setTextColor(...((dk ? DK_NAVY : [255, 255, 255]) as [number, number, number]));
      doc.setFont(FONT, "bold");
      doc.setFontSize(dk ? 6.8 : 7.5);
      doc.text(suite ? "SA POU W KONNEN LÈ W AP VIN CHÈCHE KOLI W (swit)" : "SA POU W KONNEN LÈ W AP VIN CHÈCHE KOLI W", left + 3.5, ay + titleH * 0.68);
      ay += titleH + 3.5;
    };
    doc.setFontSize(adviceSize);
    const blocks = advice.map((a) => doc.splitTextToSize(a, width - numW - 4) as string[]);
    const firstH = titleH + 3.5 + blocks[0].length * lineH + gap;
    if (ay + firstH > bottom) { doc.addPage(); ay = 16; }
    title(false);
    blocks.forEach((lines, i) => {
      const h = lines.length * lineH + gap;
      if (ay + h > bottom) { doc.addPage(); ay = 16; title(true); }
      doc.setFont(FONT, "bold");
      doc.setFontSize(adviceSize);
      doc.setTextColor(...PRI);
      doc.text(`${i + 1}.`, left + 2, ay);
      doc.setFont(FONT, "normal");
      doc.setTextColor(55, 55, 55);
      lines.forEach((line, j) => doc.text(line, left + numW + 2, ay + j * lineH));
      ay += h;
    });
    contentEnd = ay;
  }

  // ===== PIED DE PAGE : sur la DERNIÈRE page seulement, texte long sur plusieurs lignes =====
  const footText = String(dk ? (brand?.info.footer || `${DOKASAV_NAME} · Merci de votre confiance.`) : footer).trim();
  if (footText) {
    const footSize = dk ? 6.6 : 7.5, footLine = dk ? 2.9 : 3.3;
    doc.setFont(FONT, "normal");
    doc.setFontSize(footSize);
    const footLines = (doc.splitTextToSize(footText, W - 28 - 42) as string[]).slice(0, 6);
    const footTop = H - 11 - (footLines.length - 1) * footLine;   // première ligne
    // Pas de place sous le contenu : le pied de page passe sur une nouvelle page.
    if (contentEnd + 5 > footTop - 3) doc.addPage();
    doc.setPage(doc.getNumberOfPages());
    if (dk) { doc.setFillColor(...DK_GOLD); doc.rect(14, footTop - 4, W - 28, 0.4, "F"); }
    else { doc.setDrawColor(215, 220, 230); doc.setLineWidth(0.3); doc.line(14, footTop - 4, W - 14, footTop - 4); }
    doc.setTextColor(120, 120, 120);
    footLines.forEach((line, i) => doc.text(line, 14, footTop + i * footLine));
  }
  // Numéro de page sur chaque page, tout en bas (jamais sur le texte du pied de page).
  const pages = doc.getNumberOfPages();
  if (pages > 1) {
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont(FONT, "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(140, 140, 140);
      doc.text(`Page ${p}/${pages} · ${inv.invoice_number}`, W - 14, H - 6, { align: "right" });
    }
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
  const doc = generateInvoicePdf(inv, items, footer, logo, extras.advice, extras.patent, await brandFor(inv, extras));
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
  const doc = generateInvoicePdf(inv, items, footer, logo, extras.advice, extras.patent, await brandFor(inv, extras));
  window.open(doc.output("bloburl"), "_blank");
}
