import type { Metadata } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";

// Application installable (PWA) propre à cet espace : son manifeste remplace
// celui de l'espace client défini dans app/layout.tsx.
export const metadata: Metadata = {
  manifest: "/manifest-remise.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "STANDA Retrait" }
};

// Polices de l'app Retrait (auto-hébergées par Next, sans requête externe) :
// texte en Plus Jakarta Sans, codes / numéros de suivi / dates en IBM Plex Mono.
const agentSans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-agent", display: "swap" });
const agentMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-agent-mono", display: "swap" });

export default function EspaceRemiseLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${agentSans.variable} ${agentMono.variable}`}>{children}</div>;
}
