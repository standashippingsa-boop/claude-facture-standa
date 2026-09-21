import "server-only";
import { sendPushToCustomer, type SupabaseAdminConfig } from "@/lib/push-server";
import { sendFcmToCustomer } from "@/lib/push-fcm-server";

/**
 * Alertes push d'un colis vers le téléphone du client — SERVEUR SEULEMENT.
 * Une seule source pour le texte : /api/notify (actions de l'équipe),
 * /api/ingest (extension MCPACK) et /api/pickup-agent (Bon de remise reçu).
 * Web Push (navigateur/PWA) et FCM (app Android) partent en parallèle.
 */
export type CustomerParcelEvent = "recu_miami" | "disponible";

export function customerParcelCopy(kind: CustomerParcelEvent, count: number): { title: string; text: string } {
  const plural = count > 1;
  if (kind === "recu_miami") {
    return {
      title: "Colis reçu à Miami",
      text: plural ? `${count} colis ont été reçus à notre entrepôt.` : "Votre colis a été reçu à notre entrepôt."
    };
  }
  return {
    title: "Colis disponible",
    text: plural ? `${count} colis sont prêts à être retirés.` : "Votre colis est prêt à être retiré."
  };
}

/**
 * Une alerte par client, avec le nombre de colis concernés. Par paquets de 10
 * clients pour rester rapide sans saturer Supabase. Retourne le nombre
 * d'appareils atteints ; ne lève jamais d'erreur par client (un client sans
 * abonnement ou un jeton expiré ne doit pas bloquer les autres).
 */
export async function pushParcelEventToCustomers(
  config: SupabaseAdminConfig, countsByCustomer: Map<string, number>, kind: CustomerParcelEvent
): Promise<number> {
  const entries = Array.from(countsByCustomer.entries()).filter(([code, count]) => code && count > 0);
  let sent = 0;
  for (let start = 0; start < entries.length; start += 10) {
    const results = await Promise.allSettled(entries.slice(start, start + 10).flatMap(([code, count]) => {
      const copy = customerParcelCopy(kind, count);
      return [sendPushToCustomer(config, code, copy), sendFcmToCustomer(config, code, copy)];
    }));
    for (const result of results) if (result.status === "fulfilled") sent += result.value;
  }
  return sent;
}
