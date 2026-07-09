"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { getClient, getClientPackages } from "@/lib/db";
import { Client, Pkg } from "@/lib/types";
import { usd } from "@/lib/utils";

export default function ClientDetail({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const decoded = decodeURIComponent(code);
  const [client, setClient] = useState<Client | null>(null);
  const [pkgs, setPkgs] = useState<Pkg[]>([]);

  useEffect(() => {
    getClient(decoded).then(setClient);
    getClientPackages(decoded).then(setPkgs);
  }, [decoded]);

  return (
    <div className="space-y-4">
      <Link href="/clients" className="inline-flex items-center gap-2 text-sm font-semibold text-navy hover:underline">
        <ArrowLeft size={15} /> Retour aux clients
      </Link>

      <div className="card p-5">
        {client ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-xs text-slate-500">Code</p><p className="font-extrabold text-navy text-lg">{client.customer_code}</p></div>
            <div><p className="text-xs text-slate-500">Nom</p><p className="font-semibold">{client.fullname}</p></div>
            <div><p className="text-xs text-slate-500">WhatsApp</p><p className="font-semibold">{client.whatsapp || "—"}</p></div>
            <div><p className="text-xs text-slate-500">Lieu de récupération</p><p className="font-semibold">{client.pickup_location || "—"}</p></div>
            <div><p className="text-xs text-slate-500">Ville (tarification)</p><p className="font-semibold">{client.ville?.name || "Aucune ville"}</p></div>
            <div><p className="text-xs text-slate-500">Type de compte</p><p className="font-semibold">{client.account_type ?? "Personnel"}</p></div>
          </div>
        ) : <p className="text-sm text-slate-400">Chargement du client {decoded}...</p>}
      </div>

      <div className="card overflow-x-auto">
        <div className="px-4 py-3 border-b border-line">
          <h2 className="text-sm font-bold text-navy">Tous les colis ({pkgs.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead><tr>{["Tracking ID (Guía)", "Date", "Weight (lb)", "Content", "Price (USD)", "Tax (USD)", "Total (USD)", "Status"]
            .map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>
            {pkgs.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-slate-400">Aucun colis pour ce client.</td></tr>
            ) : pkgs.map((p, i) => (
              <tr key={p.id} className={i % 2 ? "bg-mist" : ""}>
                <td className="td font-mono text-xs">{p.tracking_number}</td>
                <td className="td">{p.created_date}</td>
                <td className="td">{p.weight}</td>
                <td className="td">{p.content}</td>
                <td className="td text-right">{usd(p.price_usd)}</td>
                <td className="td text-right">{usd(p.tax_usd)}</td>
                <td className="td text-right font-semibold">{usd(p.total_usd)}</td>
                <td className="td"><StatusBadge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
