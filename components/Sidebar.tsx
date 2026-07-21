"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox, LayoutDashboard, LogOut, Users, Package, FileText, History, RefreshCw, Settings, ClipboardList
} from "lucide-react";
import Logo from "./Logo";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/packages", label: "Packages", icon: Package },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/retraits", label: "Retraits", icon: Inbox },
  { href: "/historique", label: "Historique", icon: History },
  { href: "/journal", label: "Journal", icon: ClipboardList },
  { href: "/sync", label: "Synchronisation MCPACK", icon: RefreshCw },
  { href: "/settings", label: "Paramètres", icon: Settings }
];

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Staff } from "@/lib/types";

export default function Sidebar({ staff }: { staff?: Staff | null }) {
  const path = usePathname();
  const router = useRouter();
  // Employé pa gen aksè Paramètres
  const visible = items.filter((i) => i.href !== "/settings" || staff?.role === "admin");
  const logout = async () => { await supabase.auth.signOut(); router.replace("/admin-login"); };
  return (
    <aside className="w-64 shrink-0 bg-navy text-white min-h-screen flex flex-col">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
        <Logo size={36} />
        <div>
          <p className="font-extrabold text-sm leading-tight">STANDA COMMERCIAL</p>
          <p className="text-[11px] text-white/60">Gestion de colis & facturation</p>
        </div>
      </div>
      <nav className="p-3 space-y-1">
        {visible.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                active ? "bg-white text-navy" : "text-white/80 hover:bg-white/10"}`}>
              <Icon size={17} /> {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-3 border-t border-white/10">
        <p className="px-3 text-[11px] text-white/50 mb-1">
          {staff ? `${staff.prenom || staff.username} — ${staff.role === "admin" ? "Administrateur" : "Employé"}` : ""}
        </p>
        <button onClick={logout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10">
          <LogOut size={17} /> Dekonekte
        </button>
      </div>
    </aside>
  );
}
