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
import { usePathname } from "next/navigation";
import Link from "next/link";
import { PackageCheck, CheckCircle2, Camera } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import Pagination from "@/components/Pagination";
import RefreshButton from "@/components/RefreshButton";
import FilterConsole from "@/components/FilterConsole";
import { getClientTarifMap, getConduces, getInvoices, getPackages, setPackageStatus } from "@/lib/db";
import { Conduce, Invoice, Pkg } from "@/lib/types";
import { usd, dateFr } from "@/lib/utils";
import { usePackageSelection } from "@/lib/selection";
import { useRememberListContext, withReturnTo } from "@/lib/list-context";
import { specialPackageInfo } from "@/lib/special-package";

const PER_PAGE = 25;

export default function HistoriquePage() {
  const pathname = usePathname() ?? "/historique";
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [invoices, setInvoices] = useState<Map<string, Invoice>>(new Map());
  const [conduces, setConduces] = useState<Conduce[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateF, setDateF] = useState("");
  const [conduceF, setConduceF] = useState("");
  const [cityF, setCityF] = useState("");
  const [customerF, setCustomerF] = useState("");
  const [invoiceF, setInvoiceF] = useState("");
  const [verifiedF, setVerifiedF] = useState("");
  const [specialF, setSpecialF] = useState("");
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [page, setPage] = useState(1);
  useRememberListContext("historique", {
    search, status, dateF, conduceF, cityF, customerF, invoiceF, verifiedF,
    specialF, minWeight, maxWeight, page,
  }, (saved) => {
    const text = (name: string) => typeof saved[name] === "string" ? saved[name] : "";
    setSearch(text("search")); setStatus(text("status")); setDateF(text("dateF")); setConduceF(text("conduceF"));
    setCityF(text("cityF")); setCustomerF(text("customerF")); setInvoiceF(text("invoiceF"));
    setVerifiedF(text("verifiedF")); setSpecialF(text("specialF")); setMinWeight(text("minWeight")); setMaxWeight(text("maxWeight"));
    setPage(typeof saved.page === "number" && saved.page > 0 ? saved.page : 1);
  });
  const [tarifMap, setTarifMap] = useState<Map<string, { ville: { name: string } | null }>>(new Map());
  const sel = usePackageSelection();

  const conduceMap = useMemo(
    () => new Map(conduces.map((c) => [c.id, c.conduce_number])), [conduces]);

  const load = async () => {
    const [all, invs, cds, tm] = await Promise.all([getPackages(undefined, true), getInvoices(), getConduces().catch(() => []), getClientTarifMap()]);
    setPkgs(all.filter((p) => p.status !== "Disponible"));
    setInvoices(new Map(invs.map((i) => [i.id, i])));
    setConduces(cds as Conduce[]);
    setTarifMap(tm);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pkgs.filter((p) => {
      if (status && p.status !== status) return false;
      if (dateF && !(p.created_date ?? "").includes(dateF)) return false;
      if (conduceF && p.conduce_id !== conduceF) return false;
      if (cityF && tarifMap.get(p.customer_code)?.ville?.name !== cityF) return false;
      if (customerF && p.customer_code !== customerF) return false;
      if (invoiceF === "invoiced" && !p.invoice_id) return false;
      if (invoiceF === "not_invoiced" && p.invoice_id) return false;
      if (verifiedF === "verified" && !p.verified) return false;
      if (verifiedF === "not_verified" && p.verified) return false;
      const special = specialPackageInfo(p).isSpecial;
      if (specialF === "special" && !special) return false;
      if (specialF === "regular" && special) return false;
      if (minWeight && (Number(p.weight) || 0) < Number(minWeight)) return false;
      if (maxWeight && (Number(p.weight) || 0) > Number(maxWeight)) return false;
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
  }, [pkgs, search, status, dateF, conduceF, cityF, customerF, invoiceF, verifiedF, specialF, minWeight, maxWeight, invoices, conduceMap, tarifMap]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  useEffect(() => { setPage(1); }, [search, status, dateF, conduceF, cityF, customerF, invoiceF, verifiedF, specialF, minWeight, maxWeight]);
  useEffect(() => { if (pkgs.length) sel.hydrate(pkgs.map((p) => ({ id: p.id, tracking_number: p.tracking_number, customer_code: p.customer_code, customer_name: p.customer_name, weight: Number(p.weight) || 0, status: p.status, conduce_id: p.conduce_id }))); }, [pkgs, sel]);

  const livrer = async (p: Pkg) => {
    await setPackageStatus(p.id, "Livré");
    setPkgs((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: "Livré" } : x)));
  };

  const totalUsd = filtered.reduce((s, p) => s + (Number(p.total_usd) || 0), 0);
  const totalLb = filtered.reduce((s, p) => s + (Number(p.weight) || 0), 0);
  const snap = (p: Pkg) => ({ id: p.id, tracking_number: p.tracking_number, customer_code: p.customer_code, customer_name: p.customer_name, weight: Number(p.weight) || 0, status: p.status, conduce_id: p.conduce_id });
  const selectedFiltered = filtered.filter((p) => sel.has(p.id));
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => sel.has(p.id));
  const selectedFactured = selectedFiltered.filter((p) => p.status === "Facturé");
  const clearFilters = () => {
    setSearch(""); setStatus(""); setDateF(""); setConduceF(""); setCityF(""); setCustomerF("");
    setInvoiceF(""); setVerifiedF(""); setSpecialF(""); setMinWeight(""); setMaxWeight("");
  };
  const cityOptions = Array.from(new Set(Array.from(tarifMap.values()).map((info) => info.ville?.name).filter(Boolean) as string[]))
    .sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }));
  const customerOptions = Array.from(tarifMap.keys()).sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }));
  const deliverSelected = async () => {
    if (!selectedFactured.length || !confirm(`Marquer ${selectedFactured.length} colis filtré(s) comme livrés ?`)) return;
    await Promise.all(selectedFactured.map((p) => setPackageStatus(p.id, "Livré")));
    setPkgs((previous) => previous.map((p) => selectedFactured.some((selected) => selected.id === p.id) ? { ...p, status: "Livré" } : p));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="h-page">Archives</h1>
          <p className="text-sm text-mute mt-0.5">Colis facturés &amp; livrés — historique complet, jamais supprimé</p>
        </div>
        <RefreshButton onRefresh={load} />
      </div>

      <FilterConsole query={search} onQueryChange={setSearch} queryPlaceholder="Tracking, code, nom, contenu, No facture, Conduce…"
        resultCount={filtered.length} onClear={clearFilters}
        selection={{ selectedCount: selectedFiltered.length, allSelected: allFilteredSelected, onToggleAll: () => sel.setMany(filtered.map(snap), !allFilteredSelected), label: "Sélectionner les colis filtrés" }}
        fields={[
          { key: "status", label: "Statut", type: "select", value: status, onChange: setStatus, options: [{ value: "Facturé", label: "Facturé" }, { value: "Livré", label: "Livré" }] },
          { key: "city", label: "Ville", type: "select", value: cityF, onChange: setCityF, options: cityOptions },
          { key: "client", label: "Code client", type: "select", value: customerF, onChange: setCustomerF, options: customerOptions },
          { key: "conduce", label: "Conduce", type: "select", value: conduceF, onChange: setConduceF, options: conduces.map((c) => ({ value: c.id, label: `Conduce ${c.conduce_number}` })) },
          { key: "date", label: "Date", type: "text", value: dateF, onChange: setDateF, placeholder: "2026-09" },
          { key: "invoice", label: "Facture", type: "select", value: invoiceF, onChange: setInvoiceF, options: [{ value: "invoiced", label: "Facturé" }, { value: "not_invoiced", label: "Sans facture" }] },
          { key: "verified", label: "Vérification", type: "select", value: verifiedF, onChange: setVerifiedF, options: [{ value: "verified", label: "Vérifié" }, { value: "not_verified", label: "Non vérifié" }] },
          { key: "special", label: "Colis spécial", type: "select", value: specialF, onChange: setSpecialF, options: [{ value: "special", label: "Spécial" }, { value: "regular", label: "Normal" }] },
          { key: "min", label: "Poids min. (lb)", type: "number", value: minWeight, onChange: setMinWeight, min: 0, step: 0.01 },
          { key: "max", label: "Poids max. (lb)", type: "number", value: maxWeight, onChange: setMaxWeight, min: 0, step: 0.01 },
        ]} />

      {selectedFactured.length > 0 && (
        <div className="card px-3.5 py-3 flex items-center gap-3 flex-wrap bg-blue-50/60 border border-navy/10">
          <span className="text-sm font-bold text-navy">{selectedFiltered.length} colis filtré{selectedFiltered.length > 1 ? "s" : ""} sélectionné{selectedFiltered.length > 1 ? "s" : ""}</span>
          <div className="flex-1" />
          <button className="btn btn-brand !py-2 text-xs" onClick={deliverSelected}><PackageCheck size={14} /> Marquer {selectedFactured.length} livré{selectedFactured.length > 1 ? "s" : ""}</button>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-mute px-1">
        <span>{filtered.length} colis</span>
        <span>{totalLb.toFixed(2)} lb</span>
        <span className="font-semibold text-ink">{usd(totalUsd)}</span>
        <span className="ml-auto">
          Factures &amp; PDF : <Link href="/invoices" className="text-navy underline font-semibold">Factures</Link>
        </span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr>{["", "No Facture", "Code Client", "Nom", "Tracking ID (Guía)", "Conduce", "Date", "Lb", "Content", "Total (USD)", "Validation", "Status", ""]
            .map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={13} className="text-center py-10 text-mute">Aucun colis dans les archives.</td></tr>
            ) : rows.map((p, i) => {
              const inv = p.invoice_id ? invoices.get(p.invoice_id) : null;
              const special = specialPackageInfo(p);
              return (
                <tr key={p.id} className={i % 2 ? "bg-mist" : ""}>
                  <td className="td"><input type="checkbox" className="accent-emerald-600" checked={sel.has(p.id)} onChange={() => sel.toggle(snap(p))} /></td>
                  <td className="td font-bold">
                    {inv
                      ? <Link href="/invoices" className="text-navy hover:underline" title={`Facture ${inv.invoice_number} — ${dateFr(inv.created_at)}`}>{inv.invoice_number}</Link>
                      : <span className="text-mute">—</span>}
                  </td>
                  <td className="td">
                    <Link href={withReturnTo(`/clients/${encodeURIComponent(p.customer_code)}`, pathname)} className="text-navy hover:underline font-semibold">
                      {p.customer_code}
                    </Link>
                  </td>
                  <td className="td">{p.customer_name}</td>
                  <td className="td font-mono text-xs">{p.tracking_number}</td>
                  <td className="td text-xs">{p.conduce_id ? (conduceMap.get(p.conduce_id) ?? "—") : "—"}</td>
                  <td className="td">{p.created_date}</td>
                  <td className="td">{p.weight}</td>
                  <td className="td max-w-[190px]" title={special.isSpecial ? `${p.content}\nRaison : ${special.reason}` : p.content}>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1">
                        {special.isSpecial && <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">* Spécial</span>}
                        <span className="truncate">{p.content}</span>
                      </div>
                      {special.isSpecial && <p className="truncate text-[10px] text-amber-800" title={special.reason}>Raison : {special.reason}</p>}
                    </div>
                  </td>
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
