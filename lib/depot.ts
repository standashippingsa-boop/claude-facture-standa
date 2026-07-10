import { Client } from "./types";

/** Adrès depo Ozetazini — chanje isit la si li ta chanje yon jou */
export const DEPOT = {
  address1: "1926 NW 135th St",
  city: "MIAMI",
  state: "Florida",
  zip: "33182",
  phone: "+1 (786) 685-6050"
};

/** Mesaj WhatsApp "Voye adrès depo" — non + kòd MC ranplase otomatikman */
export function buildDepotMessage(c: Client): string {
  const non = [c.fullname, c.surname].filter(Boolean).join(" ").trim() || c.fullname;
  const code = c.customer_code || "MC-____";
  return (
    `Bonjou ${non} 👋\n\n` +
    `Kont ou aktive avèk siksè.\n\n` +
    `Men adrès depo ou Ozetazini:\n\n` +
    `Full Name / Nombre completo\n${non}\n\n` +
    `Address 1\n${DEPOT.address1}\n\n` +
    `Address 2\n${code}\n\n` +
    `City\n${DEPOT.city}\n\n` +
    `State\n${DEPOT.state}\n\n` +
    `ZIP Code\n${DEPOT.zip}\n\n` +
    `Phone\n${DEPOT.phone}\n\n` +
    `⚠️ Li enpòtan anpil pou toujou mete kòd ${code} la sou Address 2 chak fwa w ap voye yon pakè. ` +
    `Se kòd sa a ki pèmèt nou idantifye tout koli ou yo.\n\n` +
    `Mèsi paske ou chwazi STANDA COMMERCIAL.`
  );
}
