"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAuthRealm, type AuthRealm } from "@/lib/supabase";
import { isPublicPath } from "@/lib/access";

const HOME: Record<AuthRealm, string> = {
  client: "/espace-client",
  agent_retrait: "/espace-remise",
  agent_reception: "/reception",
  admin: "/dashboard",
  employe: "/dashboard"
};
const GATE: Record<AuthRealm, string> = {
  client: "/espace-client/connexion",
  agent_retrait: "/point-retrait",
  agent_reception: "/reception-login",
  admin: "/admin-login",
  employe: "/employe"
};

const BOUNCE_KEY = "standa:portal-bounces";

/** Enregistre un renvoi ; vrai s'il y en a déjà eu 3 dans les 30 dernières secondes. */
function tooManyBounces(): boolean {
  try {
    const now = Date.now();
    const recent = (JSON.parse(window.sessionStorage.getItem(BOUNCE_KEY) ?? "[]") as number[])
      .filter((t) => typeof t === "number" && now - t < 30_000);
    if (recent.length >= 3) return true;
    window.sessionStorage.setItem(BOUNCE_KEY, JSON.stringify([...recent, now]));
    return false;
  } catch {
    return false;
  }
}

/**
 * Dernier filet de sécurité lors d'une navigation SPA vers le site public.
 * Le site reste libre dans un autre onglet; cet onglet-ci reste dans son app.
 */
export default function PublicPortalRedirect({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const realm = getAuthRealm();
    if (!realm || pathname === GATE[realm] || !isPublicPath(pathname)) return;
    // Disjoncteur : si on a déjà renvoyé cet onglet vers son espace 3 fois en
    // 30 s, c'est une boucle (l'espace renvoie lui-même ici). On s'arrête et
    // la page publique reste affichée au lieu de clignoter sans fin.
    if (tooManyBounces()) return;
    router.replace(HOME[realm]);
  }, [pathname, router]);

  return <>{children}</>;
}
