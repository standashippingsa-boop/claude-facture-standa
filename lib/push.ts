"use client";
/**
 * STANDA COMMERCIAL — Notifications push (espace client)
 * ════════════════════════════════════════════════════════
 * De MOTÈ diferan dèyè MENM API piblik la (isPushSupported/pushPermission/
 * subscribeToPush/unsubscribeFromPush) — apèl yo pa chanje nan lib/espace-
 * client, nou jis chwazi motè a selon kote kòd la ap kouri:
 *
 *  • Navigatè (Chrome/Edge/PWA "Add to Home Screen") -> Web Push standard,
 *    kle piblik VAPID (NEXT_PUBLIC_VAPID_PUBLIC_KEY), tab `push_subscriptions`.
 *  • App Android (APK Uptodown, @capacitor/core Capacitor.isNativePlatform())
 *    -> Firebase Cloud Messaging atravè @capacitor/push-notifications, tab
 *    `fcm_device_tokens`. Web Push PA fyab anndan yon WebView senp (pa gen
 *    sèvis background lè app la fèmen nèt) — se poutèt sa FCM obligatwa la.
 *
 * Kle prive yo (VAPID prive, Firebase service account) rete SÈVÈ SÈLMAN
 * (lib/push-server.ts, lib/push-fcm-server.ts) — jamè isit la.
 */
import { Capacitor } from "@capacitor/core";
import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

const isNative = () => typeof window !== "undefined" && Capacitor.isNativePlatform();

/** Konvèti kle VAPID la (base64url) an Uint8Array — fòma pushManager mande. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Èske aparèy/navigatè a ka resevwa notifikasyon push ditou? */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (isNative()) return true; // FCM: konsidere sipòte, permission verifye apa
  return "serviceWorker" in navigator && "PushManager" in window
    && "Notification" in window && !!VAPID_PUBLIC_KEY;
}

/** Eta otorizasyon aktyèl la (web sèlman — san danje, senkwon). */
export function pushPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/**
 * Menm bagay ak pushPermission(), men fonksyone pou LES DEUX motè yo
 * (verifikasyon FCM natif la nesesèman asenkwòn). Itilize sa a nan
 * useEffect yo olye pushPermission() senkwon an.
 */
export async function getPushPermissionState(): Promise<NotificationPermission | "unsupported"> {
  if (!isPushSupported()) return "unsupported";
  if (isNative()) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const res = await PushNotifications.checkPermissions();
      if (res.receive === "granted") return "granted";
      if (res.receive === "denied") return "denied";
      return "default";
    } catch { return "unsupported"; }
  }
  return pushPermission();
}

/**
 * Mande otorizasyon epi abòne aparèy la si itilizatè a dakò.
 * Pa rele fonksyon sa a otomatikman san kontèks — montre yon ti eksplikasyon
 * anvan (yon bouton "Activer les notifications"), sinon navigatè yo souvan
 * blòke oswa inyore demann otorizasyon ki parèt san rezon.
 */
export async function subscribeToPush(customerCode: string): Promise<{ ok: boolean; reason?: string }> {
  if (isNative()) {
    return subscribeNative(async (token) => {
      const { error } = await supabase.from("fcm_device_tokens").upsert(
        { customer_code: customerCode, token, platform: "android" }, { onConflict: "token" }
      );
      return { error };
    });
  }
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: permission };

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
      });
    }
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: "invalid_subscription" };
    }
    const { error } = await supabase.from("push_subscriptions").upsert({
      customer_code: customerCode,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth
    }, { onConflict: "endpoint" });
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "error" };
  }
}

/**
 * Vèsyon FCM (app Android natif) — @capacitor/push-notifications.
 * `saveToken` fè ekri jeton an nan bon tab la (kliyan: fcm_device_tokens
 * pa customer_code; pèsonèl: staff_fcm_tokens pa staff_id) — se sèl bagay
 * ki chanje ant subscribeToPush() ak subscribeStaffToPush().
 */
async function subscribeNative(
  saveToken: (token: string) => Promise<{ error: { message: string } | null }>
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      return { ok: false, reason: perm.receive === "denied" ? "denied" : "default" };
    }

    let settled = false;
    let finish: (result: { ok: boolean; reason?: string }) => void = () => undefined;
    const done = new Promise<{ ok: boolean; reason?: string }>((resolve) => {
      finish = (r) => { if (!settled) { settled = true; resolve(r); } };
    });

    const regListener = await PushNotifications.addListener("registration", (token) => {
      saveToken(token.value).then(({ error }) => {
        finish(error ? { ok: false, reason: error.message } : { ok: true });
      });
    });
    const errListener = await PushNotifications.addListener("registrationError", (err) => {
      finish({ ok: false, reason: String(err?.error ?? "registration_error") });
    });

    PushNotifications.register();
    // Garanti: si Firebase pa konfigire nan app la, "registration" /
    // "registrationError" pa janm rive — pa rete tann pou tout tan.
    setTimeout(() => finish({ ok: false, reason: "timeout" }), 10000);

    const result = await done;
    await regListener.remove(); await errListener.remove();
    return result;
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "error" };
  }
}

/**
 * Menm bagay ak subscribeToPush(), men pou PÈSONÈL (ajan retrè ki gen app
 * "Standa Agence" enstale). Web Push PA sipòte pou pèsonèl kounye a — sa
 * a se natif sèlman (@capacitor/push-notifications), rezon: itilizasyon
 * prensipal la se nan app dedye a, pa yon navigatè.
 */
export async function subscribeStaffToPush(staffId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isNative()) return { ok: false, reason: "unsupported" };
  return subscribeNative(async (token) => {
    const { error } = await supabase.from("staff_fcm_tokens").upsert(
      { staff_id: staffId, token, platform: "android" }, { onConflict: "token" }
    );
    return { error };
  });
}

/** Dezabòne aparèy la (kliyan mande sa espresyèman). */
export async function unsubscribeFromPush(): Promise<void> {
  if (isNative()) {
    // FCM: pa gen "dezabòne" pwòp — nou jis rete koute, jeton an ka efase
    // pa kliyan an nan yon paramèt pita si sa nesesè.
    return;
  }
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  } catch {
    // San danje pou itilizatè a kontinye — se yon dezabònman, pa yon aksyon kritik.
  }
}
