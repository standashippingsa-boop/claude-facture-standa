"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Loader from "./Loader";
import ScrollToTopButton from "./ScrollToTopButton";
import PortalHistoryBoundary from "./PortalHistoryBoundary";
import PublicPortalRedirect from "./PublicPortalRedirect";
import { getMyStaff } from "@/lib/authx";
import { getClientByAuthId } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { Staff } from "@/lib/types";
import { isOffline, rememberedAgent } from "@/lib/reception-offline";
import { AppRole, isClientPath, isPublicPath, isPickupAgentPath, isReceptionAgentPath, resolveAccess } from "@/lib/access";

/**
 * Shell — CONTRÔLE D'ACCÈS CENTRALISÉ (RBAC)
 * ══════════════════════════════════════════════
 * Yon sèl kote ki deside aksè, ak lib/access.ts kòm sous verite:
 *   - Detekte wòl la: staff (admin/employe) oswa client.
 *   - resolveAccess() di si paj la otorize; sinon li redirije pwòpteman
 *     (kliyan -> /espace-client, employé sou paj admin -> /, elatriye).
 * Nou pa retire okenn gad ki egziste nan paj yo (defans an pwofondè).
 */
export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Changer de page ferme le menu (tablette, téléphone).
  useEffect(() => { setMenuOpen(false); }, [path]);

  const publicPath = isPublicPath(path);

  useEffect(() => {
    if (publicPath) { setReady(true); return; }
    let cancelled = false;
    (async () => {
      // Ajan resepsyon san entènèt: nou pa ka verifye wòl la sou sèvè a. Si
      // aparèy sa a te deja konekte kòm ajan resepsyon, ekran an louvri —
      // li montre sèlman kopi lokal la; tout anvwa ap tann rezo a (API a
      // toujou verifye sesyon an).
      if (isReceptionAgentPath(path) && rememberedAgent() !== null && await isOffline()) {
        if (cancelled) return;
        setStaff(null); setRole("agent_reception"); setReady(true);
        return;
      }
      // 1) Staff an premye
      const s = await getMyStaff();
      let r: AppRole | null = null;
      let st: Staff | null = null;
      if (s) { st = s; r = s.role; }
      else {
        // 2) Sinon, èske se yon kliyan?
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          const c = await getClientByAuthId(data.user.id);
          if (c) r = "client";
        }
      }
      if (cancelled) return;
      const { allowed, redirect } = resolveAccess(path, r);
      if (!allowed && redirect) { router.replace(redirect); return; }
      setStaff(st); setRole(r); setReady(true);
    })();
    return () => { cancelled = true; };
  }, [publicPath, path, router]);

  if (publicPath) return <PublicPortalRedirect><main className="min-h-screen">{children}<ScrollToTopButton /></main></PublicPortalRedirect>;
  if (!ready) return <Loader />;

  // Kliyan ak ajan remiz: chak gen pwòp entèfas mobil li, san sidebar staff.
  if (role === "client" || isClientPath(path)) {
    return <PortalHistoryBoundary realm="client" homePath="/espace-client"><main className="min-h-screen">{children}<ScrollToTopButton /></main></PortalHistoryBoundary>;
  }
  if (role === "agent_retrait" || isPickupAgentPath(path)) {
    return <PortalHistoryBoundary realm="agent_retrait" homePath="/espace-remise"><main className="min-h-screen">{children}<ScrollToTopButton /></main></PortalHistoryBoundary>;
  }
  if (role === "agent_reception" || isReceptionAgentPath(path)) {
    return <PortalHistoryBoundary realm="agent_reception" homePath="/reception"><main className="min-h-screen">{children}<ScrollToTopButton /></main></PortalHistoryBoundary>;
  }

  // Staff: sidebar + kontni
  return (
    <PortalHistoryBoundary realm={role === "employe" ? "employe" : "admin"} homePath="/dashboard"><div className="flex min-h-screen">
      <Sidebar staff={staff} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu" className="grid h-10 w-10 place-items-center rounded-lg border border-line text-navy">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
          </button>
          <span className="text-sm font-extrabold text-navy">STANDA</span>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-5 lg:p-6">{children}<ScrollToTopButton /></main>
      </div>
    </div></PortalHistoryBoundary>
  );
}
