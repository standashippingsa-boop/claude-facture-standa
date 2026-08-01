/*
 * STANDA COMMERCIAL — Import Facture MCPACK (pwen #6)
 * ══════════════════════════════════════════════════════════
 * Ekstrè Tracking Number yo depi yon FACTURE MCPACK, kit se:
 *   - PDF  (tèks egzat, san erè) — via parseMcpackPdf
 *   - IMAJ / SCREENSHOT (OCR, mwens fyab) — via tesseract.js
 *
 * ⚠️ Fichye sa a PA ekri anyen nan baz done a. Li jis EKSTRÈ epi retounen
 * yon lis Tracking Number. Matching ak chanjman statut fèt yon lòt kote,
 * ak yon ekran verifikasyon (RÈG: pa janm devine, pa janm chanje san verifye).
 */
import { parseMcpackPdf } from "./pdfimport";
import { cleanTracking } from "./utils";

export interface FactureTracking {
  value: string;            // Tracking Number (transpòtè)
  weight?: number;          // Poids si disponib (PDF sèlman)
  source: "pdf" | "image";  // ki kote li soti
  raw?: string;             // tèks orijinal (dyagnostik)
}

/** WR = Tracking ID (Guía), PA yon Tracking Number transpòtè — nou ekskli yo isit. */
const reGuia = /^WR\d{6,}$/i;

/** Kandida Tracking Number nan yon tèks OCR: alfanimerik long (>=10), ak omwen 3 chif. */
function candidatesFromText(text: string): string[] {
  const up = (text || "").toUpperCase();
  const tokens = up.match(/[A-Z0-9]{10,40}/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    const c = cleanTracking(t);
    if (!c || c.length < 10) continue;
    if (reGuia.test(c)) continue;                 // ekskli Guía WR
    if ((c.match(/\d/g)?.length ?? 0) < 3) continue; // fòk gen chif (evite mo)
    if (seen.has(c)) continue;
    seen.add(c); out.push(c);
  }
  return out;
}

/** Ekstrè depi yon PDF MCPACK (tèks egzat). */
export async function extractFromPdf(buf: ArrayBuffer): Promise<FactureTracking[]> {
  const rows = await parseMcpackPdf(buf);
  const out: FactureTracking[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const v = cleanTracking(r.tracking_number);
    if (!v || reGuia.test(v)) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push({ value: v, weight: r.weight || undefined, source: "pdf", raw: r.tracking_number });
  }
  return out;
}

/** Ekstrè depi yon IMAJ / screenshot (OCR). */
export async function extractFromImage(
  file: File, onProgress?: (p: number) => void
): Promise<FactureTracking[]> {
  let text = "";
  try {
    const mod: any = await import("tesseract.js");
    const Tesseract = mod.default ?? mod;
    const { data } = await Tesseract.recognize(file, "eng", {
      logger: (m: any) => { if (m.status === "recognizing text" && onProgress) onProgress(m.progress); }
    });
    text = String(data?.text ?? "");
  } catch { text = ""; }
  return candidatesFromText(text).map((value) => ({ value, source: "image" as const }));
}

/** Dispatch selon tip fichye a. */
export async function extractFacture(
  file: File, onProgress?: (p: number) => void
): Promise<FactureTracking[]> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf) return extractFromPdf(await file.arrayBuffer());
  return extractFromImage(file, onProgress);
}
