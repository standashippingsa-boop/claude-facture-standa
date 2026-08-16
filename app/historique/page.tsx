"use client";
/*
 * STANDA COMMERCIAL — ARCHIVES (colis facturés / livrés)
 * ═══════════════════════════════════════════════════════
 * Koli ki fakture yo soti nan lis aktif la epi yo ateri isit la.
 * ZEWO efasman: tout done yo rete (tracking, kliyan, pwa, kontni,
 * conduce, validasyon scanner, fakti, pri, taks).
 * Chak koli gen yon lyen dirèk sou fakti li.
 */
import { useEffect, useMemo, useState } from "react";
import { PackageCheck, CheckCircle2, Camera } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import Pagination from "@/components/Pagination";
import RefreshButton from "@/components/RefreshButton";
import { getConduces, getInvoices, getPackages, setPackageStatus } from "@/lib/db";
import { Conduce, Invoice, Pkg } from "@/lib/types";
import { usd, dateFr } from "@/lib/utils";

const PER_PAGE = 25;

export default function HistoriquePage() {
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [invoices, setInvoices] = useState<Map<string, Invoice>>(new Map());
  const [conduces, setConduces] = useState<Conduce[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateF, setDateF] = useState("");
  const [conduceF, setConduceF] = useState("");
  const [page, setPage] = useState(1);

  const conduceMap = useMemo(
    () => new Map(conduces.map((c) => [c.id, c.conduce_number])), [conduces]);

  const load = async () => {
    const [all, invs, cds] = await Promise.all([getPackages(), getInvoices(), getConduces().catch(() => [])]);
    setPkgs(all.filter((p) => p.status !== "Disponible"));
    setInvoices(new Map(invs.map((i) => [i.id, i])));
    setConduces(cds as Conduce[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pkgs.filter((p) => {
      if (status && p.status !== status) return false;
      if (dateF && !(p.created_date ?? "").includes(dateF)) return false;
      if (conduceF && p.conduce_id !== conduceF) return false;
      if (!q) return true;
      const inv = p.invoice_id ? invoices.get(p.invoice_id) : null;
      return p.customer_code.toLowerCase().includes(q)
        || p.customer_name.toLowerCase().includes(q)
        || p.tracking_number.toLowerCase().includes(q)
        || (p.tracking_manual ?? "").toLowerCase().includes(q)
        || (p.content ?? "").toLowerCase().includes(q)
        || (inv?.invoice_number ?? "").toLowerCase().includes(q)
        || (p.conduce_id ? (conduceMap.get(p.conduce_id) ?? "") : "").toLowerCase().includes(q);
    });
  }, [pkgs, search, status, dateF, conduceF, invoices, conduceMap]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  useEffect(() => { setPage(1); }, [search, status, dateF, conduceF]);

  const livrer = async (p: Pkg) => {
    await setPackageStatus(p.id, "Livré");
    setPkgs((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: "Livré" } : x)));
  };

  const totalUsd = filtered.reduce((s, p) => s + (Number(p.total_usd) || 0), 0);
  const totalLb = filtered.reduce((s, p) => s + (Number(p.weight) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="h-page">Archives</h1>
          <p className="text-sm text-mute mt-0.5">Colis facturés &amp; livrés — historique complet, jamais supprimé</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input className="input w-72" placeholder="Tracking, code, nom, contenu, No facture, conduce..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <input className="input w-32" placeholder="Date (2026.07)" value={dateF}
            onChange={(e) => setDateF(e.target.value)} />
          <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous statuts</option><option>Facturé</option><option>Livré</option>
          </select>
          <select className="input w-40" value={conduceF} onChange={(e) => setConduceF(e.target.value)}>
            <option value="">Toutes conduces</option>
            {conduces.map((c) => <option key={c.id} value={c.id}>Conduce {c.conduce_number}</option>)}
          </select>
          <RefreshButton onRefresh={load} />
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-mute px-1">
        <span>{filtered.length} colis</span>
        <span>{totalLb.toFixed(2)} lb</span>
        <span className="font-semibold text-ink">{usd(totalUsd)}</span>
        <span className="ml-auto">
          Factures &amp; PDF : <a href="/invoices" className="text-navy underline font-semibold">Factures</a>
        </span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr>{["No Facture", "Code Client", "Nom", "Tracking ID (Guía)", "Conduce", "Date", "Lb", "Content", "Total (USD)", "Validation", "Status", ""]
            .map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={12} className="text-center py-10 text-mute">Aucun colis dans les archives.</td></tr>
            ) : rows.map((p, i) => {
              const inv = p.invoice_id ? invoices.get(p.invoice_id) : null;
              return (
                <tr key={p.id} className={i % 2 ? "bg-mist" : ""}>
                  <td className="td font-bold">
                    {inv
                      ? <a href="/invoices" className="text-navy hover:underline" title={`Facture ${inv.invoice_number} — ${dateFr(inv.created_at)}`}>{inv.invoice_number}</a>
                      : <span className="text-mute">—</span>}
                  </td>
                  <td className="td">
                    <a href={`/clients/${encodeURIComponent(p.customer_code)}`} className="text-navy hover:underline font-semibold">
                      {p.customer_code}
                    </a>
                  </td>
                  <td className="td">{p.customer_name}</td>
                  <td className="td font-mono text-xs">{p.tracking_number}</td>
                  <td className="td text-xs">{p.conduce_id ? (conduceMap.get(p.conduce_id) ?? "—") : "—"}</td>
                  <td className="td">{p.created_date}</td>
                  <td className="td">{p.weight}</td>
                  <td className="td">{p.content}</td>
                  <td className="td text-right font-semibold">{usd(p.total_usd)}</td>
                  <td className="td">
                    <div className="flex items-center gap-1">
                      {p.verified && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-0.5 text-[9px] font-bold"
                          title="Vérifié MCPACK (scanner)"><CheckCircle2 size={10} /> Vérifié</span>
                      )}
                      {p.proof_photo_url && (
                        <a href={p.proof_photo_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[9px] font-bold hover:bg-blue-200"
                          title="Photo de preuve"><Camera size={10} /> Photo</a>
                      )}
                      {!p.verified && !p.proof_photo_url && <span className="text-mute text-[11px]">—</span>}
                    </div>
                  </td>
                  <td className="td"><StatusBadge status={p.status} /></td>
                  <td className="td whitespace-nowrap">
                    {p.status === "Facturé" && (
                      <button className="btn btn-ghost !py-1 !px-2 text-xs border border-line" onClick={() => livrer(p)}>
                        <PackageCheck size={13} /> Marquer Livré
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination page={page} pages={pages} onPage={setPage} />
      </div>
    </div>
  );
}
