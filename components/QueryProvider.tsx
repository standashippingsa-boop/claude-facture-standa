"use client";
/*
 * TanStack Query : cache des données pour tout le système.
 * Réglages prudents pour les réseaux lents et 1000 utilisateurs en même temps :
 *  • une donnée reste « fraîche » 30 s : pas de requête en double entre écrans ;
 *  • un seul nouvel essai en cas d'échec réseau ;
 *  • pas de rechargement à chaque retour sur l'onglet (évite les rafales de requêtes) ;
 *  • rien n'est relu quand l'écran est caché.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchIntervalInBackground: false,
      },
      mutations: { retry: 0 },
    },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
