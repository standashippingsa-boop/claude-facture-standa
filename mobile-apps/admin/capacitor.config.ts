import type { CapacitorConfig } from '@capacitor/cli';

/**
 * STANDA COMMERCIAL — APK "Admin" (distribisyon dirèk, JAMÈ piblik)
 * ══════════════════════════════════════════════════════════════════
 * Sa a se yon pwojè Capacitor SEPARE de app kliyan an (../../capacitor.config.ts,
 * ki pibliye sou Uptodown). App sa a louvri dirèkteman /admin-login sou sit
 * pwodiksyon an — menm prensip "shell natif ki louvri sit ki deja anliy lan"
 * eksplike nan app kliyan an, men SAN limit chemen: yon fwa konekte, admin nan
 * navige lib nan tout paj staff li deja gen dwa wè (menm jan sou navigatè a).
 *
 * ⚠️ JAMÈ Play Store, Uptodown, ni okenn lyen piblik — bay men-a-men sèlman.
 */
const config: CapacitorConfig = {
  appId: 'com.standacommercialsa.admin',
  appName: 'Standa Admin',
  webDir: 'www',
  server: {
    url: 'https://www.standacommercialsa.com/admin-login',
    cleartext: false
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
