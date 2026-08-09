/*
 * STANDA COMMERCIAL — Import Excel espesifik CONDUCE (MCPACK)
 * ══════════════════════════════════════════════════════════
 * Fòma egzat paj "Conduce XXXXX" sou MCPACK (bouton "Exportar XLS"):
 *   #, ID, Guia, Nombre, Oficina, Peso, Contenido, Cantidad, Tracking Number
 * DIFERAN de lib/xlsx.ts (parseMcpackWorkbook) ki pou Excel sync jeneral la —
 * isit "Guia" (WR, kle prensipal) ak "Tracking Number" (transpòtè) se De
 * kolòn SEPARE, donk nou bezwen yon matching pi presi.
 */
import * as XLSX from "xlsx";
import { normalizeMcCode, num } from "./utils";
import { splitCliente } from "./xlsx";

export interface ConduceExcelRow {
  guia: string;              // Tracking ID (WR...) — kle prensipal
  tracking_number: string;   // Tracking Number transpòtè (kolòn "Tracking Number")
  customer_code: string;
  customer_name: string;
  office: string;            // Oficina — destinasyon (vin office Conduce a)
  weight: number;
  content: string;
  quantity: number;
}

function findCol(headers: string[], test: (h: string) => boolean): number {
  return headers.findIndex(test);
}

export function parseConduceWorkbook(buf: ArrayBuffer): ConduceExcelRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!raw.length) return [];
  const headers = raw[0].map((h) => String(h ?? "").trim().toLowerCase());

  const colGuia = findCol(headers, (h) => h.includes("guia") || h.includes("guía"));
  const colNombre = findCol(headers, (h) => h.includes("nombre") || h.includes("cliente"));
  const colOficina = findCol(headers, (h) => h.includes("oficina"));
  const colPeso = findCol(headers, (h) => h.includes("peso"));
  const colContenido = findCol(headers, (h) => h.includes("contenido"));
  const colCantidad = findCol(headers, (h) => h.includes("cantidad"));
  // "Tracking Number" — dwe SEPARE de "Guia" (evite konfizyon ak kle prensipal la)
  const colTracking = findCol(headers, (h) => h.includes("tracking"));

  const out: ConduceExcelRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || !r.length) continue;
    const guiaRaw = colGuia >= 0 ? String(r[colGuia] ?? "").trim() : "";
    if (!guiaRaw) continue;   // liy san Guia = liy total/rezime anba tablo a → ekskli otomatikman
    const { code, name } = splitCliente(colNombre >= 0 ? String(r[colNombre] ?? "") : "");
    out.push({
      guia: guiaRaw.toUpperCase().replace(/\s+/g, ""),
      tracking_number: colTracking >= 0 ? String(r[colTracking] ?? "").trim() : "",
      customer_code: normalizeMcCode(code),
      customer_name: name,
      office: colOficina >= 0 ? String(r[colOficina] ?? "").trim() : "",
      weight: colPeso >= 0 ? num(r[colPeso]) : 0,
      content: colContenido >= 0 ? String(r[colContenido] ?? "").trim() : "",
      quantity: colCantidad >= 0 ? (num(r[colCantidad]) || 1) : 1,
    });
  }
  return out;
}
