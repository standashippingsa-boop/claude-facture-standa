import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ClientTarifInfo } from "./db";
import { loadLogo } from "./pdf";
import { round2 } from "./pricing";
import { Pkg } from "./types";
import { dateFr } from "./utils";

const NAVY: [number, number, number] = [18, 43, 92];
const MIST: [number, number, number] = [243, 245, 249];

/**
 * BON DE REMISE — lis koli w ap voye bay ajan nan lòt vil yo.
 * PDF separe nèt de fakti a: fonksyon sa a pa manyen génération PDF facture a.
 *
 * V15:
 *   • NIMEWO CONDUCE yo parèt nan antèt la EPI nan yon kolòn pa koli.
 *   • VIL DESTINASYON an ka fòse (ex: "Gonaïves") — koli KONT SANTRAL la
 *     pran vil destinasyon an otomatikman, li pa bloke ankò.
 */
export interface BonRemiseOptions {
  /** Vil destinasyon bon an (ex: "Gonaïves"). Vid = dedwi depi koli yo. */
  destination?: string;
  /** Nimewo conduce yo ki nan bon an: { [package.id]: "C-12345" } */
  conduceOf?: Record<string, string>;
  /** Kòd kont santral biznis la (ex: "MC-36191") — li pran vil destinasyon an. */
  centralCode?: string;
}

export async function generateBonRemise(
  pkgs: Pkg[],
  tarifMap: Map<string, ClientTarifInfo>,
  opts: BonRemiseOptions = {}
): Promise<void> {
  const logo = await loadLogo();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const numero = "BR-" + Date.now().toString().slice(-6);

  const central = (opts.centralCode ?? "").trim().toUpperCase();
  const dest = (opts.destination ?? "").trim();
  const conduceOf = opts.conduceOf ?? {};

  /**
   * Vil yon koli. Pou KONT SANTRAL la, se vil destinasyon bon an ki konte —
   * konsa kont lan pa mare ak yon sèl vil epi li pa janm bloke yon bon.
   */
  const villeOf = (p: Pkg): string => {
    if (central && String(p.customer_code ?? "").trim().toUpperCase() === central) {
      return dest || tarifMap.get(p.customer_code)?.ville?.name || "";
    }
    return tarifMap.get(p.customer_code)?.ville?.name ?? "";
  };

  const villes = dest
    ? [dest]
    : Array.from(new Set(pkgs.map(villeOf).filter(Boolean)));
  const conduces = Array.from(new Set(Object.values(conduceOf).filter(Boolean))).sort();
  const totalWeight = round2(pkgs.reduce((s, p) => s + (Number(p.weight) || 0), 0));
  const showConduce = conduces.length > 0;

  // ===== Header =====
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 34, "F");
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 7, 20, 20, 2, 2, "F");
  if (logo) {
    try { doc.addImage(logo, "PNG", 15.5, 8.5, 17, 17, undefined, "FAST"); } catch { /* fallback anba */ }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("STANDA COMMERCIAL", 38, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Bon de remise pour transport", 38, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("BON DE REMISE", W - 14, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`No: ${numero}`, W - 14, 20, { align: "right" });
  doc.text(`Date: ${dateFr(new Date())}`, W - 14, 25, { align: "right" });

  // ===== Rezime =====
  const boxH = showConduce ? 24 : 18;
  doc.setFillColor(...MIST);
  doc.roundedRect(14, 40, W - 28, boxH, 2, 2, "F");
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Ville(s) destination: ${villes.length ? villes.join(", ") : "—"}`, 20, 48);
  doc.setFont("helvetica", "normal");
  doc.text(`Nombre de colis: ${pkgs.length}`, 20, 54);
  doc.text(`Poids total: ${totalWeight.toFixed(2)} LB`, W / 2 + 4, 54);
  if (showConduce) {
    doc.setFont("helvetica", "bold");
    const label = `Conduce(s): `;
    doc.text(label, 20, 60);
    doc.setFont("helvetica", "normal");
    const txt = doc.splitTextToSize(conduces.join(", "), W - 28 - 30) as string[];
    doc.text(txt[0] ?? "—", 20 + doc.getTextWidth(label), 60);
  }

  // ===== Tablo koli yo =====
  const head = showConduce
    ? ["#", "Conduce", "Tracking ID (Guía)", "Code Client", "Nom Client", "Ville", "Poids (lb)"]
    : ["#", "Tracking ID (Guía)", "Code Client", "Nom Client", "Ville", "Poids (lb)"];

  autoTable(doc, {
    startY: 40 + boxH + 6,
    head: [head],
    body: pkgs.map((p, i) => {
      const base = [
        p.tracking_number + (p.tracking_manual ? "\n" + p.tracking_manual : ""),
        p.customer_code,
        p.customer_name,
        villeOf(p) || "—",
        (Number(p.weight) || 0).toFixed(2)
      ];
      return showConduce
        ? [String(i + 1), conduceOf[p.id] || "—", ...base]
        : [String(i + 1), ...base];
    }),
    foot: [showConduce
      ? ["", "", "", "", "", "TOTAL", totalWeight.toFixed(2) + " LB"]
      : ["", "", "", "", "TOTAL", totalWeight.toFixed(2) + " LB"]],
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8.5 },
    footStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8.5, halign: "right" },
    alternateRowStyles: { fillColor: MIST },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: showConduce
      ? { 0: { cellWidth: 8 }, 1: { cellWidth: 22 }, 6: { halign: "right" } }
      : { 0: { cellWidth: 8 }, 5: { halign: "right" } },
    margin: { left: 14, right: 14 }
  });

  // ===== Siyati yo (sou yon sèl paj si posib) =====
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 30) { doc.addPage(); y = 40; }

  const colW = (W - 28 - 16) / 3;
  const labels = ["Signature Expéditeur", "Signature Chauffeur", "Signature Réception"];
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  labels.forEach((label, i) => {
    const x = 14 + i * (colW + 8);
    doc.setDrawColor(120, 120, 120);
    doc.line(x, y, x + colW, y);
    doc.text(label, x + colW / 2, y + 5.5, { align: "center" });
  });

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("STANDA COMMERCIAL — Bon de remise " + numero, 14, pageH - 8);

  const suffix = dest ? `_${dest.replace(/\s+/g, "")}` : "";
  doc.save(`BonRemise_${numero}${suffix}.pdf`);
}
