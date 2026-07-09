"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Package, FileText, DollarSign, RefreshCw, CheckCircle2 } from "lucide-react";
import { getStats } from "@/lib/db";
import { DashboardStats } from "@/lib/types";
import { dateFr, usd } from "@/lib/utils";
import Logo from "@/components/Logo";

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getStats().then(setStats).catch((e) => setErr(e.message ?? String(e)));
  }, []);

  const cards = stats ? [
    { label: "Total clients", value: stats.totalClients, icon: Users, href: "/clients" },
    { label: "Colis disponibles", value: stats.disponibles, icon: Package, href: "/packages" },
    { label: "Colis facturés", value: stats.factures, icon: CheckCircle2, href: "/historique" },
    { label: "Total factures", value: stats.totalInvoices, icon: FileText, href: "/invoices" },
    { label: "Revenu total (USD)", value: usd(stats.revenue), icon: DollarSign, href: "/invoices" }
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Logo size={44} rounded="rounded-xl" />
        <div>
          <h1 className="text-xl font-extrabold text-navy leading-tight">Dashboard</h1>
          <p className="text-xs text-slate-500">STANDA COMMERCIAL — Gestion de colis & facturation</p>
        </div>
      </div>

      {err && <p className="card p-4 text-sm text-red-600">Erè koneksyon bazdone: {err} — verifye .env.local ou a.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <Icon size={16} className="text-navy-light" />
            </div>
            <p className="text-2xl font-extrabold text-navy mt-2">{value}</p>
          </Link>
        ))}
        {!stats && !err && <p className="text-sm text-slate-400">Ap chaje estatistik yo...</p>}
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <RefreshCw size={15} className="text-navy-light" />
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide">Dernier import MCPACK</h2>
        </div>
        {stats?.lastImport ? (
          <p className="text-sm text-slate-600">
            <span className="font-semibold">{dateFr(stats.lastImport.created_at)}</span> — {stats.lastImport.filename} :{" "}
            {stats.lastImport.new_packages} nouveaux colis, {stats.lastImport.existing_packages} existants,{" "}
            {stats.lastImport.new_clients} nouveaux clients, {stats.lastImport.errors} erreurs.
          </p>
        ) : (
          <p className="text-sm text-slate-400">
            Poko gen import. <Link className="text-navy underline font-semibold" href="/sync">Synchroniser MCPACK</Link>
          </p>
        )}
      </div>
    </div>
  );
}
