import type { Metadata } from "next";

// Application installable (PWA) propre à cet espace : son manifeste remplace
// celui de l'espace client défini dans app/layout.tsx.
export const metadata: Metadata = {
  manifest: "/manifest-remise.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "STANDA Retrait" }
};

export default function EspaceRemiseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
