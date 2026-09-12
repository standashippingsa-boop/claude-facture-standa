import type { CapacitorConfig } from '@capacitor/cli';

/**
 * STANDA COMMERCIAL — APK Android "app kliyan" (piblikasyon sou Uptodown)
 * ═══════════════════════════════════════════════════════════════════
 * ⚠️ APK sa a se SÈLMAN app KLIYAN an — pa yon app pou anplwaye/admin/ajan.
 * `server.url` anba a pwente DIREKTEMAN sou /espace-client (menm chemen
 * `start_url`/`scope` manifest.webmanifest la deja itilize pou vèsyon PWA
 * "Add to Home Screen" la — konsa APK Uptodown an ak PWA a rete konsistan:
 * toulede se app KLIYAN an sèlman, JANM app admin/anplwaye/ajan retrait).
 * Lè telefòn nan louvri app la, li antre dirèkteman sou espas kliyan an
 * (ki voye w sou koneksyon si w poko konekte) — pa sou paj akèy jeneral la.
 *
 * ⚠️ POUKISA "webDir" PA ITILIZE POU CHAJE APLIKASYON AN :
 * Sit sa a se yon aplikasyon Next.js DYNAMIC (routes API `/api/*`, sesyon
 * Supabase ki baze sou cookies, paj rann sou sèvè). "npm run build" pa
 * pwodui yon dosye HTML/JS estatik (`out`/`dist`) ki ka anbake nan APK a —
 * l ap toujou bezwen sèvè Vercel la k ap tounen pou chak demand. Se
 * poutèt sa APK a se yon "shell" natif Android ki louvri /espace-client
 * sou sit ki deja anliy lan (menm domèn ak `lib/branding.ts` → SITE_URL),
 * egzakteman jan navigatè Chrome ta fè l. "webDir: public" rete la
 * sèlman kòm plasholdè obligatwa pou zouti Capacitor la.
 *
 * Si yon APK apa pou anplwaye/admin/ajan retrait bezwen fèt yon jou, li
 * dwe yon DEZYÈM pwojè Capacitor apa (lòt appId, lòt dosye android/),
 * JANM distribye sou Uptodown ni okenn plasfòm piblik — sèlman men-a-men.
 */
const config: CapacitorConfig = {
  appId: 'com.standacommercialsa.app',
  appName: 'STANDA COMMERCIAL',
  webDir: 'public',
  server: {
    // /espace-client sèlman — JANM domèn rasin lan, pou APK Uptodown an pa
    // janm ka rive sou /admin-login, /employe, /point-retrait, /settings...
    url: 'https://www.standacommercialsa.com/espace-client',
    cleartext: false
  },
  android: {
    allowMixedContent: false,
    // App la itilize kamera a (Scanner Réception) — pèmisyon Android
    // ajoute otomatikman pa @capacitor/android; anyen espesyal isit.
  }
};

export default config;
