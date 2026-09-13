import "server-only";
import { createClient } from "@supabase/supabase-js";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

/**
 * Notifikasyon PUSH NATIF (app Android/Uptodown) — SÈVÈ SÈLMAN.
 * ═══════════════════════════════════════════════════════════
 * `lib/push-server.ts` (Web Push/VAPID) mache pou navigatè (Chrome, Edge,
 * PWA "Add to Home Screen"). Li PA fyab anndan APK Capacitor la: se yon
 * WebView senp, pa Chrome konplè — pa gen sèvis background ki ka resevwa
 * yon push lè app la fèmen nèt. Sèl mwayen fyab pou sa se Firebase Cloud
 * Messaging (FCM), atravè jeton `fcm_device_tokens` @capacitor/push-
 * notifications anrejistre nan telefòn kliyan an (lib/push.ts).
 *
 * KONFIGIRASYON (Vercel > Environment Variables) :
 *   FIREBASE_SERVICE_ACCOUNT_JSON = { "type": "service_account", ... }
 *   (tout kontni fichye JSON "clé de compte de service" Firebase la, kòm
 *   yon sèl liy tèks). San varyab sa a, fonksyon anba yo retounen 0 san
 *   kraze anyen — menm prensip ak vapidReady() nan push-server.ts.
 */
let cachedApp: App | null | undefined;

function firebaseApp(): App | null {
  if (cachedApp !== undefined) return cachedApp;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) { cachedApp = null; return null; }
  try {
    const existing = getApps();
    if (existing.length) { cachedApp = existing[0]; return cachedApp; }
    const serviceAccount = JSON.parse(raw);
    cachedApp = initializeApp({ credential: cert(serviceAccount) });
  } catch {
    // JSON envalid oswa kle refize — pa kraze aplikasyon an, jis pa gen push natif.
    cachedApp = null;
  }
  return cachedApp;
}

export interface SupabaseAdminConfig { url: string; key: string; }

export async function sendFcmToCustomer(
  config: SupabaseAdminConfig, customerCode: string, payload: { title: string; text: string; url?: string }
): Promise<number> {
  const app = firebaseApp();
  if (!app || !customerCode) return 0;

  const svc = createClient(config.url, config.key, { auth: { persistSession: false } });
  const { data: tokens } = await svc.from("fcm_device_tokens")
    .select("id, token").eq("customer_code", customerCode);
  if (!tokens?.length) return 0;

  const messaging = getMessaging(app);
  let sent = 0;
  await Promise.all(tokens.map(async (t: { id: string; token: string }) => {
    try {
      await messaging.send({
        token: t.token,
        notification: { title: payload.title, body: payload.text },
        data: { url: payload.url || "/espace-client" },
        android: { priority: "high" }
      });
      sent++;
    } catch (e: unknown) {
      // Jeton ekspire/envalid (app dezenstale, done efase) — netwaye l.
      const code = (e as { code?: string })?.code || "";
      if (code === "messaging/registration-token-not-registered"
        || code === "messaging/invalid-registration-token") {
        await svc.from("fcm_device_tokens").delete().eq("id", t.id);
      }
    }
  }));
  return sent;
}
