/**
 * CONSEILS IMPRIMÉS EN BAS DE CHAQUE FACTURE
 * Modifiables dans Paramètres (clé app_settings « invoice_advice », un conseil par ligne).
 * Ces textes servent tant que l'administration n'a rien enregistré.
 */
export const INVOICE_ADVICE_KEY = "invoice_advice";

export const DEFAULT_INVOICE_ADVICE: string[] = [
  "Pour retirer vos colis, présentez votre code client MC et une pièce d'identité valide à votre agence.",
  "Préparez votre retrait depuis votre espace client : l'agence aura vos colis prêts à votre arrivée.",
  "Vérifiez vos colis devant l'agent avant de quitter l'agence. Toute réclamation doit être faite sur place.",
  "Indiquez toujours votre code MC à la ligne Address Line 2 de chaque commande. Sans ce code, votre colis ne peut pas être identifié.",
  "N'expédiez jamais d'articles interdits : armes, produits inflammables, stupéfiants, argent liquide, médicaments sans ordonnance.",
  "Payez uniquement à l'agence ou par les moyens officiels STANDA (espèces, MonCash, NatCash, Zelle) et gardez toujours votre reçu.",
  "Paiement ou dépôt en gourdes : le taux appliqué peut être différent de celui indiqué sur cette facture. Le montant exact en gourdes vous est confirmé au moment du paiement.",
  "Ne communiquez jamais votre mot de passe. STANDA ne vous le demandera jamais.",
];

/** Texte enregistré (un conseil par ligne) vers liste propre ; vide = conseils par défaut. */
export function parseInvoiceAdvice(raw: string | null | undefined): string[] {
  const list = String(raw ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 20);
  return list.length ? list : DEFAULT_INVOICE_ADVICE;
}
