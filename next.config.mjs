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
 * script-src (V19) — approche par HASH, pas par nonce.
 * ────────────────────────────────────────────────────
 * Un nonce doit changer à CHAQUE requête, ce qui casse le rendu statique
 * (headers() dans le layout racine force TOUTE l'app en rendu dynamique —
 * essayé, mesuré : /accueil, /contact, /agences passaient de ○ statique à
 * ƒ dynamique). Le contenu des deux <script> inline de l'app (le garde
 * "frontière site/application" dans app/layout.tsx et le JSON-LD dans
 * app/accueil/page.tsx) ne dépend d'aucune donnée par requête — un hash
 * SHA-256 de leur contenu EXACT les autorise sans jamais changer, donc
 * sans sacrifier le rendu statique. C'est aussi strict qu'un nonce pour
 * ce qu'on veut bloquer : un <script> injecté par XSS ne matchera jamais
 * un hash existant, quel qu'il soit.
 *
 * ⚠️ Si le contenu d'un de ces deux <script> change (même un espace), son
 * hash change aussi — régénérer avec (après `npm run build`) :
 *   node -e "const c=require('fs').readFileSync('.next/server/app/accueil.html','utf8').match(/<script>(\(function\(\)\{[\s\S]*?\}\)\(\);)<\/script>/)[1];console.log('sha256-'+require('crypto').createHash('sha256').update(c).digest('base64'))"
 * (remplacer le regex pour le <script type="application/ld+json"> au besoin).
 * Un hash périmé ne casse rien de visible immédiatement : le navigateur
 * bloque silencieusement CE script précis (garde de frontière ou JSON-LD),
 * à surveiller via la console/Reporting-Api en cas de doute après un
 * changement dans ces deux fichiers.
 *
 * 'self' couvre les <script src="/_next/..."> de Next.js lui-même (même
 * origine) — aucun nonce ni 'strict-dynamic' n'est nécessaire pour ceux-là.
 */
const INLINE_SCRIPT_HASHES = [
  "'sha256-JsyxeOFYXFmS+WCxlI5jLDzGoJfL/ATWDM8lJSN7khk='", // app/layout.tsx — garde frontière site/application
  "'sha256-iMPpEkA6dexlOrgFp3Ua00lgFUvJXi+b/ABsEO03fDw='", // app/accueil/page.tsx — JSON-LD
];

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()" },
  {
    key: "Content-Security-Policy",
    value: `frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; `
      + `script-src 'self' ${INLINE_SCRIPT_HASHES.join(" ")}`
  },
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
