"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAuthRealm, type AuthRealm } from "@/lib/supabase";
import { isPublicPath } from "@/lib/access";

const HOME: Record<AuthRealm, string> = {
  client: "/espace-client",
  agent_retrait: "/espace-remise",
  admin: "/dashboard",
  employe: "/dashboard"
};
const GATE: Record<AuthRealm, string> = {
  client: "/espace-client/connexion",
  agent_retrait: "/point-retrait",
  admin: "/admin-login",
  employe: "/employe"
};

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
    router.replace(HOME[realm]);
  }, [pathname, router]);

  return <>{children}</>;
}
