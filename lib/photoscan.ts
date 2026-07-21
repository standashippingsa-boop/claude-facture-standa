import { normalizeMcCode } from "./utils";

/**
 * ANALYSE PHOTOS DES COLIS — V8 Faz 3 (amelyore)
 * ────────────────────────────────────────────────
 * Estrateji 2 nivo pou chak foto:
 *   1) KÒD BAR (Code128) — nou li Guía a (WR102600...) dirèkteman. Se metòd ki
 *      pi fyab la: menm si foto a yon ti jan flou, kòd bar la rete lizib.
 *   2) OCR (Tesseract) — pou lòt enfo yo: Customer Code, Tracking, Pwa.
 *
 * Guía a (soti nan kòd bar) se idantifikasyon prensipal la. Si OCR bay yon
 * enfo ki pa dakò ak sa ki nan sistèm nan pou menm Guía a, nou make yon
 * ENKOYERANS epi nou rapòte l apre analiz la.
 */

export interface PhotoScan {
  filename: string;
  guia: string;              // soti nan kòd bar (pi fyab) oswa OCR
  guiaSource: "barcode" | "ocr" | "";
  customer_code: string;     // OCR
  tracking: string;          // OCR
  weight: number;            // OCR (si lizib)
  rawText: string;
}

const reGuia = /WR\d{9,}/i;
const reGuiaG = /WR\d{9,}/gi;
const reMc = /MC[-\s]?(\d{3,8})/gi;
const reBareCode = /\b(\d{4,6})\b/g;
const reTracking = /\b(?:GFUS|TBA|UUS|SPX|SWX|1Z)[A-Z0-9]{6,}\b|\b\d{15,}\b/gi;
const reWeight = /(\d{1,3}[.,]\d{1,2})\s*(?:lb|lbs|libra)/i;

/** Li kòd bar la nan yon imaj (Code128 / lòt fòma) — retounen Guía a si jwenn. */
async function readBarcode(file: File): Promise<string> {
  try {
    const zxing: any = await import("@zxing/library");
    const reader = new zxing.BrowserMultiFormatReader();
    const url = URL.createObjectURL(file);
    try {
      const result = await reader.decodeFromImageUrl(url);
      const text = String(result?.getText?.() ?? result?.text ?? "").trim();
      const m = text.match(reGuia);
      return m ? m[0].toUpperCase() : (text || "");
    } finally {
      URL.revokeObjectURL(url);
      try { reader.reset(); } catch { /* skip */ }
    }
  } catch {
    return "";   // pa gen kòd bar lizib — n ap tonbe sou OCR
  }
}

/** OCR yon imaj -> tèks. */
async function ocrImage(file: File, onProgress?: (p: number) => void): Promise<string> {
  const mod: any = await import("tesseract.js");
  const Tesseract = mod.default ?? mod;
  const { data } = await Tesseract.recognize(file, "eng", {
    logger: (m: any) => { if (m.status === "recognizing text" && onProgress) onProgress(m.progress); }
  });
  return String(data?.text ?? "");
}

export function extractFromText(text: string) {
  const up = text.toUpperCase();
  const guia = (up.match(reGuiaG) ?? [])[0] ?? "";

  let customer_code = "";
  const mc = [...up.matchAll(reMc)];
  if (mc.length) customer_code = normalizeMcCode(mc[0][1]);
  else {
    const bare = [...up.matchAll(reBareCode)].map((m) => m[1]).filter((n) => !guia.includes(n));
    if (bare.length) customer_code = normalizeMcCode(bare[0]);
  }

  let tracking = "";
  const tk = [...up.matchAll(reTracking)].map((m) => m[0]).filter((t) => t !== guia);
  if (tk.length) tracking = tk.sort((a, b) => b.length - a.length)[0];

  let weight = 0;
  const w = text.match(reWeight);
  if (w) weight = parseFloat(w[1].replace(",", "."));

  return { guia, customer_code, tracking, weight };
}

/** Analize yon sèl foto: kòd bar (Guía) + OCR (rès). */
export async function scanOnePhoto(
  file: File, onProgress?: (p: number) => void
): Promise<PhotoScan> {
  const [barcode, text] = await Promise.all([readBarcode(file), ocrImage(file, onProgress)]);
  const fromText = extractFromText(text);
  const barGuia = barcode.match(reGuia)?.[0]?.toUpperCase() ?? "";
  return {
    filename: file.name,
    guia: barGuia || fromText.guia,
    guiaSource: barGuia ? "barcode" : fromText.guia ? "ocr" : "",
    customer_code: fromText.customer_code,
    tracking: fromText.tracking,
    weight: fromText.weight,
    rawText: text
  };
}

/** Analize plizyè foto youn apre lòt (pou pa satire memwa telefòn/navigatè). */
export async function scanPhotos(
  files: File[],
  onFile?: (idx: number, total: number, progress: number) => void
): Promise<PhotoScan[]> {
  const out: PhotoScan[] = [];
  for (let i = 0; i < files.length; i++) {
    out.push(await scanOnePhoto(files[i], (p) => onFile?.(i, files.length, p)));
  }
  return out;
}
