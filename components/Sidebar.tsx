"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Inbox, LayoutDashboard, LogOut, Users, Package, FileText, History,
  RefreshCw, Settings, ClipboardList, Truck, FileDown, MessageSquareText
} from "lucide-react";
import Logo from "./Logo";
import { supabase } from "@/lib/supabase";
import { Staff } from "@/lib/types";
import { isAdminOnlyPath } from "@/lib/access";

// Nav gwoupe pa seksyon (estil dashboard pwofesyonèl)
const groups: { title: string; items: { href: string; label: string; icon: typeof Users }[] }[] = [
  {
    title: "Général",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/packages", label: "Packages", icon: Package },
      { href: "/conduces", label: "Conduces", icon: Truck }
    ]
  },
  {
    title: "Facturation",
    items: [
      { href: "/invoices", label: "Factures", icon: FileText },
      { href: "/bon-remise", label: "Bon de Remise", icon: FileDown },
      { href: "/retraits", label: "Retraits", icon: Inbox }
    ]
  },
  {
    title: "Système",
    items: [
      { href: "/sync", label: "Synchronisation", icon: RefreshCw },
      { href: "/historique", label: "Historique", icon: History },
      { href: "/journal", label: "Journal", icon: ClipboardList },
      { href: "/reviews", label: "Commentaires", icon: MessageSquareText },
      { href: "/settings", label: "Paramètres", icon: Settings }
    ]
  }
];

export default function Sidebar({ staff }: { staff?: Staff | null }) {
  const path = usePathname();
  const router = useRouter();
  const logout = async () => { await supabase.auth.signOut(); router.replace("/admin-login"); };
  const isAdmin = staff?.role === "admin";
  const initials = (staff?.prenom || staff?.username || "S").slice(0, 2).toUpperCase();

  return (
    <aside className="w-64 shrink-0 bg-navy text-white min-h-screen flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16">
        <Logo size={34} />
        <div>
          <p className="font-extrabold text-sm leading-tight">STANDA</p>
          <p className="text-[10px] text-white/50 tracking-wide">COMMERCIAL</p>
        </div>
      </div>

      {/* Nav gwoupe */}
      <nav className="flex-1 px-3 py-2 space-y-5 overflow-y-auto">
        {groups.map((g) => {
          const items = g.items.filter((i) => isAdmin || !isAdminOnlyPath(i.href));
          if (!items.length) return null;
          return (
            <div key={g.title}>
              <p className="px-3 mb-1.5 text-[10px] font-bold text-white/40 uppercase tracking-widest">{g.title}</p>
              <div className="space-y-0.5">
                {items.map(({ href, label, icon: Icon }) => {
                  const active = href === "/" ? path === "/" : path.startsWith(href);
                  return (
                    <Link key={href} href={href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active ? "bg-white text-navy font-semibold shadow-sm" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
                      <Icon size={17} className={active ? "text-navy" : ""} /> {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Kat itilizatè + dekonekte */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-sm font-bold">{initials}</div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{staff?.prenom || staff?.username || "—"}</p>
            <p className="text-[11px] text-white/50">{isAdmin ? "Administrateur" : "Employé"}</p>
          </div>
        </div>
        <button onClick={logout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white transition-colors">
          <LogOut size={17} /> Dekonekte
        </button>
      </div>
    </aside>
  );
}
