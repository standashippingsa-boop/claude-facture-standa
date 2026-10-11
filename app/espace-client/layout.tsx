/**
 * Enveloppe tout /espace-client (app + /connexion) dans une seule police —
 * voir .client-app-font dans app/globals.css et la variable --font-client
 * chargée dans app/layout.tsx. N'affecte aucun autre espace (dashboard
 * staff/admin, agents, site public).
 */
export default function EspaceClientLayout({ children }: { children: React.ReactNode }) {
  return <div className="client-app-font">{children}</div>;
}
