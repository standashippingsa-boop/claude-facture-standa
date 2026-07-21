import { normalizeMcCode } from "./utils";

/**
 * IMPORT PDF MCPACK (V8 Faz 2)
 * ─────────────────────────────
 * PDF MCPACK yo se yon eksport HTML→PDF ak yon tablo:
 *   #  Guía  Tracking Number  Peso  Contenido  Fecha  Estatus
 * (PDF sa yo PA gen Customer Code — admin chwazi kliyan an apre.)
 *
 * Nou ekstrè tèks la ak pozisyon li (pdfjs), rekonstwi liy yo pa koòdone Y,
 * epi separe kolòn yo pa koòdone X selon antèt yo.
 */

export interface PdfPkgRow {
  guia: string;            // Guía (WR...)
  tracking_number: string; // Tracking Number
  weight: number;          // Peso
  content: string;         // Contenido
  created_date: string;    // Fecha (dat sèlman — pou afichaj/tri, menm fòma ak Excel)
  heure: string;           // Heure (apa)
  status_raw: string;      // Estatus
}

interface TextItem { x: number; y: number; s: string; }

/** Chaje pdfjs sèlman nan navigatè a (worker via CDN). */
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  // Worker: sèvi ak menm vèsyon an depi CDN pou evite pwoblèm build
  (pdfjs as any).GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjs as any).version}/pdf.worker.min.mjs`;
  return pdfjs;
}

/** Ekstrè tout eleman tèks yo ak pozisyon (x,y) sou tout paj yo. */
async function extractItems(buf: ArrayBuffer): Promise<TextItem[]> {
  const pdfjs = await loadPdfjs();
  const doc = await (pdfjs as any).getDocument({ data: buf }).promise;
  const items: TextItem[] = [];
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    const H = page.getViewport({ scale: 1 }).height;
    const pageOffset = (pageNo - 1) * 100000; // separe paj yo nan espas Y
    for (const it of content.items as any[]) {
      const str = String(it.str ?? "").trim();
      if (!str) continue;
      const x = it.transform[4];
      const y = pageOffset + (H - it.transform[5]); // Y desann (0 = anlè)
      items.push({ x, y, s: str });
    }
  }
  return items;
}

/** Gwoupe eleman yo an liy (menm Y apeprè), triye chak liy pa X. */
function groupRows(items: TextItem[], tol = 4): TextItem[][] {
  const sorted = items.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: TextItem[][] = [];
  let cur: TextItem[] = [];
  let curY = -1;
  for (const it of sorted) {
    if (curY < 0 || Math.abs(it.y - curY) <= tol) {
      cur.push(it); curY = curY < 0 ? it.y : curY;
    } else {
      rows.push(cur.sort((a, b) => a.x - b.x));
      cur = [it]; curY = it.y;
    }
  }
  if (cur.length) rows.push(cur.sort((a, b) => a.x - b.x));
  return rows;
}

const reGuia = /^WR\d{6,}/i;
const reDate = /(\d{4})-(\d{2})-(\d{2})[ T]+(\d{1,2}:\d{2}(?::\d{2})?)/;   // 2026-07-15 11:20:02
const reDateAlt = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})[ T]*(\d{1,2}:\d{2}(?::\d{2})?)?/; // 15/07/2026

/**
 * Analize yon PDF MCPACK -> lis koli.
 * Metòd robis: nou chèche Guía a (WR...) nan chak liy, epi nou entèprete rès
 * eleman yo pa pozisyon (tracking apre guia, pwa = premye chif desimal, dat, estatus).
 */
export async function parseMcpackPdf(buf: ArrayBuffer): Promise<PdfPkgRow[]> {
  const items = await extractItems(buf);
  const rows = groupRows(items);
  const out: PdfPkgRow[] = [];

  // Detekte pozisyon X kolòn yo apati liy antèt la (si li la)
  let xTracking = 0, xPeso = 0, xContenido = 0, xFecha = 0, xEstatus = 0;
  for (const r of rows) {
    const joined = r.map((c) => c.s.toLowerCase()).join(" ");
    if (joined.includes("guia") || joined.includes("guía")) {
      for (const c of r) {
        const l = c.s.toLowerCase();
        if (l.includes("tracking")) xTracking = c.x;
        else if (l.includes("peso")) xPeso = c.x;
        else if (l.includes("contenido")) xContenido = c.x;
        else if (l.includes("fecha")) xFecha = c.x;
        else if (l.includes("estatus") || l.includes("estado")) xEstatus = c.x;
      }
      break;
    }
  }

  for (const r of rows) {
    const guiaItem = r.find((c) => reGuia.test(c.s));
    if (!guiaItem) continue;                       // liy san Guía = antèt/pye paj
    const guia = guiaItem.s.match(reGuia)?.[0] ? guiaItem.s : guiaItem.s;

    // Rekonstwi dat/lè (ka nan youn oswa de eleman)
    const full = r.map((c) => c.s).join(" ");
    let created_date = "", heure = "";
    const m = full.match(reDate) || full.match(reDateAlt);
    if (m) {
      if (m[0].includes("-") && m[1].length === 4) {
        created_date = `${m[3]}/${m[2]}/${m[1]}`;   // aaaa-mm-jj -> jj/mm/aaaa
        heure = m[4] ?? "";
      } else {
        created_date = `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}`;
        heure = m[4] ?? "";
      }
    }

    // Pwa = premye nonm desimal apre guia ki pa fè pati dat la
    let weight = 0;
    for (const c of r) {
      if (c === guiaItem) continue;
      const w = c.s.match(/^\d{1,4}(?:[.,]\d{1,2})?$/);
      if (w && c.x >= (xPeso ? xPeso - 20 : 0) && c.x < (xContenido || 1e9)) {
        weight = parseFloat(c.s.replace(",", ".")); break;
      }
    }
    if (!weight) {
      const w = full.match(/\b(\d{1,4}[.,]\d{1,2})\b/);
      if (w) weight = parseFloat(w[1].replace(",", "."));
    }

    // Tracking Number: eleman ki apre guia, alfanimerik long, ki pa dat/pwa
    let tracking_number = "";
    for (const c of r) {
      if (c === guiaItem) continue;
      if (reGuia.test(c.s)) continue;
      if (/^\d{4}-\d{2}-\d{2}/.test(c.s)) continue;
      if (/^\d{1,4}[.,]?\d{0,2}$/.test(c.s)) continue;
      if (xTracking && Math.abs(c.x - xTracking) < 60 && c.s.length >= 6) { tracking_number = c.s; break; }
    }
    if (!tracking_number) {
      // fallback: pi long token alfanimerik ki pa guia
      const cand = r.map((c) => c.s).filter((s) => !reGuia.test(s) && /[A-Za-z0-9]{8,}/.test(s) && !reDate.test(s));
      tracking_number = cand.sort((a, b) => b.length - a.length)[0] ?? "";
    }

    // Contenido: tèks ki nan zòn Contenido (ant xContenido ak xFecha)
    let content = "";
    if (xContenido) {
      content = r.filter((c) => c.x >= xContenido - 20 && (xFecha ? c.x < xFecha - 10 : true)
        && !/^\d/.test(c.s) && c !== guiaItem)
        .map((c) => c.s).join(" ").trim();
    }

    // Estatus: tèks ki nan zòn Estatus (apre xEstatus/xFecha)
    let status_raw = "";
    if (xEstatus) {
      status_raw = r.filter((c) => c.x >= xEstatus - 30).map((c) => c.s).join(" ").trim();
    }
    if (!status_raw) {
      const known = ["Transferido a Sucursal", "Embarcado", "Recibido", "En Transito", "Entregado"];
      status_raw = known.find((k) => full.toLowerCase().includes(k.toLowerCase())) ?? "";
    }
    // netwaye estatus pou l pa gen dat/tracking ladan l
    status_raw = status_raw.replace(reDate, "").replace(guia, "").trim();

    out.push({
      guia,
      tracking_number: tracking_number || guia,
      weight,
      content: content.replace(/\s{2,}/g, " ").trim(),
      created_date,
      heure,
      status_raw
    });
  }

  return out;
}

/** Nòmalize kòd si admin antre yon kliyan (pou konsistans). */
export const normalizePdfClientCode = normalizeMcCode;
