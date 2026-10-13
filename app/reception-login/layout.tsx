import type { Metadata } from "next";
import InstallAppButton from "@/components/InstallAppButton";

// Application installable (PWA) propre à cet espace : son manifeste remplace
// celui de l'espace client défini dans app/layout.tsx.
export const metadata: Metadata = {
  manifest: "/manifest-reception.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "STANDA Réception" }
};

export default function ReceptionLoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<InstallAppButton /></>;
}
