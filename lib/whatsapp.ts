import { Invoice } from "./types";
import { htg, usd } from "./utils";

/** Kite chif sèlman. Si 8 chif -> ajoute 509 (Ayiti). */
export function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length === 8) d = "509" + d;
  return d;
}

/** Mesaj kout, santre sou fakti PDF la (fallback lè pataj fichye pa posib) */
export function buildMessage(inv: Invoice): string {
  return (
    `Bonjou ${inv.customer_name},\n` +
    `Men fakti STANDA COMMERCIAL ou a: No ${inv.invoice_number} — ` +
    `${usd(inv.grand_total)} (${htg(inv.total_htg || inv.grand_total * inv.exchange_rate_used)}).\n` +
    (inv.pdf_url ? `Telechaje PDF la: ${inv.pdf_url}` : "")
  );
}

export function openWhatsAppLink(inv: Invoice) {
  const phone = normalizePhone(inv.whatsapp);
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildMessage(inv))}`, "_blank");
}

/**
 * Voye FAKTI PDF LA menm sou WhatsApp.
 * 1) Sou telefòn/tablèt (ak Chrome/Safari modèn): Web Share API pataje FICHYE PDF la
 *    dirèkteman — ou chwazi WhatsApp, kontak la, epi w peze Send. Se PDF la k ale.
 * 2) Si aparèy la pa sipòte pataj fichye (ex: Chrome sou Windows):
 *    nou ouvri chat WhatsApp kliyan an ak lyen dirèk PDF la (Supabase Storage) —
 *    kliyan an klike epi li jwenn menm PDF la.
 * Retounen: "file" | "link" | "cancel"
 */
export async function sendInvoicePdfWhatsApp(
  inv: Invoice, blob: Blob, filename: string
): Promise<"file" | "link" | "cancel"> {
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
        text: `Facture ${inv.invoice_number} — STANDA COMMERCIAL`
      });
      return "file";
    } catch (e: any) {
      if (e?.name === "AbortError") return "cancel";
      // si share echwe pou lòt rezon -> fallback lyen
    }
  }
  openWhatsAppLink(inv);
  return "link";
}

/** Konpatibilite ak ansyen kòd ki rele openWhatsApp(inv, count) */
export function openWhatsApp(inv: Invoice, _count?: number) {
  openWhatsAppLink(inv);
}
