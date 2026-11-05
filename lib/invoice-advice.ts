/**
 * KONSÈY KI ENPRIME ANBA CHAK FAKTI (an kreyòl)
 * Sa ki gen pou wè ak retrè koli nan ajans lan sèlman.
 * Modifiables dans Paramètres (clé app_settings « invoice_advice », un conseil par ligne).
 */
export const INVOICE_ADVICE_KEY = "invoice_advice";
/** Numéro de patente affiché en tête de facture (Paramètres). */
export const INVOICE_PATENT_KEY = "invoice_patent";

export const DEFAULT_INVOICE_ADVICE: string[] = [
  "Pote kòd kliyan MC ou ak yon pyès idantite lè w ap vin chèche koli w nan ajans lan.",
  "Prepare retrè w nan espas kliyan an anvan w vini, konsa ajans lan ap gen koli w yo pare.",
  "Fò w peye fakti a nèt anvan ou pran koli w yo.",
  "Peye sèlman nan ajans lan oswa sou MonCash, NatCash ak Zelle STANDA. Mande yon resi pou chak peman epi kenbe l.",
  "Si w ap peye an goud, to a ka diferan de sa ki sou fakti a. Ajan an ap di w montan an goud la lè w ap peye.",
  "Tcheke koli w yo devan ajan an anvan w soti nan ajans lan. Si gen yon pwoblèm, di l sou plas.",
  "Si se yon lòt moun k ap vin chèche koli w, avèti ajans lan davans.",
];

/** Texte enregistré (un conseil par ligne) vers liste propre ; vide = conseils par défaut. */
export function parseInvoiceAdvice(raw: string | null | undefined): string[] {
  const list = String(raw ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 20);
  return list.length ? list : DEFAULT_INVOICE_ADVICE;
}
