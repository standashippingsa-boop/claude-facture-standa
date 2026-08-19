import { Client } from "./types";

/** Adrès depo Ozetazini — chanje isit la si li ta chanje yon jou */
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
    `Bonjour ${non},

` +
    `Votre adresse de dépôt aux États-Unis est maintenant disponible.

` +
    `Nom :
${non}

` +
    `Adresse 1 :
${DEPOT.address1}

` +
    `Adresse 2 :
${code}

` +
    `Ville :
Miami

` +
    `État :
${DEPOT.state}

` +
    `Code Postal :
${DEPOT.zip}

` +
    `Téléphone :
${DEPOT.phone}

` +
    `⚠️ IMPORTANT
` +
    `Toujours utiliser votre code ${code} sur chacun de vos colis.
` +
    `Sans ce code nous ne pourrons pas identifier vos colis.
`;
  if (tempPassword) {
    msg +=
      `
----------------------------------------
` +
      `INFORMATIONS DE CONNEXION

` +
      `Nom d'utilisateur :
${code}

` +
      `Mot de passe temporaire :
${tempPassword}

` +
      `Veuillez conserver ces informations.
` +
      `Lors de votre première connexion, le système vous demandera de créer un nouveau mot de passe.
`;
  }
  msg += `
Merci.
STANDA COMMERCIAL`;
  return msg;
}
