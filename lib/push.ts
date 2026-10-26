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
  void customerCode; // le serveur retrouve le code à partir de la session
  return subscribeWebPush("client");
}

type WebPushSubscriptionData = { endpoint: string; p256dh: string; auth: string };

/** Laisse tourner une promesse au plus `ms` millisecondes. */
function withTimeout<T>(promise: Promise<T>, ms: number, reason: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(reason)), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

/** Portée du service worker pour la page actuelle (mêmes règles que PwaManager). */
function pushScope(): string {
  const p = window.location.pathname;
  if (p === "/point-retrait" || p.startsWith("/espace-remise")) return "/espace-remise";
  if (p.startsWith("/reception")) return "/reception";
  if (p.startsWith("/espace-affilie")) return "/espace-affilie";
  return "/espace-client";
}

/**
 * Service worker actif pour cette page. S'il n'est pas encore enregistré
 * (première visite, réseau lent), on l'enregistre nous-mêmes au lieu
 * d'attendre indéfiniment `navigator.serviceWorker.ready`.
 */
async function activeRegistration(): Promise<ServiceWorkerRegistration> {
  const scope = pushScope();
  let reg = await navigator.serviceWorker.getRegistration(scope);
  if (!reg) reg = await navigator.serviceWorker.register("/sw.js", { scope, updateViaCache: "none" });
  if (reg.active) return reg;
  const worker = reg.installing ?? reg.waiting;
  if (worker) {
    worker.postMessage("SKIP_WAITING");
    await withTimeout(new Promise<void>((resolve) => {
      if (worker.state === "activated") return resolve();
      worker.addEventListener("statechange", () => { if (worker.state === "activated") resolve(); });
    }), 30000, "timeout:sw");
  }
  if (!reg.active) throw new Error("timeout:sw");
  return reg;
}

/** Envoie l'abonnement au serveur (qui l'attribue à la personne connectée). */
async function saveOnServer(kind: "client" | "staff", data: WebPushSubscriptionData): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("session");
  const res = await withTimeout(fetch("/api/push-subscribe", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, kind, ...data })
  }), 20000, "timeout:save");
  const j = await res.json().catch(() => ({ ok: false, reason: "save" }));
  if (!j.ok) throw new Error("save:" + (j.reason ?? res.status));
}

/**
 * Enregistre un abonnement Web Push, client ou membre du personnel.
 *  1. Autorisation : on attend la réponse de la personne, sans limite.
 *  2. Service worker : enregistré au besoin, 30 s maximum.
 *  3. Abonnement : réutilisé s'il existe ; sinon créé, avec un second essai.
 *  4. Enregistrement côté serveur.
 * En cas d'échec, la raison indique l'étape (timeout:sw, timeout:subscribe…).
 */
async function subscribeWebPush(kind: "client" | "staff"): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  try {
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: permission };

    const reg = await activeRegistration();
    const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource;
    let sub = await withTimeout(reg.pushManager.getSubscription(), 15000, "timeout:subscribe");
    if (!sub) {
      try {
        sub = await withTimeout(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }), 30000, "timeout:subscribe");
      } catch {
        // Second essai : un ancien abonnement abîmé peut bloquer le premier.
        const stale = await reg.pushManager.getSubscription().catch(() => null);
        if (stale) await stale.unsubscribe().catch(() => undefined);
        sub = await withTimeout(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }), 30000, "timeout:subscribe");
      }
    }
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return { ok: false, reason: "invalid_subscription" };
    await saveOnServer(kind, { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "error";
    const name = e instanceof Error && e.name && e.name !== "Error" ? e.name + ": " : "";
    return { ok: false, reason: (name + msg).slice(0, 180) || "error" };
  }
}

/** Le navigateur Samsung Internet n'a souvent pas de service de notification : conseiller Chrome. */
export function isSamsungBrowser(): boolean {
  return typeof navigator !== "undefined" && /SamsungBrowser/i.test(navigator.userAgent);
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
 * Menm bagay ak subscribeToPush(), men pou PÈSONÈL. Sou APK a, li sèvi ak
 * Firebase Cloud Messaging. Sou navigatè/PWA a, li sèvi ak Web Push/VAPID.
 * Sa pèmèt ajan an aktive alèt sou aparèy li sèvi chak jou a, san melanje
 * jeton li ak sa kliyan yo.
 */
export async function subscribeStaffToPush(staffId: string): Promise<{ ok: boolean; reason?: string }> {
  if (isNative()) {
    return subscribeNative(async (token) => {
      const { error } = await supabase.from("staff_fcm_tokens").upsert(
        { staff_id: staffId, token, platform: "android" }, { onConflict: "token" }
      );
      return { error };
    });
  }
  void staffId; // le serveur retrouve le membre du personnel à partir de la session
  return subscribeWebPush("staff");
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
    const reg = await navigator.serviceWorker.getRegistration(pushScope());
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  } catch {
    // San danje pou itilizatè a kontinye — se yon dezabònman, pa yon aksyon kritik.
  }
}

/** Voye rezon yon echèk aktivasyon bay ekip la (jounal). Pa janm bloke app la. */
export async function reportPushFailure(reason: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/push-report", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, reason, platform: isNative() ? "android-app" : isSamsungBrowser() ? "navigateur Samsung" : "navigateur" })
    });
  } catch { /* rapò a pa kritik */ }
}

/**
 * Aktivasyon OTOMATIK lè moun nan antre nan app la (tankou lòt app yo):
 *  • otorizasyon poko mande  -> fenèt sistèm telefòn nan parèt dirèkteman;
 *  • otorizasyon deja bay     -> aparèy la re-anrejistre an silans (sa repare
 *    telefòn ki te di "wi" lè anrejistreman an t ap echwe);
 *  • otorizasyon refize       -> nou pa mande ankò.
 * Retounen "prompt-needed" si navigatè a refize montre fenèt la san yon tap
 * (iPhone) — lè sa a ekran an montre yon bouton.
 */
export async function autoEnablePush(subscribe: () => Promise<{ ok: boolean; reason?: string }>): Promise<"ok" | "denied" | "prompt-needed" | "failed" | "unsupported"> {
  if (!isPushSupported()) return "unsupported";
  const before = await getPushPermissionState();
  if (before === "denied") return "denied";
  if (before === "unsupported") return "unsupported";
  const result = await subscribe();
  if (result.ok) return "ok";
  if (result.reason === "denied" || result.reason === "default") return result.reason === "denied" ? "denied" : "prompt-needed";
  const after = await getPushPermissionState();
  if (after === "default") return "prompt-needed";
  void reportPushFailure(result.reason ?? "inconnu");
  return "failed";
}

/** Phrase claire pour la personne, selon la raison de l'échec. */
export function pushFailureMessage(reason?: string): string {
  if (isSamsungBrowser()) return "Le navigateur Samsung Internet bloque souvent les notifications. Ouvrez STANDA dans Google Chrome, puis réessayez.";
  if (String(reason ?? "").startsWith("timeout")) return "Connexion trop lente pour activer les notifications. Réessayez avec un meilleur réseau (Wi-Fi ou 4G).";
  if (String(reason ?? "").startsWith("session")) return "Votre session a expiré. Veuillez vous reconnecter, puis réessayez.";
  return "Impossible d'activer les notifications pour le moment. Réessayez dans quelques minutes.";
}
