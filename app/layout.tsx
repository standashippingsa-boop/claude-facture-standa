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
  alternates: { canonical: "/" },
  robots: { index: false, follow: false },   // zouti entèn: pa endekse pa Google
  applicationName: "STANDA COMMERCIAL",
  title: "STANDA COMMERCIAL — Gestion de colis & facturation",
  description: "Système professionnel de gestion de colis.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "STANDA"
  },
  formatDetection: { telephone: false },
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
    <html lang="ht">
      <body>
        <SelectionProvider>
          <Shell>{children}</Shell>
          <SelectionBar />
        </SelectionProvider>
        <PwaManager />
        <InstallGateway />
      </body>
    </html>
  );
}
