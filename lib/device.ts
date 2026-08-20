/*
 * STANDA COMMERCIAL — Kouch deteksyon aparèy / navigatè / kapasite PWA
 * ══════════════════════════════════════════════════════════════════
 * Objektif: chwazi BON chemen enstalasyon an pou CHAK aparèy.
 * 100% lekti sèlman — pa touche okenn done ni lojik biznis.
 */

export type Platform = "android" | "ios" | "windows" | "mac" | "chromeos" | "linux" | "unknown";
export type Browser = "chrome" | "edge" | "safari" | "firefox" | "samsung" | "opera" | "other";
export type DeviceType = "phone" | "tablet" | "desktop";

/** Ki metòd enstalasyon ki apwopriye pou aparèy sa a. */
export type InstallMethod =
  | "native"        // beforeinstallprompt disponib (Android/Chrome, Edge, Chromebook, Desktop)
  | "ios-safari"    // iPhone/iPad Safari -> Partager > Sur l'écran d'accueil
  | "ios-other"     // iPhone/iPad men PA Safari -> fòk yo louvri nan Safari
  | "manual-menu"   // Firefox/Samsung/lòt -> menu navigatè a
  | "in-app"        // WebView WhatsApp/Facebook/Instagram -> fòk yo louvri nan vre navigatè a
  | "unsupported";  // pa gen chemen -> fallback web

export interface DeviceInfo {
  platform: Platform;
  browser: Browser;
  deviceType: DeviceType;
  isStandalone: boolean;      // deja ap kouri kòm app enstale
  isInApp: boolean;           // WebView anndan WhatsApp/Facebook/Instagram/etc.
  supportsServiceWorker: boolean;
  installMethod: InstallMethod;
  label: string;              // ex: "iPhone · Safari"
}

/** Etap enstriksyon vizyèl pou aparèy ki pa gen prompt otomatik. */
export interface InstallSteps {
  title: string;
  steps: string[];
  note?: string;
}

/**
 * WebView anndan yon lòt app (WhatsApp, Facebook, Instagram, Messenger, TikTok…).
 * ENPÒTAN pou STANDA: nou voye lyen yo sou WhatsApp — nan WebView sa yo
 * enstalasyon PWA PA POSIB menm. Fòk kliyan an louvri lyen an nan vre
 * navigatè a (Chrome / Safari) anvan li ka enstale app la.
 */
function detectInApp(ua: string): boolean {
  return /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Line\/|MicroMessenger|TikTok|Twitter|WhatsApp|GSA\//i.test(ua);
}

function detectPlatform(ua: string, maxTouch: number): Platform {
  if (/Android/i.test(ua)) return "android";
  // iPad iOS 13+ prezante tèt li kòm "Macintosh" ak ekran tactile
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouch > 1)) return "ios";
  if (/CrOS/i.test(ua)) return "chromeos";
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Linux/i.test(ua)) return "linux";
  return "unknown";
}

function detectBrowser(ua: string): Browser {
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/Edg\//i.test(ua)) return "edge";
  if (/OPR\/|Opera/i.test(ua)) return "opera";
  if (/Firefox|FxiOS/i.test(ua)) return "firefox";
  // Chrome dwe teste APRE Edge/Opera/Samsung (yo tout gen "Chrome" nan UA)
  if (/Chrome|CriOS/i.test(ua)) return "chrome";
  if (/Safari/i.test(ua)) return "safari";
  return "other";
}

function detectDeviceType(ua: string, platform: Platform, maxTouch: number, width: number): DeviceType {
  if (platform === "ios") {
    if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouch > 1)) return "tablet";
    return "phone";
  }
  if (platform === "android") return /Mobile/i.test(ua) ? "phone" : "tablet";
  if (width > 0 && width < 768 && maxTouch > 0) return "phone";
  return "desktop";
}

/**
 * Detekte aparèy la. `hasNativePrompt` = èske nou kapte beforeinstallprompt.
 * Rele sèlman kote kliyan (browser), pa sou sèvè a.
 */
export function detectDevice(hasNativePrompt: boolean): DeviceInfo {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      platform: "unknown", browser: "other", deviceType: "desktop",
      isStandalone: false, isInApp: false, supportsServiceWorker: false,
      installMethod: "unsupported", label: "—",
    };
  }
  const nav: any = navigator;
  const ua = String(nav.userAgent || "");
  const maxTouch = Number(nav.maxTouchPoints || 0);
  const width = Number(window.innerWidth || 0);

  const platform = detectPlatform(ua, maxTouch);
  const browser = detectBrowser(ua);
  const deviceType = detectDeviceType(ua, platform, maxTouch, width);

  let isStandalone = false;
  try {
    isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || window.matchMedia("(display-mode: fullscreen)").matches
      || window.matchMedia("(display-mode: minimal-ui)").matches
      || nav.standalone === true;                       // iOS Safari
  } catch { /* noop */ }

  const supportsServiceWorker = "serviceWorker" in nav;

  const isInApp = detectInApp(ua);

  let installMethod: InstallMethod;
  if (isInApp && !hasNativePrompt) {
    installMethod = "in-app";                            // fòk yo soti nan WebView la
  } else if (hasNativePrompt) {
    installMethod = "native";                            // pi bon chemen an
  } else if (platform === "ios") {
    installMethod = browser === "safari" ? "ios-safari" : "ios-other";
  } else if (!supportsServiceWorker) {
    installMethod = "unsupported";
  } else if (browser === "firefox" || browser === "samsung" || browser === "opera") {
    installMethod = "manual-menu";
  } else if (platform === "android" || platform === "chromeos" || platform === "windows"
    || platform === "mac" || platform === "linux") {
    // Navigatè sipòte PWA men prompt la poko rive (oswa deja itilize)
    installMethod = "manual-menu";
  } else {
    installMethod = "unsupported";
  }

  const platLabel: Record<Platform, string> = {
    android: "Android", ios: deviceType === "tablet" ? "iPad" : "iPhone",
    windows: "Windows", mac: "Mac", chromeos: "Chromebook", linux: "Linux", unknown: "Appareil",
  };
  const browLabel: Record<Browser, string> = {
    chrome: "Chrome", edge: "Edge", safari: "Safari", firefox: "Firefox",
    samsung: "Samsung Internet", opera: "Opera", other: "Navigateur",
  };

  return {
    platform, browser, deviceType, isStandalone, isInApp, supportsServiceWorker, installMethod,
    label: `${platLabel[platform]} · ${isInApp ? "Navigateur intégré" : browLabel[browser]}`,
  };
}

/** Enstriksyon etap-pa-etap adapte ak aparèy la (lè pa gen prompt otomatik). */
export function getInstallSteps(d: DeviceInfo): InstallSteps {
  const isTablet = d.deviceType === "tablet";
  switch (d.installMethod) {
    case "ios-safari":
      return {
        title: `Ajouter à l'écran d'accueil (${isTablet ? "iPad" : "iPhone"})`,
        steps: [
          `Appuyez sur le bouton Partager ${isTablet ? "en haut" : "en bas"} de Safari`,
          "Faites défiler puis choisissez « Sur l'écran d'accueil »",
          "Appuyez sur « Ajouter » en haut à droite",
        ],
        note: "L'application s'ouvrira ensuite en plein écran, comme une vraie app.",
      };
    case "ios-other":
      return {
        title: "Ouvrez ce lien dans Safari",
        steps: [
          "Copiez l'adresse de cette page",
          "Ouvrez l'application Safari",
          "Collez l'adresse, puis Partager → « Sur l'écran d'accueil »",
        ],
        note: `Sur ${isTablet ? "iPad" : "iPhone"}, seul Safari peut installer une application.`,
      };
    case "in-app":
      return {
        title: "Ouvrez ce lien dans votre navigateur",
        steps: [
          "Appuyez sur le menu ⋮ (ou •••) en haut de cette fenêtre",
          d.platform === "ios"
            ? "Choisissez « Ouvrir dans Safari »"
            : "Choisissez « Ouvrir dans Chrome » ou « Ouvrir dans le navigateur »",
          "Vous pourrez ensuite installer l'application",
        ],
        note: "Une application ne peut pas être installée depuis WhatsApp, Facebook ou Instagram.",
      };
    case "manual-menu": {
      if (d.browser === "samsung") {
        return {
          title: "Ajouter à l'écran d'accueil",
          steps: [
            "Ouvrez le menu ☰ de Samsung Internet",
            "Choisissez « Ajouter la page à »",
            "Sélectionnez « Écran d'accueil »",
          ],
        };
      }
      if (d.browser === "firefox") {
        return {
          title: "Ajouter à l'écran d'accueil",
          steps: [
            "Ouvrez le menu ⋮ de Firefox",
            "Choisissez « Installer » ou « Ajouter à l'écran d'accueil »",
            "Confirmez l'ajout",
          ],
        };
      }
      if (d.deviceType === "desktop") {
        return {
          title: "Installer depuis votre navigateur",
          steps: [
            "Cliquez sur l'icône d'installation ⊕ dans la barre d'adresse",
            "Ou ouvrez le menu ⋮ puis « Installer STANDA COMMERCIAL »",
            "Confirmez l'installation",
          ],
          note: "L'application s'ouvrira dans sa propre fenêtre.",
        };
      }
      return {
        title: "Ajouter à l'écran d'accueil",
        steps: [
          "Ouvrez le menu ⋮ de votre navigateur",
          "Choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil »",
          "Confirmez l'ajout",
        ],
      };
    }
    default:
      return {
        title: "Installation automatique non disponible",
        steps: ["Vous pouvez continuer à utiliser STANDA COMMERCIAL sur le web, sans rien installer."],
        note: "Toutes les fonctionnalités restent disponibles.",
      };
  }
}
