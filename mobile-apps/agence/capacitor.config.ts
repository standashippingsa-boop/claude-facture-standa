import type { CapacitorConfig } from '@capacitor/cli';

/**
 * STANDA COMMERCIAL — APK "Agence de retrait" (distribisyon dirèk, JAMÈ piblik)
 * Pwojè Capacitor separe — wè mobile-apps/admin/capacitor.config.ts pou
 * eksplikasyon konplè sou pouki sa "server.url" itilize olye "webDir".
 * JAMÈ Play Store, Uptodown, ni okenn lyen piblik — bay men-a-men sèlman.
 */
const config: CapacitorConfig = {
  appId: 'com.standacommercialsa.agence',
  appName: 'STANDA Agence',
  webDir: 'www',
  server: {
    url: 'https://www.standacommercialsa.com/point-retrait',
    cleartext: false
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
