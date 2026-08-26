/*
 * STANDA COMMERCIAL — Import fichye CONDUCE (MCPACK)
 * ══════════════════════════════════════════════════
 * MCPACK chanje fòma ekspòtasyon an. Modil sa a sipòte TOUDE — epi nenpòt
 * lòt fòma ki ka vini — san nou pa oblije refè l chak fwa.
 *
 * ── FÒMA A : ANSYEN (yon kolòn pa done) ──────────────────────────────────
 *   #, ID, Guia, Nombre, Oficina, Peso, Contenido, Cantidad, Tracking Number
 *   Vre fichye .xlsx. Chak enfòmasyon nan pwòp kolòn li.
 *
 * ── FÒMA B : NOUVO (de done nan yon sèl kolòn) ───────────────────────────
 *   #, GUIA / TRACKING, CLIENTE, OFICINA, PESO, CONTENIDO, CANT., ADIC.
 *   ⚠️ Fichye a rele ".xls" MEN SE YON TABLO HTML, pa yon vre Excel.
 *      SheetJS pa ka li l — li tounen l an CSV epi tout bagay kraze.
 *      Se pou sa nou detekte HTML nou menm epi nou li tablo a dirèkteman.
 *   Chak selil gen DE liy (<br>):
 *      GUIA / TRACKING  ->  WR102600171784  /  962200190000497639...
 *      CLIENTE          ->  DOKASAV SERVICES / Código: 36578
 *      PESO             ->  5.15 / LB
 *
 * ── DÈNYE LIY LA ─────────────────────────────────────────────────────────
 *   "RESUMEN DEL CONDUCE · 21 PAQUETE(S) | PESO TOTAL · 92.65 LB"
 *   Nou li l pou nou ka VERIFYE enpòtasyon an (kantite + pwa), epi nou
 *   ekskli l nan koli yo.
 *
 * ── TRACKING NUMBER ──────────────────────────────────────────────────────
 *   Yon tracking ki soti nan fichye a aksepte SÈLMAN si li sanble ak yon
 *   vre tracking (omwen 8 karaktè, lèt/chif). Sinon nou lage l — epi
 *   lib/db.ts kenbe sa ki DEJA nan sistèm nan pou koli sa a.
 */
import * as XLSX from "xlsx";
import { normalizeMcCode, num } from "./utils";
import { splitCliente } from "./xlsx";

export interface ConduceExcelRow {
  guia: string;              // Tracking ID (WR...) — kle prensipal
  tracking_number: string;   // Tracking Number transpòtè ("" si li pa bon)
  customer_code: string;
  customer_name: string;
  office: string;
  weight: number;
  content: string;
  quantity: number;
}

/** Rezime ki nan dènye liy fichye a — sèvi pou verifye enpòtasyon an. */
export interface ConduceSummary {
  packageCount: number;   // 0 si li pa nan fichye a
  totalWeight: number;    // 0 si li pa nan fichye a
}

export interface ConduceParseResult {
  rows: ConduceExcelRow[];
  summary: ConduceSummary;
  /** "A" = ansyen fòma kolòn separe · "B" = nouvo fòma HTML/de liy */
  format: "A" | "B";
}

/* ═══════════════════ ZOUTI ═══════════════════ */

const decode = (s: string) =>
  s.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
   .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
   .replace(/&aacute;/gi, "á").replace(/&eacute;/gi, "é").replace(/&iacute;/gi, "í")
   .replace(/&oacute;/gi, "ó").replace(/&uacute;/gi, "ú").replace(/&ntilde;/gi, "ñ");

/** Koupe yon selil an liy (nouvo fòma mete 2 done nan yon selil). */
const parts = (cell: string): string[] =>
  String(cell ?? "").split(/\r?\n|\u2028/).map((x) => x.trim()).filter(Boolean);

/** Yon tracking valab: omwen 8 karaktè, lèt/chif/tirè sèlman. */
function trackingValab(v: string): string {
  const t = String(v ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return t.length >= 8 ? t : "";
}

/** Tire kòd kliyan an: "Código: 36578" · "36578 - NOM" · "MC-36578". */
function tireKod(...morceaux: string[]): string {
  for (const m of morceaux) {
    const s = String(m ?? "");
    const mm = s.match(/(?:c[oó]digo|code|mc)\s*[:\-]?\s*([0-9]{3,})/i) ?? s.match(/\b([0-9]{4,})\b/);
    if (mm) return normalizeMcCode(mm[1]);
  }
  return "";
}

/* ═══════════════════ LEKTI HTML (FÒMA B) ═══════════════════ */

function estHtml(buf: ArrayBuffer): boolean {
  const tet = new TextDecoder("utf-8", { fatal: false })
    .decode(new Uint8Array(buf).slice(0, 4096)).toLowerCase();
  return tet.includes("<table") || tet.includes("<html") || tet.includes("<tr");
}

/** Tounen tablo HTML lan an menm fòm ak yon fèy Excel: string[][]. */
function lireHtml(buf: ArrayBuffer): string[][] {
  const src = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  const out: string[][] = [];
  for (const tr of src.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const ligne: string[] = [];
    for (const td of tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []) {
      let c = td.replace(/^<t[dh][^>]*>/i, "").replace(/<\/t[dh]>$/i, "");
      c = c.replace(/<br\s*\/?>/gi, "\n");          // <br> = nouvo liy nan selil la
      c = c.replace(/<[^>]+>/g, "");                // retire rès balis yo
      ligne.push(decode(c).replace(/[ \t]+/g, " ").trim());
    }
    if (ligne.length) out.push(ligne);
  }
  return out;
}

/* ═══════════════════ LEKTI EXCEL (FÒMA A) ═══════════════════ */

function lireExcel(buf: ArrayBuffer): string[][] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  return raw.map((r) => (r ?? []).map((c) => String(c ?? "")));
}

/* ═══════════════════ ANALIZ ═══════════════════ */

const trouve = (h: string[], test: (x: string) => boolean) => h.findIndex(test);

export function parseConduceFile(buf: ArrayBuffer): ConduceParseResult {
  const grid = estHtml(buf) ? lireHtml(buf) : lireExcel(buf);
  const vide: ConduceParseResult = { rows: [], summary: { packageCount: 0, totalWeight: 0 }, format: "A" };
  if (!grid.length) return vide;

  // Jwenn liy antèt la (li pa toujou premye liy nan)
  let iTet = grid.findIndex((r) =>
    r.some((c) => /guia|guía/i.test(c)) && r.some((c) => /peso/i.test(c)));
  if (iTet < 0) iTet = 0;

  const tet = grid[iTet].map((h) => h.toLowerCase().trim());

  const cGuia = trouve(tet, (h) => /guia|guía/.test(h));
  const cClient = trouve(tet, (h) => /cliente|nombre/.test(h));
  const cOficina = trouve(tet, (h) => /oficina/.test(h));
  const cPeso = trouve(tet, (h) => /peso/.test(h));
  const cContenido = trouve(tet, (h) => /contenido/.test(h));
  const cCant = trouve(tet, (h) => /cant/.test(h));
  // Kolòn tracking SEPARE (fòma A). Nan fòma B li melanje ak guia.
  const cTrack = trouve(tet, (h) => /tracking/.test(h) && !/guia|guía/.test(h));

  // Fòma B: antèt la di "GUIA / TRACKING" -> de done nan yon sèl selil
  const combine = cGuia >= 0 && cTrack < 0 && /tracking/.test(tet[cGuia] ?? "");
  const format: "A" | "B" = combine ? "B" : "A";

  const rows: ConduceExcelRow[] = [];
  const summary: ConduceSummary = { packageCount: 0, totalWeight: 0 };

  for (let i = iTet + 1; i < grid.length; i++) {
    const r = grid[i];
    if (!r || !r.length) continue;
    const brut = r.join(" ");

    // Liy rezime a: "RESUMEN DEL CONDUCE · 21 PAQUETE(S) · PESO TOTAL 92.65 LB"
    if (/resumen|paquete\(s\)|peso total/i.test(brut)) {
      const nb = brut.match(/(\d+)\s*paquete/i);
      const pw = brut.match(/peso\s*total[\s\S]*?([\d.,]+)\s*lb/i);
      if (nb) summary.packageCount = parseInt(nb[1], 10) || 0;
      if (pw) summary.totalWeight = num(pw[1]);
      continue;
    }

    const selGuia = cGuia >= 0 ? parts(r[cGuia] ?? "") : [];
    const guia = (selGuia[0] ?? "").toUpperCase().replace(/\s+/g, "");
    if (!guia || !/^[A-Z0-9-]{6,}$/.test(guia)) continue;   // liy vid / dekorasyon

    // Tracking: 2yèm liy selil la (fòma B) oswa kolòn apa (fòma A)
    const trackBrut = combine ? (selGuia[1] ?? "") : (cTrack >= 0 ? r[cTrack] ?? "" : "");

    // Kliyan: "NOM" + "Código: 36578" (fòma B) oswa "36578 - NOM" (fòma A)
    const selClient = cClient >= 0 ? parts(r[cClient] ?? "") : [];
    let nom = selClient[0] ?? "";
    let code = tireKod(...selClient.slice(1));
    if (!code) {                                   // fòma A: tout sou yon liy
      const sp = splitCliente(selClient.join(" "));
      code = normalizeMcCode(sp.code);
      if (sp.name) nom = sp.name;
    }
    // Retire kòd la si li kole nan non an
    nom = nom.replace(/c[oó]digo\s*[:\-]?\s*\d+/i, "").replace(/^\s*[\d-]+\s*[-–]\s*/, "").trim();

    rows.push({
      guia,
      tracking_number: trackingValab(trackBrut),
      customer_code: code,
      customer_name: nom,
      office: cOficina >= 0 ? String(r[cOficina] ?? "").trim() : "",
      weight: cPeso >= 0 ? num(parts(r[cPeso] ?? "")[0] ?? "") : 0,
      content: cContenido >= 0 ? (parts(r[cContenido] ?? "")[0] ?? "").trim() : "",
      quantity: cCant >= 0 ? (num(parts(r[cCant] ?? "")[0] ?? "") || 1) : 1
    });
  }

  return { rows, summary, format };
}

/** Konpatibilite: ansyen apèl la kontinye mache san chanjman. */
export function parseConduceWorkbook(buf: ArrayBuffer): ConduceExcelRow[] {
  return parseConduceFile(buf).rows;
}
