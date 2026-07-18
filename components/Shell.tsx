"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { getMyStaff } from "@/lib/authx";
import { Staff } from "@/lib/types";

const PUBLIC_PREFIXES = ["/inscription", "/login", "/espace-client", "/reset-password",
  "/confidentialite", "/admin-login", "/setup", "/nouveau-mot-de-passe"];

/**
 * Zòn admin lan (Dashboard, Clients, Packages...) mande yon kont STAFF
 * (Administrateur oswa Employé). Paj piblik yo rete jan yo ye.
 */
export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PREFIXES.some((p) => path.startsWith(p));
  const [staff, setStaff] = useState<Staff | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isPublic) return;
    getMyStaff().then((s) => {
      if (!s) { router.replace("/admin-login"); return; }
      setStaff(s); setChecked(true);
    });
  }, [isPublic, path, router]);

  if (isPublic) return <main className="min-h-screen">{children}</main>;
  if (!checked) return <div className="min-h-screen bg-mist grid place-items-center text-slate-400">Ap verifye aksè...</div>;
  return (
    <div className="flex">
      <Sidebar staff={staff} />
      <main className="flex-1 min-w-0 p-6">{children}</main>
    </div>
  );
}
