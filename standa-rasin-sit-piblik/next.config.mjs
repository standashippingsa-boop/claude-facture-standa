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
 * NÒT: nou PA mete yon CSP script-src konplè pou kounye a — sa mande yon
 * nonce sou chak script Next.js; yon move konfigirasyon ta bloke app la nèt.
 * frame-ancestors bay pwoteksyon clickjacking san okenn risk.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
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
        source: "/(dashboard|espace-client|clients|invoices|packages|conduces|journal|settings|retraits|bon-remise|sync|historique)/:path*",
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
