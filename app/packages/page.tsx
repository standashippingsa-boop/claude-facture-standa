"use client";
import { useEffect, useMemo, useState } from "react";
import { Calculator, ClipboardList, FileText, PackageCheck, Trash2, X } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import Pagination from "@/components/Pagination";
import {
  ClientTarifInfo, createInvoice, deletePackage, getClient, getClientTarifMap,
  getPackages, getSettings, getSmallParcelPrice, getUsdRate, markDisponible,
  saveInvoicePdfUrl, updatePackagePrice
} from "@/lib/db";
import { computePrice, round2 } from "@/lib/pricing";
import { generateUploadDownload } from "@/lib/pdf";
import { sendInvoicePdfWhatsApp } from "@/lib/whatsapp";
import { Pkg } from "@/lib/types";
import { htg, parseMcpackDate, usd } from "@/lib/utils";
import { generateBonRemise } from "@/lib/bonremise";

const PER_PAGE = 25;

interface Simulation {
  clientName: string;
  clientCode: string;
  count: number;
  weight: number;
  subtotal: number;
  tax: number;
  totalUsd: number;
  rate: number;
  totalHtg: number;
}

export default function PackagesPage() {
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [tarifMap, setTarifMap] = useState<Map<string, ClientTarifInfo>>(new Map());
  const [rate, setRate] = useState(0);
  const [smallPrice, setSmallPrice] = useState(3.7);
  const [footer, setFooter] = useState("Mèsi paske ou fè STANDA COMMERCIAL konfyans.");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateF, setDateF] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sim, setSim] = useState<Simulation | null>(null);

  const load = async () => {
    const [p, tm, r, sp, s] = await Promise.all([
      getPackages(), getClientTarifMap(), getUsdRate(), getSmallParcelPrice(), getSettings()
    ]);
    setPkgs(p.map((x) => ({ ...x, selected: false })));
    setTarifMap(tm);
    setRate(r);
    setSmallPrice(sp);
    if (s.invoice_footer) setFooter(s.invoice_footer);
  };
  useEffect(() => { load().catch((e) => setNotice("Erè bazdone: " + e.message)); }, []);

  /** Lis statut ki egziste toutbon (pou filtre a) — san Livré, ki rete nan Historique */
  const statusOptions = useMemo(() => {
    const set = new Set(pkgs.filter((p) => p.status !== "Livré").map((p) => p.status));
    set.add("Disponible");
    return Array.from(set).sort();
  }, [pkgs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pkgs
      // Koli livré yo pa parèt isit la — yo rete nan Historique (anyen pa efase)
      .filter((p) => p.status !== "Livré")
      .filter((p) => {
        if (status && p.status !== status) return false;
        if (dateF && !p.created_date.includes(dateF)) return false;
        if (!q) return true;
        // Rechèch avanse an tan reyèl: tracking, kòd, non, telefòn kliyan, vil kliyan
        const info = tarifMap.get(p.customer_code);
        return p.tracking_number.toLowerCase().includes(q)
          || p.customer_code.toLowerCase().includes(q)
          || p.customer_name.toLowerCase().includes(q)
          || (info?.fullname ?? "").toLowerCase().includes(q)
          || (info?.phone ?? "").toLowerCase().includes(q)
          || (info?.ville?.name ?? "").toLowerCase().includes(q);
      })
      // Tri otomatik: koli ki fèk rive yo anlè, pi ansyen yo anba —
      // rete konsa apre chak import MCPACK
      .slice()
      .sort((a, b) => parseMcpackDate(b.created_date) - parseMcpackDate(a.created_date));
  }, [pkgs, search, status, dateF, tarifMap]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  useEffect(() => { setPage(1); }, [search, status, dateF]);

  const selectedAll = filtered.filter((p) => p.selected);                       // Bon de Remise / Marquer Disponible
  const selected = selectedAll.filter((p) => p.status === "Disponible");        // Facturation (san chanjman)
  const toggle = (id: string) =>
    setPkgs((prev) => prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  const toggleAll = (checked: boolean) => {
    const ids = new Set(pageRows.map((p) => p.id));
    setPkgs((prev) => prev.map((p) => (ids.has(p.id) ? { ...p, selected: checked } : p)));
  };

  /** Admin: koli yo rive depo STANDA — pase yo "Disponible" (sèl statut ki pa MCPACK) */
  const marquerDisponible = async () => {
    const targets = selectedAll.filter((p) => p.status !== "Disponible" && p.status !== "Facturé");
    if (!targets.length) return;
    try {
      await markDisponible(targets.map((p) => p.id));
      setPkgs((prev) => prev.map((p) =>
        targets.some((t) => t.id === p.id) ? { ...p, status: "Disponible", selected: false } : p));
      setNotice(`${targets.length} colis marqué(s) Disponible.`);
    } catch (e: any) { setNotice("Erè: " + e.message); }
  };

  /** Bon de remise: lis koli w ap voye bay ajan yo nan lòt vil */
  const bonRemise = async () => {
    if (!selectedAll.length) return;
    try {
      await generateBonRemise(selectedAll, tarifMap);
      setNotice(`Bon de remise créé (${selectedAll.length} colis) — PDF telechaje.`);
    } catch (e: any) { setNotice("Erè: " + e.message); }
  };

  /** Modifikasyon manyèl: chanje fakti aktyèl la sèlman, PA tarif Paramètres yo */
  const savePrice = async (p: Pkg, priceUsd: number, taxUsd: number) => {
    setPkgs((prev) => prev.map((x) => (x.id === p.id ? {
      ...x, price_usd: priceUsd, tax_usd: taxUsd, total_usd: round2(priceUsd + taxUsd),
      price_htg: round2(priceUsd * rate), tax_htg: round2(taxUsd * rate),
      total_htg: round2((priceUsd + taxUsd) * rate)
    } : x)));
    try { await updatePackagePrice(p.id, priceUsd, taxUsd, rate); }
    catch (e: any) { setNotice("Erè sauvegarde prix: " + e.message); }
  };

  const applyTarif = async () => {
    const targets = selected.length ? selected : filtered.filter((p) => p.status === "Disponible");
    let n = 0, sans = 0;
    for (const p of targets) {
      const info = tarifMap.get(p.customer_code);
      const r = info ? computePrice(p.weight, info.account_type, info.ville, smallPrice) : null;
      if (r) { await savePrice(p, r.price, r.tax); n++; } else sans++;
    }
    setNotice(
      `Tarification appliquée sur ${n} colis${selected.length ? " sélectionnés" : " disponibles"}.` +
      (sans ? ` ${sans} colis ignoré(s): kliyan san vil aktif oswa ki pa nan bazdone a.` : "")
    );
  };

  /** Etap 1: Simulation Facture — preview anvan jenerasyon final la */
  const simuler = () => {
    if (!selected.length) return;
    const code = selected[0].customer_code;
    if (!selected.every((p) => p.customer_code === code)) {
      setNotice("Tout koli ki make yo dwe pou menm kliyan an."); return;
    }
    const subtotal = round2(selected.reduce((s, p) => s + p.price_usd, 0));
    const tax = round2(selected.reduce((s, p) => s + p.tax_usd, 0));
    const totalUsd = round2(subtotal + tax);
    setSim({
      clientName: selected[0].customer_name,
      clientCode: code,
      count: selected.length,
      weight: round2(selected.reduce((s, p) => s + p.weight, 0)),
      subtotal, tax, totalUsd, rate,
      totalHtg: round2(totalUsd * rate)
    });
  };

  /** Etap 2: konfimasyon -> kreye fakti a toutbon */
  const generer = async () => {
    if (!selected.length || !sim) return;
    const code = selected[0].customer_code;
    const client = await getClient(code);
    if (!client) { setNotice(`Client "${code}" pa nan bazdone a. Kreye l nan meni Clients.`); setSim(null); return; }
    setBusy(true);
    try {
      const inv = await createInvoice(client, selected, rate);
      const items = selected.map((p) => ({
        invoice_id: inv.id, tracking_number: p.tracking_number,
        weight: p.weight, content: p.content, price: p.price_usd, tax: p.tax_usd,
        total: round2(p.price_usd + p.tax_usd)
      }));
      const pdf = await generateUploadDownload(inv, items, footer, { download: true });
      if (pdf.url) { await saveInvoicePdfUrl(inv.id, pdf.url); inv.pdf_url = pdf.url; }
      const how = await sendInvoicePdfWhatsApp(inv, pdf.blob, pdf.filename);
      setNotice(
        `Facture ${inv.invoice_number} créée (${items.length} colis → Facturé, taux ${rate.toFixed(2)}). ` +
        (how === "file" ? "PDF la pataje dirèkteman sou WhatsApp."
          : how === "link" ? "WhatsApp ouvri ak lyen PDF la — peze Send sèlman."
          : "Pataj la anile — fakti a nan Invoices, ou ka revoye l nenpòt lè.")
      );
      setSim(null);
      await load();
    } catch (e: any) {
      setNotice("Erè: " + e.message);
    } finally { setBusy(false); }
  };

  const remove = async (p: Pkg) => {
    if (!confirm(`Efase colis ${p.tracking_number}?`)) return;
    await deletePackage(p.id);
    setPkgs((prev) => prev.filter((x) => x.id !== p.id));
  };

  const tp = selected.reduce((s, p) => s + p.price_usd, 0);
  const tt = selected.reduce((s, p) => s + p.tax_usd, 0);
  const allChecked = pageRows.length > 0 && pageRows.every((p) => p.selected);
  const nbAMarquer = selectedAll.filter((p) => p.status !== "Disponible" && p.status !== "Facturé").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-extrabold text-navy">Packages</h1>
        <div className="flex gap-2 flex-wrap">
          <input className="input w-72" placeholder="Tracking, code, nom, telefòn, vil..." value={search}
            onChange={(e) => setSearch(e.target.value)} />
          <input className="input w-36" placeholder="Date (2026.07)" value={dateF}
            onChange={(e) => setDateF(e.target.value)} />
          <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous statuts</option>
            {statusOptions.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr>
            <th className="thc"><input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} /></th>
            {["Code", "Nom Client", "Ville", "Tracking ID (Guía)", "Date", "Lb", "Content", "Price $", "Tax $", "Total $", "Total HTG", "Status", ""]
              .map((h) => <th key={h} className="thc">{h}</th>)}
          </tr></thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={14} className="text-center py-10 text-slate-400">
                Aucun colis. Utilisez <a href="/sync" className="text-navy underline font-semibold">Synchronisation MCPACK</a>.
              </td></tr>
            ) : pageRows.map((p, i) => (
              <tr key={p.id} className={`${i % 2 ? "bg-mist" : ""} ${p.selected ? "!bg-blue-50" : ""}`}>
                <td className="tdc">
                  <input type="checkbox" checked={!!p.selected} onChange={() => toggle(p.id)} />
                </td>
                <td className="tdc font-bold text-navy whitespace-nowrap">{p.customer_code}</td>
                <td className="tdc max-w-[110px] truncate" title={p.customer_name}>{p.customer_name}</td>
                <td className="tdc max-w-[80px] truncate" title={tarifMap.get(p.customer_code)?.ville?.name ?? ""}>
                  {tarifMap.get(p.customer_code)?.ville?.name ?? <span className="text-amber-600">—</span>}
                </td>
                <td className="tdc font-mono text-[11px] whitespace-nowrap">{p.tracking_number}</td>
                <td className="tdc whitespace-nowrap">{p.created_date}</td>
                <td className="tdc text-right">{p.weight}</td>
                <td className="tdc max-w-[90px] truncate" title={p.content}>{p.content}</td>
                <td className="tdc">
                  <input type="number" step="0.01" defaultValue={p.price_usd} disabled={p.status !== "Disponible"}
                    className="input !w-16 !py-0.5 !px-1 !text-xs text-right"
                    onBlur={(e) => savePrice(p, Number(e.target.value), p.tax_usd)} />
                </td>
                <td className="tdc">
                  <input type="number" step="0.01" defaultValue={p.tax_usd} disabled={p.status !== "Disponible"}
                    className="input !w-14 !py-0.5 !px-1 !text-xs text-right"
                    onBlur={(e) => savePrice(p, p.price_usd, Number(e.target.value))} />
                </td>
                <td className="tdc text-right font-semibold whitespace-nowrap">{usd(p.total_usd)}</td>
                <td className="tdc text-right text-[11px] text-slate-500 whitespace-nowrap">{htg(p.total_htg)}</td>
                <td className="tdc"><StatusBadge status={p.status} /></td>
                <td className="tdc whitespace-nowrap">
                  {p.status !== "Disponible" && p.status !== "Facturé" && (
                    <button className="text-emerald-600 hover:text-emerald-800 mr-1"
                      title="Koli a rive depo — Marquer Disponible"
                      onClick={() => { markDisponible([p.id]).then(() => setPkgs((prev) =>
                        prev.map((x) => x.id === p.id ? { ...x, status: "Disponible" } : x))); }}>
                      <PackageCheck size={14} />
                    </button>
                  )}
                  <button className="text-slate-400 hover:text-red-600" onClick={() => remove(p)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} pages={pages} onPage={setPage} />
      </div>

      <div className="card p-4 flex flex-col md:flex-row md:items-center gap-4 sticky bottom-3">
        <div className="flex gap-6 flex-1 flex-wrap">
          <div><p className="text-xs text-slate-500">Sélection ({selected.length} colis)</p>
            <p className="text-lg font-bold text-navy">{usd(tp)}</p></div>
          <div><p className="text-xs text-slate-500">Tax</p>
            <p className="text-lg font-bold text-navy">{usd(tt)}</p></div>
          <div className="bg-navy rounded-lg px-4 py-1.5">
            <p className="text-xs text-white/70">Total USD</p>
            <p className="text-xl font-bold text-white">{usd(tp + tt)}</p></div>
          <div className="bg-navy/90 rounded-lg px-4 py-1.5">
            <p className="text-xs text-white/70">Total HTG (taux {rate.toFixed(2)})</p>
            <p className="text-xl font-bold text-white">{htg((tp + tt) * rate)}</p></div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {nbAMarquer > 0 && (
            <button className="btn !bg-emerald-600 hover:!bg-emerald-700" onClick={marquerDisponible} disabled={busy}>
              <PackageCheck size={15} /> Marquer Disponible ({nbAMarquer})
            </button>
          )}
          <button className="btn btn-ghost border border-line" onClick={bonRemise}
            disabled={busy || !selectedAll.length} title="Lis koli pou ajan transpò yo">
            <ClipboardList size={15} /> Créer Bon de Remise{selectedAll.length ? ` (${selectedAll.length})` : ""}
          </button>
          <button className="btn btn-ghost border border-line" onClick={applyTarif} disabled={busy}>
            <Calculator size={15} /> Appliquer tarification
          </button>
          <button className="btn" onClick={simuler} disabled={busy || !selected.length}>
            <FileText size={15} /> Générer Facture
          </button>
        </div>
      </div>

      {/* ===== Simulation Facture ===== */}
      {sim && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => !busy && setSim(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-navy">Simulation Facture</h2>
              <button className="text-slate-400 hover:text-slate-600" onClick={() => setSim(null)} disabled={busy}>
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              <b className="text-navy">{sim.clientCode}</b> — {sim.clientName}
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Nombre de colis</span><b>{sim.count}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Poids total</span><b>{sim.weight.toFixed(2)} LB</b></div>
              <div className="border-t border-line my-2" />
              <div className="flex justify-between"><span className="text-slate-500">Sous-total</span><b>{usd(sim.subtotal)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Tax</span><b>{usd(sim.tax)}</b></div>
              <div className="flex justify-between text-navy"><span className="font-semibold">Grand Total USD</span><b>{usd(sim.totalUsd)}</b></div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Taux utilisé</span><span>1 USD = {sim.rate.toFixed(2)} HTG</span>
              </div>
              <div className="flex justify-between items-center bg-navy text-white rounded-lg px-3 py-2 mt-2">
                <span className="font-semibold">Grand Total HTG</span>
                <b className="text-lg">{htg(sim.totalHtg)}</b>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button className="btn flex-1" onClick={generer} disabled={busy}>
                {busy ? "Génération..." : "Confirmer & Générer PDF"}
              </button>
              <button className="btn btn-ghost border border-line" onClick={() => setSim(null)} disabled={busy}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && <p className="card px-4 py-3 text-sm text-navy">{notice}</p>}
    </div>
  );
}
