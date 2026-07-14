import * as XLSX from "xlsx";
import { num } from "./utils";

/** Yon liy ki soti nan fichye Excel MCPACK la */
export interface McpackRow {
  customer_code: string;
  customer_name: string;
  tracking_number: string;   // Tracking ID (Guía)
  weight: number;            // Peso
  quantity: number;          // Cant
  content: string;           // Contenido
  created_date: string;      // Creado
  fob: number;               // FOB (si li la)
  status_raw: string;        // Estatus (enfòmatif)
  extra: Record<string, string>; // TOUT lòt kolòn Excel la (Sucursal, Destino, Vol...) — anyen pa pèdi
}

const HEADER_KEYS: Record<keyof Omit<McpackRow, "customer_code" | "customer_name" | "extra">, string[]> & {
  cliente: string[];
} = {
  cliente: ["cliente", "client", "kliyan"],
  tracking_number: ["guia", "guía", "tracking", "numero", "número"],
  weight: ["peso", "weight", "poids"],
  quantity: ["cant", "cantidad", "qty", "quantite", "quantité"],
  content: ["contenido", "content", "kontni"],
  created_date: ["creado", "fecha", "date", "dat"],
  fob: ["fob", "valor", "price", "pri"],
  status_raw: ["estatus", "status", "estado"]
};

/**
 * Nan Excel MCPACK la, kolòn FOB la vini touswit apre dat la ("13/07/2026   56").
 * Fonksyon sa a kenbe SÈLMAN dat la — valè FOB la sere apa nan chan `fob`.
 */
function cleanDate(raw: string): string {
  const s = String(raw ?? "").trim();
  const m = s.match(/^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})/);
  return m ? m[1] : s;
}

function findCol(headers: string[], keys: string[]): number {
  return headers.findIndex((h) => keys.some((k) => h.includes(k)));
}

/**
 * Separe non + kòd kliyan, kèlkeswa fòma MCPACK la:
 *   "XTAZ GROUP 36371"      -> { code: "36371", name: "XTAZ GROUP" }
 *   "36191 - Jean Baptiste" -> { code: "36191", name: "Jean Baptiste" }
 *   "36191 Jean Baptiste"   -> { code: "36191", name: "Jean Baptiste" }
 *   "36191"                 -> { code: "36191", name: "36191" }
 * De enfòmasyon yo ale nan de chan diferan (customer_code / customer_name);
 * tout rechèch fèt sou customer_code.
 */
export function splitCliente(raw: string): { code: string; name: string } {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return { code: "", name: "" };

  // 1) Kòd nan fen an: "XTAZ GROUP 36371" / "XTAZ GROUP - 36371"
  let m = s.match(/^(.*?)[\s\-–—:|]+(\d{3,8})$/);
  if (m && m[1].trim()) return { code: m[2], name: m[1].replace(/[\-–—:|]+$/, "").trim() };

  // 2) Kòd nan kòmansman an: "36191 - Jean Baptiste" / "36191 Jean Baptiste"
  m = s.match(/^(\d{3,8})[\s\-–—:|]+(.+)$/);
  if (m) return { code: m[1], name: m[2].replace(/^[\-–—:|]+/, "").trim() };

  // 3) Kòd sèlman
  if (/^\d{3,8}$/.test(s)) return { code: s, name: s };

  // 4) Kòd alfanimerik (ex: SC-0001) + non
  m = s.match(/^([A-Za-z]{1,4}-?\d{2,8})[\s\-–—:|]+(.+)$/);
  if (m) return { code: m[1], name: m[2].trim() };
  m = s.match(/^(.+?)[\s\-–—:|]+([A-Za-z]{1,4}-?\d{2,8})$/);
  if (m) return { code: m[2], name: m[1].trim() };

  return { code: s, name: s };
}

/** Li fichye Excel MCPACK la (Exportar XLS) epi retounen liy pwòp yo */
export function parseMcpackWorkbook(buf: ArrayBuffer): McpackRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

  // Jwenn liy header a (liy ki gen omwen 3 kolòn MCPACK nou rekonèt)
  let headerIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const cells = grid[i].map((c) => String(c).toLowerCase().trim());
    const hits = ["guia", "peso", "cliente", "contenido", "estatus", "cant", "creado"]
      .filter((k) => cells.some((c) => c.includes(k))).length;
    if (hits >= 3) { headerIdx = i; headers = cells; break; }
  }
  if (headerIdx < 0) return [];

  const col = {
    cliente: findCol(headers, HEADER_KEYS.cliente),
    tracking: findCol(headers, HEADER_KEYS.tracking_number),
    weight: findCol(headers, HEADER_KEYS.weight),
    quantity: findCol(headers, HEADER_KEYS.quantity),
    content: findCol(headers, HEADER_KEYS.content),
    created: findCol(headers, HEADER_KEYS.created_date),
    fob: findCol(headers, HEADER_KEYS.fob),
    status: findCol(headers, HEADER_KEYS.status_raw)
  };

  // Header orijinal yo (pou konsève TOUT kolòn Excel la)
  const rawHeaders: string[] = (grid[headerIdx] as unknown[]).map((c) => String(c).trim());

  const rows: McpackRow[] = [];
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const r = grid[i];
    const tracking = col.tracking >= 0 ? String(r[col.tracking] ?? "").trim() : "";
    if (!tracking) continue;
    const { code, name } = splitCliente(col.cliente >= 0 ? String(r[col.cliente] ?? "") : "");

    // TOUT kolòn yo, jan yo ye nan Excel la
    const extra: Record<string, string> = {};
    rawHeaders.forEach((h, j) => {
      const v = String(r[j] ?? "").trim();
      if (h && v !== "") extra[h] = v;
    });

    rows.push({
      customer_code: code,
      customer_name: name,
      tracking_number: tracking,
      weight: col.weight >= 0 ? num(r[col.weight]) : 0,
      quantity: col.quantity >= 0 ? Math.max(1, Math.round(num(r[col.quantity]))) : 1,
      content: col.content >= 0 ? String(r[col.content] ?? "").trim() : "",
      created_date: cleanDate(col.created >= 0 ? String(r[col.created] ?? "") : ""),
      fob: col.fob >= 0 ? num(r[col.fob]) : 0,
      status_raw: col.status >= 0 ? String(r[col.status] ?? "").trim() : "",
      extra
    });
  }
  return rows;
}
