import { Client, Invoice } from "./types";
import { buildDepotMessage } from "./depot";
import { htg, usd } from "./utils";

/** Kite chif sèlman. Si 8 chif -> ajoute 509 (Ayiti). */
export function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length === 8) d = "509" + d;
  return d;
}

/** Mesaj kout san okenn lyen depo entèn. */
export function buildMessage(inv: Invoice): string {
  return (
    `Bonjou ${inv.customer_name},\n` +
    `Men fakti STANDA COMMERCIAL ou a: No ${inv.invoice_number} — ` +
    `${usd(inv.grand_total)} (${htg(inv.total_htg || inv.grand_total * inv.exchange_rate_used)}).\n` +
    "PDF la disponib nan espas kliyan STANDA ou a."
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
 * 2) Si aparèy la pa sipòte pataj fichye (ex: Chrome sou Windows), nou ouvri
 *    chat la SAN lyen depo. Admin lan ka telechaje fichye a epi atache li.
 * Retounen: "file" | "manual" | "cancel"
 */
export async function sendInvoicePdfWhatsApp(
  inv: Invoice, blob: Blob, filename: string
): Promise<"file" | "manual" | "cancel"> {
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
  return "manual";
}

/** Konpatibilite ak ansyen kòd ki rele openWhatsApp(inv, count) */
export function openWhatsApp(inv: Invoice, _count?: number) {
  openWhatsAppLink(inv);
}

/** 📲 Voye adrès depo Ozetazini bay kliyan an sou WhatsApp */
export function openDepotWhatsApp(c: Client, password?: string) {
  const phone = normalizePhone(c.whatsapp || c.phone || "");
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildDepotMessage(c, password))}`, "_blank");
}

/** Mesaj pou notifye yon kliyan sou plizyè koli (File d'attente WhatsApp — bulk actions). */
export function buildPackagesMessage(
  clientName: string, pkgs: { tracking_number: string; content?: string; status: string }[]
): string {
  const lignes = pkgs.map((p) => `• ${p.tracking_number}${p.content ? " — " + p.content : ""} (${p.status})`);
  return (
    `Bonjou ${clientName},\n` +
    `Nouvèl sou ${pkgs.length > 1 ? "vos colis" : "votre colis"} STANDA COMMERCIAL :\n\n` +
    lignes.join("\n") +
    `\n\nMèsi paske ou fè STANDA COMMERCIAL konfyans.`
  );
}

/** Louvri WhatsApp ak mesaj pre-ranpli pou yon kliyan + lis koli l yo (klik → moun nan voye). */
export function openPackagesWhatsApp(
  client: { fullname: string; whatsapp?: string; phone?: string },
  pkgs: { tracking_number: string; content?: string; status: string }[]
) {
  const phone = normalizePhone(client.whatsapp || client.phone || "");
  const msg = buildPackagesMessage(client.fullname, pkgs);
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
}
