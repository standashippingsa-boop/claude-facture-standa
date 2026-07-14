"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Package, FileText, DollarSign, RefreshCw, CheckCircle2, Bell, Inbox, UserPlus } from "lucide-react";
import { getClients, getRetraits, getStats } from "@/lib/db";
import { Client, DashboardStats, Retrait } from "@/lib/types";
import { dateFr, usd } from "@/lib/utils";
import Logo from "@/components/Logo";

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [nouvo, setNouvo] = useState<Client[]>([]);       // nouvo kliyan annatant
  const [retraits, setRetraits] = useState<Retrait[]>([]); // demandes de retrait annatant
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getStats().then(setStats).catch((e) => setErr(e.message ?? String(e)));
    // Notifikasyon: nouvo kliyan (En attente d'activation) + demandes de retrait
    // (estrikti sa a pare pou Desktop Notifications pita)
    getClients().then((cs) =>
      setNouvo(cs.filter((c) => c.account_status === "En attente d'activation"))
    ).catch(() => {});
    getRetraits().then((rs) =>
      setRetraits(rs.filter((r) => r.status === "En attente"))
    ).catch(() => {});
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

      {/* ===== Notifications ===== */}
      {(nouvo.length > 0 || retraits.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide flex items-center gap-2">
            <Bell size={15} /> Notifications
            <span className="badge bg-amber-100 text-amber-700">{nouvo.length + retraits.length}</span>
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {nouvo.map((c) => (
              <Link key={c.id} href="/clients"
                className="card p-4 flex items-start gap-3 hover:shadow-md transition-shadow border-l-4 !border-l-amber-400">
                <UserPlus size={18} className="text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-navy">Nouveau client — {[c.fullname, c.surname].filter(Boolean).join(" ")}</p>
                  <p className="text-xs text-slate-500">
                    {[c.city, c.phone || c.whatsapp].filter(Boolean).join(" · ")}
                    {c.created_at ? " · " + dateFr(c.created_at) : ""}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">En attente d&apos;activation — klike pou ouvri dosye a</p>
                </div>
              </Link>
            ))}
            {retraits.map((r) => (
              <Link key={r.id} href="/retraits"
                className="card p-4 flex items-start gap-3 hover:shadow-md transition-shadow border-l-4 !border-l-blue-400">
                <Inbox size={18} className="text-blue-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-navy">Demande de retrait — {r.customer_name} ({r.customer_code})</p>
                  <p className="text-xs text-slate-500">
                    {r.package_count} colis · {Number(r.total_weight).toFixed(2)} lb
                    {r.ville ? " · " + r.ville : ""} · {dateFr(r.created_at)}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">En attente — klike pou prepare koli yo</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

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
