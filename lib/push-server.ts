import "server-only";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

/**
 * Anvwa notifikasyon PUSH — SÈVÈ SÈLMAN (kle prive VAPID pa janm rive nan
 * navigatè a). Itilize pa /api/notify (imèl+push kliyan otantifye) AK
 * /api/pickup-agent (livrezon ajan) — de sèl kote ki gen kle sèvis Supabase.
 */
export interface SupabaseAdminConfig { url: string; key: string; }

/** Kle piblik la se yon valè piblik: sèvè a reutilize menm valè kliyan an. */
function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
}

/** Konfigire VAPID yon sèl fwa; retounen false si kle yo pa mete (Vercel). */
function vapidReady(): boolean {
  return !!(vapidPublicKey() && process.env.VAPID_PRIVATE_KEY);
}

export async function sendPushToCustomer(
  config: SupabaseAdminConfig, customerCode: string, payload: { title: string; text: string; url?: string }
): Promise<number> {
  return sendPushToRecipient(config, "push_subscriptions", "customer_code", customerCode,
    { ...payload, url: payload.url || "/espace-client" });
}

/** Envoie une alerte Web Push à un agent qui a activé les notifications. */
export async function sendPushToStaff(
  config: SupabaseAdminConfig, staffId: string, payload: { title: string; text: string; url?: string }
): Promise<number> {
  return sendPushToRecipient(config, "staff_push_subscriptions", "staff_id", staffId,
    { ...payload, url: payload.url || "/espace-remise" });
}

async function sendPushToRecipient(
  config: SupabaseAdminConfig, table: "push_subscriptions" | "staff_push_subscriptions",
  recipientColumn: "customer_code" | "staff_id", recipient: string,
  payload: { title: string; text: string; url?: string }
): Promise<number> {
  if (!vapidReady() || !recipient) return 0;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:notifications@standacommercialsa.com",
    vapidPublicKey(), process.env.VAPID_PRIVATE_KEY!
  );

  const svc = createClient(config.url, config.key, { auth: { persistSession: false } });
  const { data: subs } = await svc.from(table)
    .select("id, endpoint, p256dh, auth").eq(recipientColumn, recipient);
  if (!subs?.length) return 0;

  const message = JSON.stringify({ title: payload.title, body: payload.text, url: payload.url || "/" });
  let sent = 0;
  await Promise.all(subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message);
      sent++;
    } catch (e: unknown) {
      // Abònman ekspire/envalid (aparèy dezenstale, itilizatè dezabòne nan
      // navigatè a) — netwaye l pou nou pa reeseye l pou granmesi.
      const statusCode = (e as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await svc.from(table).delete().eq("id", s.id);
      }
    }
  }));
  return sent;
}
