/*
 * STANDA COMMERCIAL — Service Worker
 * ══════════════════════════════════════════════════════════
 * Estrateji SEKIRITE (done finansye):
 *  - Nou PA JANM kache Supabase, /api, ni okenn done metye.
 *    Fakti, koli, pri, kliyan TOUJOU soti sou rezo (done fre).
 *  - Nou kache SÈLMAN "app shell" la (paj, JS, CSS, ikòn, font).
 *  - Navigasyon: rezo an premye -> si offline, montre offline.html.
 *  - Sou aktivasyon: efase ansyen cache yo.
 *  - skipWaiting + clients.claim -> mizajou otomatik.
 *
 * Pou fè yon nouvo vèsyon: chanje CACHE_VERSION.
 */
const CACHE_VERSION = "standa-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const OFFLINE_URL = "/offline.html";

// Resous app-shell nou vle disponib offline
const PRECACHE = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png"
];

// Domèn nou PA JANM kache (done metye — toujou rezo)
function isNeverCache(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("supabase.in") ||
    url.pathname.includes("/auth/") ||
    url.search.includes("no-cache")
  );
}

// Èske se yon resous statik app-shell (JS/CSS/font/imaj)?
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Pèmèt paj la fòse mizajou (skipWaiting) lè itilizatè klike "Mettre à jour"
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin && !isStaticAsset(url)) {
    // Lòt domèn (Supabase etc.) -> pa touche, kite rezo a jere l
    if (isNeverCache(url)) return;
  }
  if (isNeverCache(url)) return; // done metye -> toujou rezo

  // Navigasyon (paj HTML): rezo an premye, offline.html si echwe
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Resous statik: cache-first + mizajou an background (stale-while-revalidate)
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req).then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
  // Rès la: kite navigatè a jere nòmalman (pa entèsepte)
});

/* ── NOTIFICATIONS PUSH (estrikti prè — pa aktive toujou) ──
 * Backend nan pral voye yon push ak {title, body, url, tag}.
 * Estrikti a la; li kòmanse travay depi w konfigire VAPID + abònman.
 */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || "STANDA COMMERCIAL";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "standa",
    data: { url: data.url || "/" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if (c.url.includes(url) && "focus" in c) return c.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
