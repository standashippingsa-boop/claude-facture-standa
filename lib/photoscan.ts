import { cleanTracking, isGuia, normalizeMcCode } from "./utils";

/**
 * SMART SCANNER — ANALYSE PHOTOS DES COLIS (V8.5)
 * ────────────────────────────────────────────────
 * Scanner a PA devine JANM. Li analize pa etap, nan lòd konfyans:
 *
 *  ETAP 1 — BARCODE (pi fyab): ekstrè Tracking ID (Guía WR...) → si li li l
 *           ak konfyans wo, li kanpe la.
 *  ETAP 2 — TRACKING ID nan tèks: chèche TOUT WR... sou etikèt la, kenbe sa
 *           ki repete plizyè fwa (konfyans pi wo).
 *  ETAP 3 — TRACKING NUMBER: sèlman nan zòn "Numero de tracking" etikèt la.
 *  ETAP 4 — CUSTOMER CODE: MC-XXXXX oswa XXXXX (prefiks ajoute otomatikman).
 *  ETAP 5 — Si konfyans ba → "À vérifier manuellement" (okenn enpòtasyon oto).
 *
 * Pwa PA analize (V8.5 §6): pwa ofisyèl la se sa ki nan sistèm nan.
 */

export type ScanStep = "barcode" | "guia_text" | "tracking_number" | "customer_code" | "none";

export interface PhotoScan {
  filename: string;
  previewUrl: string;        // apèsi pou validasyon manyèl
  guia: string;              // Tracking ID (WR...)
  guiaSource: ScanStep;
  tracking_number: string;   // tracking transpòtè (GFUS/TBA/1Z...)
  customer_code: string;
  confidence: number;        // 0–100
  step: ScanStep;            // etap kote nou rive jwenn yon idantifyan
  rawText: string;
}

const reGuiaG = /WR\d{9,}/gi;
const reMc = /MC[-\s]?(\d{3,8})/gi;
const reBare = /\b(\d{4,6})\b/g;
// Tracking transpòtè konnen (PA WR)
const reCarrier = /\b(?:GFUS|TBA|UUS|SPX|SWX|1Z|9400|9274)[A-Z0-9]{4,}\b|\b\d{15,}\b/gi;

/** ETAP 1 — Li barcode/QR la. Retounen {value, confidence}. */
async function readBarcode(file: File): Promise<{ value: string; confidence: number }> {
  try {
    const zxing: any = await import("@zxing/library");
    const reader = new zxing.BrowserMultiFormatReader();
    const url = URL.createObjectURL(file);
    try {
      const result = await reader.decodeFromImageUrl(url);
      const text = cleanTracking(String(result?.getText?.() ?? result?.text ?? ""));
      const m = text.match(/WR\d{9,}/i);
      // Barcode ki bay yon Guía valab = konfyans maksimòm
      if (m) return { value: m[0].toUpperCase(), confidence: 99 };
      return { value: text, confidence: text ? 80 : 0 };
    } finally {
      URL.revokeObjectURL(url);
      try { reader.reset(); } catch { /* skip */ }
    }
  } catch {
    return { value: "", confidence: 0 };
  }
}

/** OCR — retounen tèks + konfyans mwayen Tesseract la. */
async function ocrImage(file: File, onProgress?: (p: number) => void):
  Promise<{ text: string; confidence: number }> {
  try {
    const mod: any = await import("tesseract.js");
    const Tesseract = mod.default ?? mod;
    const { data } = await Tesseract.recognize(file, "eng", {
      logger: (m: any) => { if (m.status === "recognizing text" && onProgress) onProgress(m.progress); }
    });
    return { text: String(data?.text ?? ""), confidence: Number(data?.confidence ?? 0) };
  } catch {
    return { text: "", confidence: 0 };
  }
}

/**
 * ETAP 2 — Chèche TOUT Guía nan tèks la; kenbe sa ki repete plizyè fwa.
 * Nou pa pran premye a san verifikasyon.
 */
function bestGuia(text: string): { value: string; confidence: number } {
  const all = (text.toUpperCase().match(reGuiaG) ?? []).map(cleanTracking);
  if (!all.length) return { value: "", confidence: 0 };
  const count = new Map<string, number>();
  all.forEach((g) => count.set(g, (count.get(g) ?? 0) + 1));
  const sorted = [...count.entries()].sort((a, b) => b[1] - a[1]);
  const [value, n] = sorted[0];
  // Repete 2+ fwa = bon konfyans; yon sèl fwa = mwayen; plizyè diferan = pi ba
  const distinct = sorted.length;
  let confidence = n >= 2 ? 92 : 70;
  if (distinct > 1 && n === sorted[1]?.[1]) confidence = 45;  // egalite = dout
  return { value, confidence };
}

/** ETAP 3 — Tracking Number: SÈLMAN nan zòn "Numero de tracking". */
function trackingFromZone(text: string): { value: string; confidence: number } {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/numero\s*de\s*tracking|tracking\s*number/i.test(lines[i])) {
      // Nimewo a ka sou menm liy lan oswa liy ki vin apre
      const zone = [lines[i], lines[i + 1] ?? "", lines[i + 2] ?? ""].join(" ").toUpperCase();
      const m = zone.match(reCarrier);
      if (m) {
        const v = cleanTracking(m.find((x) => !isGuia(x)) ?? "");
        if (v && !isGuia(v)) return { value: v, confidence: 85 };
      }
    }
  }
  return { value: "", confidence: 0 };
}

/** ETAP 4 — Customer Code. */
function customerFromText(text: string, guia: string): string {
  const up = text.toUpperCase();
  const mc = [...up.matchAll(reMc)];
  if (mc.length) return normalizeMcCode(mc[0][1]);
  const bare = [...up.matchAll(reBare)].map((m) => m[1]).filter((n) => !guia.includes(n));
  return bare.length ? normalizeMcCode(bare[0]) : "";
}

/** Analize yon sèl foto — lòd etap yo respekte. */
export async function scanOnePhoto(
  file: File, onProgress?: (p: number) => void
): Promise<PhotoScan> {
  const previewUrl = URL.createObjectURL(file);
  const base: PhotoScan = {
    filename: file.name, previewUrl, guia: "", guiaSource: "none",
    tracking_number: "", customer_code: "", confidence: 0, step: "none", rawText: ""
  };

  // ── ETAP 1: BARCODE ──
  const bc = await readBarcode(file);
  if (bc.confidence >= 98 && isGuia(bc.value)) {
    // Konfyans wo: nou kanpe la, pa bezwen analize rès foto a
    return { ...base, guia: bc.value, guiaSource: "barcode", confidence: bc.confidence, step: "barcode" };
  }

  // ── OCR pou etap 2-4 ──
  const ocr = await ocrImage(file, onProgress);
  const text = ocr.text;
  const result: PhotoScan = { ...base, rawText: text };

  // ── ETAP 2: TRACKING ID nan tèks ──
  const g = bestGuia(text);
  if (bc.value && isGuia(bc.value)) {
    result.guia = bc.value; result.guiaSource = "barcode";
    result.confidence = Math.max(bc.confidence, g.value === bc.value ? 95 : bc.confidence);
    result.step = "barcode";
  } else if (g.value) {
    result.guia = g.value; result.guiaSource = "guia_text";
    result.confidence = g.confidence; result.step = "guia_text";
  }

  // ── ETAP 3: TRACKING NUMBER (zòn dedye) ──
  const t = trackingFromZone(text);
  if (t.value) {
    result.tracking_number = t.value;
    if (!result.guia) { result.confidence = t.confidence; result.step = "tracking_number"; }
  }

  // ── ETAP 4: CUSTOMER CODE ──
  result.customer_code = customerFromText(text, result.guia);
  if (!result.guia && !result.tracking_number && result.customer_code) {
    result.confidence = Math.min(60, ocr.confidence);
    result.step = "customer_code";
  }

  if (result.step === "none") result.confidence = Math.min(30, ocr.confidence);
  return result;
}

/** Analize plizyè foto youn pa youn (santèn foto sipòte). */
export async function scanPhotos(
  files: File[],
  onFile?: (idx: number, total: number, progress: number) => void
): Promise<PhotoScan[]> {
  const out: PhotoScan[] = [];
  for (let i = 0; i < files.length; i++) {
    onFile?.(i, files.length, 0);
    out.push(await scanOnePhoto(files[i], (p) => onFile?.(i, files.length, p)));
  }
  return out;
}
