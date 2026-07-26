/*
 * STANDA COMMERCIAL — Service Worker (v2)
 * ══════════════════════════════════════════════════════════
 * KORÈKSYON v2: navigasyon paj yo TOUJOU pase dirèk sou rezo.
 * Nou PA entèsepte navigasyon ankò — konsa aplikasyon an pa janm
 * ka bloke sou yon fo paj "hors ligne" lè gen entènèt.
 *
 * Estrateji:
 *  - Paj (navigasyon): rezo dirèk, san entèsepsyon (browser jere l).
 *  - Resous statik (JS/CSS/ikòn): cache pou vitès + mizajou background.
 *  - Done metye (API/Supabase): JAMÈ kache — toujou rezo.
 *  - Netwayaj ansyen cache sou aktivasyon.
 */
const CACHE_VERSION = "standa-v2";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

const PRECACHE = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png"
];

function isNeverCache(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("supabase.in") ||
    url.pathname.includes("/auth/")
  );
}

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

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // ⚠️ NAVIGASYON PAJ: pa entèsepte — browser voye l dirèk sou rezo.
  //    Se sa ki anpeche fo paj "hors ligne" a bloke itilizatè ki gen entènèt.
  if (req.mode === "navigate") return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  if (isNeverCache(url)) return;              // done metye -> toujou rezo

  // Resous statik: cache-first + mizajou background (stale-while-revalidate)
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
  // Rès la: navigatè a jere nòmalman
});

/* ── NOTIFICATIONS PUSH (estrikti prè) ── */
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
