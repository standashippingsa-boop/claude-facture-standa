"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { type AuthRealm, portalHistorySessionKey } from "@/lib/supabase";
import { isPublicPath } from "@/lib/access";

const MARKER = "__standa_portal_boundary";
type Marker = { realm: AuthRealm; phase: "entry" | "guard" };

function stateWithMarker(marker: Marker) {
  const previous = window.history.state;
  const state = previous && typeof previous === "object" ? previous as Record<string, unknown> : {};
  return { ...state, [MARKER]: marker };
}

/**
 * Isole une application connectée de l'historique du site vitrine.
 *
 * La première entrée de l'espace reçoit une sentinelle invisible. Quand le
 * bouton physique ou navigateur « retour » essaie de passer cette sentinelle,
 * le navigateur revient à la dernière page de l'application au lieu du site.
 * Chaque rôle garde sa propre frontière afin qu'un agent ne puisse pas tomber
 * dans le portail client, et inversement.
 */
export default function PortalHistoryBoundary({ realm, homePath, children }: {
  realm: AuthRealm;
  homePath: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const sessionKey = portalHistorySessionKey(realm);
    try {
      const current = window.history.state && typeof window.history.state === "object"
        ? (window.history.state as Record<string, unknown>)[MARKER] as Marker | undefined
        : undefined;
      // Après une redirection complète, le sessionStorage peut encore être
      // présent alors que l'entrée active du navigateur n'a plus la sentinelle.
      // On vérifie les DEUX, sinon un retour pourrait à nouveau atteindre le site.
      if (window.sessionStorage.getItem(sessionKey) !== "1" || current?.realm !== realm) {
        // On garde l'état interne Next.js existant et on duplique uniquement
        // l'entrée courante. Ainsi « Retour » reste utilisable DANS l'app,
        // mais ne franchit jamais la frontière vers le site public.
        window.history.replaceState(stateWithMarker({ realm, phase: "entry" }), "", window.location.href);
        window.history.pushState(stateWithMarker({ realm, phase: "guard" }), "", window.location.href);
        window.sessionStorage.setItem(sessionKey, "1");
      }
    } catch {
      // En navigation privée sans sessionStorage, le garde popstate ci-dessous
      // protège quand même les retours vers une route publique.
    }

    const onPopState = (event: PopStateEvent) => {
      const marker = event.state && typeof event.state === "object"
        ? (event.state as Record<string, unknown>)[MARKER] as Marker | undefined
        : undefined;

      // La première entrée de la frontière n'est jamais quittée vers l'arrière.
      if (marker?.realm === realm && marker.phase === "entry") {
        window.history.go(1);
        return;
      }

      // Protection de secours : même si l'historique vient d'une ancienne
      // version, une route du site public ne doit pas s'afficher dans l'app.
      if (isPublicPath(window.location.pathname)) {
        window.history.go(1);
        window.setTimeout(() => {
          if (isPublicPath(window.location.pathname)) router.replace(homePath);
        }, 0);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [homePath, realm, router]);

  return <>{children}</>;
}
