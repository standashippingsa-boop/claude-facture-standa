"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Loader from "./Loader";
import { getMyStaff } from "@/lib/authx";
import { getClientByAuthId } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { Staff } from "@/lib/types";
import { AppRole, isClientPath, isPublicPath, resolveAccess } from "@/lib/access";

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

  const publicPath = isPublicPath(path);

  useEffect(() => {
    if (publicPath) { setReady(true); return; }
    let cancelled = false;
    (async () => {
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

  if (publicPath) return <main className="min-h-screen">{children}</main>;
  if (!ready) return <Loader />;

  // Kliyan: paj san sidebar staff (espace-client gen pwòp entèfas li)
  if (role === "client" || isClientPath(path)) return <main className="min-h-screen">{children}</main>;

  // Staff: sidebar + kontni
  return (
    <div className="flex">
      <Sidebar staff={staff} />
      <main className="flex-1 min-w-0 p-6">{children}</main>
    </div>
  );
}
