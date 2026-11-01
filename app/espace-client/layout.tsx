import ClientProviders from "@/components/ClientProviders";

/**
 * Enveloppe tout /espace-client (app + /connexion) dans une seule police —
 * voir .client-app-font dans app/globals.css et la variable --font-client
 * chargée dans app/layout.tsx. N'affecte aucun autre espace (dashboard
 * staff/admin, agents, site public).
 * Les petits messages (sonner) sont rendus HORS de l'échelle réduite pour
 * garder une taille lisible.
 */
export default function EspaceClientLayout({ children }: { children: React.ReactNode }) {
  return <ClientProviders><div className="client-app-font">{children}</div></ClientProviders>;
}
