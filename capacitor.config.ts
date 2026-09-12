import type { CapacitorConfig } from '@capacitor/cli';

/**
 * STANDA COMMERCIAL — APK Android (distribisyon dirèk, san Play Store)
 * ══════════════════════════════════════════════════════════════════
 * ⚠️ ENPÒTAN — poukisa "webDir" pa itilize pou chaje aplikasyon an :
 * Sit sa a se yon aplikasyon Next.js DYNAMIC (routes API `/api/*`, sesyon
 * Supabase ki baze sou cookies, paj rann sou sèvè). "npm run build" pa
 * pwodui yon dosye HTML/JS estatik (`out`/`dist`) ki ka anbake nan APK a —
 * l ap toujou bezwen sèvè Vercel la k ap tounen pou chak demand.
 *
 * Se poutèt sa `server.url` anba a pwente DIREKTEMAN sou sit pwodiksyon an
 * (menm domèn ak `lib/branding.ts` → SITE_URL) : APK a se yon “shell” natif
 * Android ki louvri sit ki deja anliy lan tout tan, egzakteman jan
 * navigatè Chrome ta fè l — koneksyon kliyan, admin, anplwaye ak ajan
 * retrait yo mache san chanjman. "webDir: public" rete la sèlman kòm
 * plasholdè obligatwa pou zouti Capacitor la (li pa janm sèvi pou chaje
 * kontni reyèl la selon konfigirasyon "server.url" anba a).
 */
const config: CapacitorConfig = {
  appId: 'com.standacommercialsa.app',
  appName: 'STANDA COMMERCIAL',
  webDir: 'public',
  server: {
    // Menm domèn kanonik ak lib/branding.ts (SITE_URL) — chanje toulede
    // ansanm si domèn ofisyèl la chanje yon jou.
    url: 'https://www.standacommercialsa.com',
    cleartext: false
  },
  android: {
    allowMixedContent: false,
    // App la itilize kamera a (Scanner Réception) — pèmisyon Android
    // ajoute otomatikman pa @capacitor/android; anyen espesyal isit.
  }
};

export default config;
