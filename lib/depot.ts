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
 * (username MC + modpas) si yo bay password la.
 */
/** Identifiants seuls (sans l'adresse de dépôt). */
export function buildCredentialsMessage(c: Client, username: string, password: string, fresh: boolean): string {
  const non = [c.fullname, c.surname].filter(Boolean).join(" ").trim() || c.fullname;
  return `Bonjour ${non},

` +
    (fresh ? `Voici votre nouveau mot de passe STANDA COMMERCIAL.

` : `Voici vos informations de connexion STANDA COMMERCIAL.

`) +
    `Nom d'utilisateur :
${username}

` +
    `Mot de passe :
${password}

` +
    `Connexion :
https://www.standacommercialsa.com/espace-client/connexion

` +
    `Ne partagez jamais ces informations. Vous pouvez changer votre mot de passe dans votre espace personnel.

` +
    `Merci.
STANDA COMMERCIAL`;
}

export function buildDepotMessage(c: Client, password?: string): string {
  const non = [c.fullname, c.surname].filter(Boolean).join(" ").trim() || c.fullname;
  const code = c.customer_code || c.username || "MC-_____";
  let msg =
    `Bonjour ${non},\n\n` +
    `Votre adresse de dépôt aux USA est maintenant disponible.\n\n` +
    `Nom :\n${non}\n\n` +
    `Adresse 1 :\n${DEPOT.address1}\n\n` +
    `Adresse 2 :\n${code}\n\n` +
    `Ville :\nMiami\n\n` +
    `État :\n${DEPOT.state}\n\n` +
    `Code Postal :\n${DEPOT.zip}\n\n` +
    `Téléphone :\n${DEPOT.phone}\n\n` +
    `⚠️ IMPORTANT\n` +
    `Utilisez toujours votre code ${code} sur chacun de vos colis.\n` +
    `Sans ce code, nous ne pourrons pas identifier vos colis.\n`;
  if (password) {
    msg +=
      `\n----------------------------------------\n` +
      `INFORMATIONS DE CONNEXION\n\n` +
      `Nom d'utilisateur :\n${code}\n\n` +
      `Mot de passe :\n${password}\n\n` +
      `Conservez ces informations. Vous pourrez modifier votre mot de passe dans votre espace personnel si vous le souhaitez.\n`;
  }
  msg +=
    `\nACCÉDER À VOTRE COMPTE\n\n` +
    `https://www.standacommercialsa.com/espace-client/connexion\n\n` +
    `📱 APPLICATION MOBILE\n\n` +
    `L’application STANDA sera bientôt disponible sur Google Play et l’App Store.\n`;
  msg += `\nMerci.\nSTANDA COMMERCIAL`;
  return msg;
}
