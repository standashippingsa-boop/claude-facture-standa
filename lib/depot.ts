import { Client } from "./types";

/** Adrès depo ou USA — chanje isit la si li ta chanje yon jou */
export const DEPOT = {
  address1: "1926 NW 135th AVE",
  city: "MIAMI",
  state: "Florida",
  zip: "33182-1928",
  phone: "+1 (786) 685-6050"
};

/**
 * Mesaj WhatsApp "Voye adrès depo" — fransè, ak enfòmasyon koneksyon yo
 * (username MC + modpas tanporè) si yo bay tempPassword la.
 */
export function buildDepotMessage(c: Client, tempPassword?: string): string {
  const non = [c.fullname, c.surname].filter(Boolean).join(" ").trim() || c.fullname;
  const code = c.customer_code || c.username || "MC-_____";
  let msg =
    `Bonjour ${non},\n\n` +
    `Votre adresse de dépôt aux États-Unis est maintenant disponible.\n\n` +
    `Nom :\n${non}\n\n` +
    `Adresse 1 :\n${DEPOT.address1}\n\n` +
    `Adresse 2 :\n${code}\n\n` +
    `Ville :\nMiami\n\n` +
    `État :\n${DEPOT.state}\n\n` +
    `Code Postal :\n${DEPOT.zip}\n\n` +
    `Téléphone :\n${DEPOT.phone}\n\n` +
    `⚠️ IMPORTANT\n` +
    `Toujours utiliser votre code ${code} sur chacun de vos colis.\n` +
    `Sans ce code nous ne pourrons pas identifier vos colis.\n`;
  if (tempPassword) {
    msg +=
      `\n----------------------------------------\n` +
      `INFORMATIONS DE CONNEXION\n\n` +
      `Nom d'utilisateur :\n${code}\n\n` +
      `Mot de passe :\n${tempPassword}\n\n` +
      `Veuillez conserver ces informations.\n`;
  }
  msg += `\nMerci.\nSTANDA COMMERCIAL`;
  return msg;
}
