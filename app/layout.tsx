import type { Metadata, Viewport } from "next";
import "./globals.css";
import Shell from "@/components/Shell";
import PwaManager from "@/components/PwaManager";
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
          FRONTIÈRE SITE / APPLICATION — kouri trè bonè, anvan React monte,
          pou anpeche yon lyen piblik melanje ak yon sesyon deja konekte.
          (Ansyen kòmantè isit la te pale de kapti siyal "enstale app la" —
          bando sa a retire definitivman kounye a: nou gen yon vrè APK sou
          Uptodown, nou pa ankò mande kliyan yo "enstale" sit la kòm PWA.)
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              /*
               * FRONTIÈRE SITE / APPLICATION
               * ─────────────────────────────
               * sessionStorage est isolé par onglet : un nouvel onglet peut
               * toujours consulter le site public. En revanche, dans l'onglet
               * déjà connecté à une application, une navigation arrière ou un
               * lien public ne doit jamais mélanger les deux produits.
               */
              try {
                var realm = window.sessionStorage.getItem('standa:auth-realm');
                var path = window.location.pathname;
                var publicPages = {
                  '/accueil': true, '/contact': true, '/agences': true,
                  '/login': true, '/inscription': true, '/confidentialite': true,
                  '/reset-password': true, '/nouveau-mot-de-passe': true,
                  '/admin-login': true, '/employe': true, '/point-retrait': true,
                  '/setup': true
                };
                var homes = { client: '/espace-client', agent_retrait: '/espace-remise', admin: '/dashboard', employe: '/dashboard' };
                var gates = { client: '/espace-client/connexion', agent_retrait: '/point-retrait', admin: '/admin-login', employe: '/employe' };
                if (realm && homes[realm] && publicPages[path] && path !== gates[realm]) {
                  window.location.replace(homes[realm]);
                  return;
                }
              } catch (_) { /* stockage privé indisponible : le garde React prend le relais. */ }
            })();`
          }}
        />
      </head>
      <body>
        <SelectionProvider>
          <Shell>{children}</Shell>
          <SelectionBar />
        </SelectionProvider>
        <PwaManager />
      </body>
    </html>
  );
}
