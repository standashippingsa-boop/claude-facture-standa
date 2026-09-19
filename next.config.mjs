/** @type {import('next').NextConfig} */

/**
 * STANDA COMMERCIAL — Konfigirasyon pwodiksyon
 * ════════════════════════════════════════════
 * Headers sekirite yo chwazi POU YO PA KRAZE aplikasyon an:
 *  • HSTS            — fòse HTTPS (domèn nan deja an HTTPS)
 *  • X-Content-Type  — anpeche navigatè a "devine" tip fichye
 *  • Referrer-Policy — pa voye URL entèn bay lòt sit
 *  • Permissions     — bloke micro/geo; KAMERA otorize (Scanner Réception!)
 *  • frame-ancestors — anpeche clickjacking (sit lòt moun pa ka anbake nou)
 *
 * CSP — nonce dynamique dans middleware.ts.
 * ───────────────────────────────────────────
 * Next.js ajoute à chaque page des scripts inline de transport React Server
 * Components (`self.__next_f.push(...)`) qui changent à chaque rendu. Une
 * liste de hashes statiques les bloque après un rafraîchissement et donne un
 * écran blanc. Le middleware génère donc un nonce par réponse HTML, le passe
 * à Next.js et ajoute la même politique à la réponse. Cette configuration
 * garde le blocage des scripts injectés sans autoriser `unsafe-inline`.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()" },
  // Isole navigatè a: yon lòt sit pa ka gade nan fenèt nou an
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

export default {
  // Pa pibliye source maps pwodiksyon (mwens detay entèn ekspoze)
  productionBrowserSourceMaps: false,

  async headers() {
    return [
      {
        // Headers sekirite sou tout paj yo
        source: "/:path*",
        headers: securityHeaders
      },
      {
        // Paj sansib: pa kache nan navigatè a
        source: "/(dashboard|espace-client|espace-remise|points-retrait|clients|invoices|packages|conduces|journal|settings|retraits|bon-remise|sync|historique)/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" }
        ]
      },
      {
        /*
         * WOUT PIBLIK YO (/api/public/*) — done ki soti san koneksyon.
         *  no-store    : repons yon vizitè pa janm sèvi yon lòt vizitè
         *  noindex     : Google pa endekse repons tracking yo
         *  frame-ancestors 'none' : okenn sit pa ka anbake wout la
         */
        source: "/api/public/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }
        ]
      },
      {
        /*
         * TOUT LÒT WOUT API — yo pale ak done kliyan. Yo pa dwe kache
         * ni endekse. (Wout piblik yo deja kouvri anwo a.)
         */
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" }
        ]
      },
      {
        // Service worker: pa kache l nan navigatè a (toujou fre pou detekte mizajou)
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" }
        ]
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }]
      }
    ];
  }
};
