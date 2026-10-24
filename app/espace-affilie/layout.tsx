import type { Metadata } from "next";

// Application installable (PWA) propre à l'espace affilié : son manifeste
// remplace celui de l'espace client défini dans app/layout.tsx.
export const metadata: Metadata = {
  manifest: "/manifest-affilie.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "STANDA Affiliés" }
};

export default function EspaceAffilieLayout({ children }: { children: React.ReactNode }) {
  return children;
}
