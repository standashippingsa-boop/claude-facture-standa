import type { CapacitorConfig } from '@capacitor/cli';

/**
 * STANDA COMMERCIAL — APK "Affiliation" (distribisyon dirèk, JAMÈ piblik)
 * Pwojè Capacitor separe — wè mobile-apps/admin/capacitor.config.ts pou
 * eksplikasyon konplè sou pouki sa "server.url" itilize olye "webDir".
 * Louvri pòtay afilye a (koneksyon), PA fòm kandidati /affiliation an —
 * yon afilye deja apwouve se li ki bezwen yon app enstale, pa yon kandida.
 * JAMÈ Play Store, Uptodown, ni okenn lyen piblik — bay men-a-men sèlman.
 */
const config: CapacitorConfig = {
  appId: 'com.standacommercialsa.affiliation',
  appName: 'STANDA Affiliation',
  webDir: 'www',
  server: {
    url: 'https://www.standacommercialsa.com/espace-affilie/login',
    cleartext: false
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
