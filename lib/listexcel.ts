/*
 * STANDA COMMERCIAL — Export Excel des colis
 * ══════════════════════════════════════════════════════════
 * Menm done ak exportPackagesPdf (lib/listpdf.ts), fòma .xlsx.
 * READ-ONLY — pa touche okenn kalkil, jis ekspòte sa ki afiche deja.
 */
import { ClientTarifInfo } from "./db";
import { Pkg } from "./types";
import { dateFr } from "./utils";

export async function exportPackagesExcel(
  pkgs: Pkg[],
  tarifMap: Map<string, ClientTarifInfo>,
  title = "Liste des colis"
): Promise<void> {
  const XLSX: any = await import("xlsx");

  const rows = pkgs.map((p) => ({
    "Code Client": p.customer_code,
    "Nom Client": p.customer_name,
    "Ville": tarifMap.get(p.customer_code)?.ville?.name ?? "",
    "Tracking ID (Guía)": p.tracking_number,
    "Tracking Number": p.tracking_manual || "",
    "Poids (lb)": Number(p.weight || 0),
    "Contenu": p.content || "",
    "Prix $": Number(p.price_usd || 0),
    "Taxe $": Number(p.tax_usd || 0),
    "Total $": Number(p.total_usd || 0),
    "Total HTG": Number(p.total_htg || 0),
    "Statut": p.status,
    "Vérifié MCPACK": p.verified ? "Oui" : "Non",
    "Facturé": p.invoice_id ? "Oui" : "Non",
    "Date création": p.created_date ? dateFr(p.created_date) : "",
    "Date réception": p.received_at ? dateFr(p.received_at) : "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 18 },
    { wch: 10 }, { wch: 16 }, { wch: 9 }, { wch: 9 }, { wch: 10 },
    { wch: 12 }, { wch: 16 }, { wch: 13 }, { wch: 9 }, { wch: 13 }, { wch: 13 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Colis");

  const filename = `${title.replace(/[^\w\-]+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
