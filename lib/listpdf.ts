import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { loadLogo } from "./pdf";
import { ClientTarifInfo } from "./db";
import { Pkg } from "./types";
import { dateFr } from "./utils";

const NAVY: [number, number, number] = [18, 43, 92];
const MIST: [number, number, number] = [243, 245, 249];

/**
 * EXPORT PDF — lis koli yo (tout oswa filtre yo), pwofesyonèl pou enprime.
 * Kolòn: Customer Code, Guía, Tracking Number, Tracking ID, Poids, Contenu,
 * Date, Heure, Statut.
 */
export async function exportPackagesPdf(
  pkgs: Pkg[],
  tarifMap: Map<string, ClientTarifInfo>,
  title = "Liste des colis"
): Promise<void> {
  const logo = await loadLogo();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 26, "F");
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(12, 5, 16, 16, 2, 2, "F");
  if (logo) { try { doc.addImage(logo, "PNG", 13, 6, 14, 14, undefined, "FAST"); } catch { /* skip */ } }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("STANDA COMMERCIAL", 32, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(title, 32, 19);
  doc.text(`Date: ${dateFr(new Date())}   |   Total: ${pkgs.length} colis`, W - 14, 15, { align: "right" });

  const splitDate = (raw?: string) => {
    const s = String(raw ?? "").trim();
    const m = s.match(/^(\S+)\s+(\S+)$/);
    return m ? { d: m[1], h: m[2] } : { d: s, h: "" };
  };

  autoTable(doc, {
    startY: 30,
    head: [["Code", "Guía", "Tracking Number", "Tracking ID", "Lb", "Contenu", "Date", "Heure", "Statut"]],
    body: pkgs.map((p) => {
      const dt = splitDate(p.created_date);
      return [
        p.customer_code,
        p.mcpack_data?.["Guia"] ?? p.mcpack_data?.["Guía"] ?? "",
        p.tracking_number,
        p.tracking_manual ?? "",
        p.weight.toFixed(2),
        p.content,
        dt.d, dt.h,
        p.status
      ];
    }),
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: MIST },
    styles: { fontSize: 7.5, cellPadding: 1.5, overflow: "linebreak" },
    columnStyles: { 4: { halign: "right" } },
    margin: { left: 10, right: 10 }
  });

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  const pageH = doc.internal.pageSize.getHeight();
  doc.text("STANDA COMMERCIAL — " + title, 10, pageH - 6);

  doc.save(`Liste_colis_${Date.now().toString().slice(-6)}.pdf`);
}
