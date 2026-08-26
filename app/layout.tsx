import type { Metadata, Viewport } from "next";
import "./globals.css";
import Shell from "@/components/Shell";
import PwaManager from "@/components/PwaManager";
import InstallGateway from "@/components/InstallGateway";
import SelectionBar from "@/components/SelectionBar";
import { SelectionProvider } from "@/lib/selection";
import { SITE_URL } from "@/lib/branding";

export const metadata: Metadata = {
  // Domèn kanonik: tout lyen/aperçu rezoud sou domèn ofisyèl la,
  // JANM sou URL deplwaman an.
  metadataBase: new URL(SITE_URL),
  /*
   * TIT LA — poukisa li chanje
   * ──────────────────────────
   * Ansyen tit la te "Gestion de colis & facturation": se non ZOUTI ENTÈN
   * nan. Lè yon kliyan te pataje yon lyen sou WhatsApp, se sa ki te parèt —
   * yon non ki pa di anyen bay yon moun k ap chèche shipping.
   *
   * `template` fè chak paj mete pwòp tit li devan mak la:
   *     Contact | STANDA COMMERCIAL
   * epi `default` sèvi lè yon paj pa gen tit pa l.
   */
  title: {
    default: "STANDA COMMERCIAL — Expédition de colis USA → Haïti",
    template: "%s | STANDA COMMERCIAL"
  },
  description:
    "Recevez vos achats en ligne des États-Unis en Haïti. Adresse de dépôt "
    + "gratuite à Miami, suivi de colis en temps réel et livraison en agence.",
  applicationName: "STANDA COMMERCIAL",

  /*
   * ENDEKSAJ — PA DEFO NON.
   * Zouti entèn nan (dashboard, koli, fakti, kliyan) pa gen anyen pou fè nan
   * Google. Sèlman paj piblik yo di `index: true` nan pwòp metadata yo.
   */
  robots: { index: false, follow: false },
  alternates: { canonical: "/accueil" },

  /*
   * APÈSI LYEN (WhatsApp / Facebook / Messenger)
   * Lè yon moun pataje yon lyen, se sa ki parèt. Nou mete akèy PIBLIK la
   * kòm referans — pa yon paj entèn, pa paj enskripsyon an.
   */
  openGraph: {
    type: "website",
    siteName: "STANDA COMMERCIAL",
    locale: "fr_HT",
    url: "/accueil",
    title: "STANDA COMMERCIAL — Expédition de colis USA → Haïti",
    description:
      "Adresse de dépôt gratuite à Miami, suivi de colis en temps réel "
      + "et livraison dans nos agences en Haïti."
  },
  twitter: {
    card: "summary_large_image",
    title: "STANDA COMMERCIAL — Expédition de colis USA → Haïti",
    description: "Vos achats en ligne, des USA jusqu'en Haïti."
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "STANDA"
  },
  formatDetection: { telephone: false },
  // Bloke bànyè "Traduire la page ?" Chrome/Google la — app la deja nan lang kliyan an.
  other: { google: "notranslate" },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#122B5C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ht" translate="no" className="notranslate">
      <head>
        {/*
          KAPTE SIYAL ENSTALASYON AN TRÈ BONÈ.
          ─────────────────────────────────────
          Chrome (Android/Desktop) voye `beforeinstallprompt` DEZÈ paj la
          kòmanse chaje — souvan AVAN React fin monte. Si nou tann yon
          useEffect, nou rate siyal la epi bouton "Installer" la pa janm
          parèt: kliyan an tonbe sou enstriksyon manyèl san rezon.

          Ti script sa a kouri anvan tout rès la, li kenbe siyal la sou
          window, epi li previni React lè li rive. Se sa ki fè enstalasyon
          an vin YON SÈL TAP sou Android.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              window.__standaBIP = window.__standaBIP || null;
              window.addEventListener('beforeinstallprompt', function(e){
                e.preventDefault();
                window.__standaBIP = e;
                window.dispatchEvent(new Event('standa:installready'));
              });
              window.addEventListener('appinstalled', function(){
                window.__standaBIP = null;
                window.dispatchEvent(new Event('standa:installed'));
              });
            })();`
          }}
        />
      </head>
      <body>
        <InstallGateway />
        <SelectionProvider>
          <Shell>{children}</Shell>
          <SelectionBar />
        </SelectionProvider>
        <PwaManager />
      </body>
    </html>
  );
}
