/*
 * STANDA COMMERCIAL — Service Worker (v3)
 * ══════════════════════════════════════════════════════════
 * Estrateji:
 *  - Paj (navigasyon): rezo dirèk, san entèsepsyon (browser jere l).
 *  - Resous statik (JS/CSS/ikòn): cache pou vitès + mizajou background.
 *  - Done metye (API/Supabase): JAMÈ kache — toujou rezo.
 *  - Netwayaj ansyen cache sou aktivasyon.
 *
 * ⚠️ KORÈKSYON v3 — POUKISA KLIYAN YO PA T WÈ MIZAJOU YO
 * ──────────────────────────────────────────────────────
 * Ansyen vèsyon an te kenbe fichye ki PA gen anprent nan non yo
 * (/logo.png, /icons/…, /manifest.webmanifest) POU TOUJOU: yon fwa nan
 * cache la, li pa t janm chanje ankò. Fichye Next.js yo (_next/static)
 * gen yon anprent nan non yo — chak deplwaman bay yon nouvo non — donk
 * yo pa t gen pwoblèm nan. Men logo, icòn ak manifest la te bloke.
 *
 * v3 separe de kalite fichye yo:
 *   • Ki gen anprent (_next/static) -> cache-first, pi rapid ki genyen
 *   • Ki PA gen anprent (logo, icòn)-> rezo an premye, cache kòm sekou
 *
 * Nimewo vèsyon an chanje (v2 -> v3), donk TOUT ansyen cache yo efase
 * otomatikman lè nouvo service worker la aktive. Kliyan yo pa gen anyen
 * pou fè: yon senp rafrechi ase.
 *
 * ⚠️ v4 — REPARE NAVIGATÈ DÈV KI TE ANPWAZONNEN
 * ─────────────────────────────────────────────
 * SW la pa t janm dwe kouri sou `next dev`: la, fichye /_next/static/ yo
 * gen MENM non apre chak edisyon, donk "cache-first" te fè navigatè a rete
 * ap egzekite ANSYEN JS pandan sèvè a voye nouvo HTML (hydration mismatch).
 * Kounye a <PwaManager /> pa anrejistre SW la ditou an dèv epi li dezenskri
 * sa ki egziste. Chanjman v3 -> v4 la fòse tout ansyen cache yo efase pou
 * navigatè ki deja touche yo — yon sèl rechajman epi tout bagay pwòp.
 */
const CACHE_VERSION = "standa-v4";
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

/**
 * Fichye ki gen yon ANPRENT nan non yo (Next.js mete yon kòd inik nan chak
 * non fichye). Yon nouvo deplwaman = yon nouvo non = pa gen ansyen vèsyon
 * posib. Nou ka kache yo pou toujou san okenn risk.
 */
function isFingerprinted(url) {
  return url.pathname.startsWith("/_next/static/");
}

/**
 * Fichye ki GEN MENM NON chak deplwaman (logo, icòn, manifest). Se yo ki
 * t ap bloke: yon fwa nan cache la, kliyan an pa t janm wè nouvo vèsyon an.
 * Nou mande rezo a an premye; cache la sèvi sèlman si rezo a tonbe.
 */
function isMutableAsset(url) {
  return (
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(?:woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  );
}

/*
 * v5 : INSTALLATION QUI NE PEUT PLUS ÉCHOUER
 * Avant, cache.addAll() faisait échouer toute l'installation si UN seul fichier
 * ne se téléchargeait pas (réseau faible) : le service worker ne démarrait
 * jamais et les notifications ne pouvaient pas s'activer (« timeout »).
 * Maintenant le service worker démarre tout de suite ; les fichiers sont mis
 * en cache un par un, sans bloquer, et un échec est simplement ignoré.
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined))))
      .catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/**
 * PAJ KI DWE LOUVRI SAN ENTENET (ajan resepsyon an travay kote ki pa gen rezo).
 * Se SELMAN paj sa yo SW la kenbe: tout lot navigasyon rete "rezo direk".
 */
const OFFLINE_PAGES = ["/reception"];

/** Telechaje paj la + tout fichye /_next/static li bezwen, epi mete yo nan cache. */
async function warmPage(path) {
  const cache = await caches.open(SHELL_CACHE);
  const res = await fetch(path, { credentials: "same-origin", cache: "no-store" });
  // Yon redireksyon (sesyon fini) oswa yon ere pa dwe ranplase bon kopi a.
  if (!res || res.status !== 200 || res.redirected) return res;
  const html = await res.clone().text();
  await cache.put(path, res.clone());
  const assets = Array.from(new Set(html.match(/\/_next\/static\/[^"'\\ )<>]+/g) || []));
  assets.push("/account-agent-hero.png", "/logo.png");
  await Promise.all(assets.map(async (asset) => {
    try {
      if (await cache.match(asset)) return;
      const file = await fetch(asset);
      if (file && file.status === 200) await cache.put(asset, file);
    } catch (e) { /* yon fichye ki manke pa dwe bloke res la */ }
  }));
  return res;
}

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data && event.data.type === "WARM_PAGE" && OFFLINE_PAGES.includes(event.data.url)) {
    event.waitUntil(warmPage(event.data.url).catch(() => undefined));
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // ⚠️ NAVIGASYON PAJ: pa entèsepte — browser voye l dirèk sou rezo.
  //    Se sa ki anpeche fo paj "hors ligne" a bloke itilizatè ki gen entènèt.
  //    SEL EKSEPSYON: paj OFFLINE_PAGES yo — rezo an premye, kopi cache la
  //    sevi SELMAN le rezo a tonbe (donk yon moun ki gen entenet toujou we
  //    denye vesyon an).
  if (req.mode === "navigate") {
    let page;
    try { page = new URL(req.url).pathname.replace(/\/$/, "") || "/"; } catch { return; }
    if (!OFFLINE_PAGES.includes(page)) return;
    event.respondWith(
      warmPage(page).then((res) => {
        // Yon repons ki soti nan yon redireksyon pa ka sevi dirèk pou yon
        // navigasyon: nou voye navigatè a sou adrès final la (ex: login).
        return res.redirected ? Response.redirect(res.url, 302) : res;
      }).catch(async () => {
        const cached = await (await caches.open(SHELL_CACHE)).match(page);
        if (cached) return cached;
        throw new Error("offline");
      })
    );
    return;
  }

  let url;
  try { url = new URL(req.url); } catch { return; }

  if (isNeverCache(url)) return;              // done metye -> toujou rezo

  // Fichye ak anprent: cache-first (zewo risk ansyen vèsyon)
  if (isFingerprinted(url)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // Fichye san anprent: REZO AN PREMYE — cache se sekou lè koneksyon tonbe
  if (isMutableAsset(url)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        try {
          const res = await fetch(req);
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        } catch {
          const cached = await cache.match(req);
          if (cached) return cached;
          throw new Error("offline");
        }
      })
    );
    return;
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
