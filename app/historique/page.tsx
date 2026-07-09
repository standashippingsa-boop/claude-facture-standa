"use client";
import { useEffect, useMemo, useState } from "react";
import { PackageCheck } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import Pagination from "@/components/Pagination";
import { getInvoices, getPackages, setPackageStatus } from "@/lib/db";
import { Invoice, Pkg } from "@/lib/types";
import { usd } from "@/lib/utils";

const PER_PAGE = 25;

export default function HistoriquePage() {
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [invoices, setInvoices] = useState<Map<string, Invoice>>(new Map());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const load = async () => {
    const [all, invs] = await Promise.all([getPackages(), getInvoices()]);
    setPkgs(all.filter((p) => p.status !== "Disponible"));
    setInvoices(new Map(invs.map((i) => [i.id, i])));
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pkgs.filter((p) =>
      (!q || p.customer_code.toLowerCase().includes(q) || p.customer_name.toLowerCase().includes(q)
        || p.tracking_number.toLowerCase().includes(q)
        || (p.invoice_id && invoices.get(p.invoice_id)?.invoice_number.toLowerCase().includes(q)))
      && (!status || p.status === status));
  }, [pkgs, search, status, invoices]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  useEffect(() => { setPage(1); }, [search, status]);

  const livrer = async (p: Pkg) => {
    await setPackageStatus(p.id, "Livré");
    setPkgs((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: "Livré" } : x)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-extrabold text-navy">Historique des colis facturés</h1>
        <div className="flex gap-2">
          <input className="input w-80" placeholder="Code, nom, tracking, No facture..." value={search}
            onChange={(e) => setSearch(e.target.value)} />
          <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous</option><option>Facturé</option><option>Livré</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Les factures et PDF se trouvent dans le menu <a href="/invoices" className="text-navy underline font-semibold">Invoices</a> —
        ré-impression, téléchargement et renvoi WhatsApp à tout moment.
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr>{["No Facture", "Code Client", "Nom", "Tracking ID (Guía)", "Date", "Weight (lb)", "Content", "Total (USD)", "Status", ""]
            .map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10 text-slate-400">Aucun colis facturé pour le moment.</td></tr>
            ) : rows.map((p, i) => (
              <tr key={p.id} className={i % 2 ? "bg-mist" : ""}>
                <td className="td font-bold text-navy">{p.invoice_id ? invoices.get(p.invoice_id)?.invoice_number ?? "—" : "—"}</td>
                <td className="td">{p.customer_code}</td>
                <td className="td">{p.customer_name}</td>
                <td className="td font-mono text-xs">{p.tracking_number}</td>
                <td className="td">{p.created_date}</td>
                <td className="td">{p.weight}</td>
                <td className="td">{p.content}</td>
                <td className="td text-right font-semibold">{usd(p.total_usd)}</td>
                <td className="td"><StatusBadge status={p.status} /></td>
                <td className="td whitespace-nowrap">
                  {p.status === "Facturé" && (
                    <button className="btn btn-ghost !py-1 !px-2 text-xs border border-line" onClick={() => livrer(p)}>
                      <PackageCheck size={13} /> Marquer Livré
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} pages={pages} onPage={setPage} />
      </div>
    </div>
  );
}
