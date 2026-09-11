"use client";
/**
 * STANDA COMMERCIAL — Notifications push (espace client)
 * ════════════════════════════════════════════════════════
 * Fonksyon sa yo kouri SÈLMAN nan navigatè a. Yo sèvi ak clé piblik VAPID
 * (NEXT_PUBLIC_VAPID_PUBLIC_KEY — san danje pou navigatè, se konsa Web Push
 * fonksyone), JANM kle prive a (rete sèvè /api/notify sèlman).
 *
 * Ekri abònman an nan tab `push_subscriptions` pase pa RLS: yon kliyan ka
 * ekri SÈLMAN pou pwòp customer_code li (wè migration.sql).
 */
import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

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
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window
    && !!VAPID_PUBLIC_KEY;
}

/** Eta otorizasyon aktyèl la — san mande anyen bay itilizatè a. */
export function pushPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/**
 * Mande otorizasyon epi abòne aparèy la si itilizatè a dakò.
 * Pa rele fonksyon sa a otomatikman san kontèks — montre yon ti eksplikasyon
 * anvan (yon bouton "Activer les notifications"), sinon navigatè yo souvan
 * blòke oswa inyore demann otorizasyon ki parèt san rezon.
 */
export async function subscribeToPush(customerCode: string): Promise<{ ok: boolean; reason?: string }> {
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

/** Dezabòne aparèy la (kliyan mande sa espresyèman). */
export async function unsubscribeFromPush(): Promise<void> {
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
