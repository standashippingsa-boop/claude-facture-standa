"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, ClipboardList, FileText, Lock, PackageCheck, Pencil, Trash2 } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import Pagination from "@/components/Pagination";
import {
  ClientTarifInfo, deletePackage, getClient, getClientTarifMap,
  getPackages, getSettings, getUsdRate, saveTrackingManual, setPackagesStatus,
  logAction, updatePackagePrice
} from "@/lib/db";
import { computePrice, round2 } from "@/lib/pricing";
import { computeInvoice, InvoiceComputation, verifyTotal } from "@/lib/invoice-engine";
import { Client, INTERNAL_STATUSES, Pkg } from "@/lib/types";
import { htg, parseMcpackDate, usd } from "@/lib/utils";
import { generateBonRemise } from "@/lib/bonremise";
import { exportPackagesPdf } from "@/lib/listpdf";
import InvoiceDialog from "@/components/InvoiceDialog";
import { useRole } from "@/lib/authx";

const PER_PAGE = 25;

export default function PackagesPage() {
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [tarifMap, setTarifMap] = useState<Map<string, ClientTarifInfo>>(new Map());
  const [rate, setRate] = useState(0);
  const [bulkStatus, setBulkStatus] = useState("");
  const [footer, setFooter] = useState("Mèsi paske ou fè STANDA COMMERCIAL konfyans.");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateF, setDateF] = useState("");
  const [page, setPage] = useState(1);
  const [busy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { role } = useRole();
  // Opsyon fakti — chak toggle endepandan (admin chwazi pou CHAK fakti)

  const load = async () => {
    const [p, tm, r, s] = await Promise.all([
      getPackages(), getClientTarifMap(), getUsdRate(), getSettings()
    ]);
    setPkgs(p.map((x) => ({ ...x, selected: false })));
    setTarifMap(tm);
    setRate(r);
    if (s.invoice_footer) setFooter(s.invoice_footer);
  };
  useEffect(() => { load().catch((e) => setNotice("Erè bazdone: " + e.message)); }, []);

  /** Lis statut ki egziste toutbon (pou filtre a) — san Livré, ki rete nan Historique */
  const statusOptions = useMemo(() => {
    const set = new Set<string>(INTERNAL_STATUSES.filter((s) => s !== "Livré"));
    pkgs.filter((p) => p.status !== "Livré").forEach((p) => set.add(p.status));
    set.add("Facturé");
    return Array.from(set);
  }, [pkgs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pkgs
      // Koli livré yo pa parèt isit la — yo rete nan Historique (anyen pa efase)
      // V8.5: koli Facturé yo kite lis aktif la — yo nan Historique
      .filter((p) => p.status !== "Livré" && p.status !== "Facturé")
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

  /**
   * Admin SÈLMAN: mete menm statut la sou tout koli ki make yo.
   * "Reçu à Miami" ak "Disponible" voye yon email otomatik bay chak kliyan konsène
   * (si kliyan an gen imèl epi RESEND_API_KEY konfigire nan Vercel).
   */
  const appliquerStatut = async () => {
    if (!bulkStatus || !selectedAll.length) return;
    const targets = selectedAll.filter((p) => p.status !== "Facturé");
    if (!targets.length) { setNotice("Koli Facturé yo pa ka chanje statut isit la."); return; }
    try {
      await setPackagesStatus(targets.map((p) => p.id), bulkStatus);
      await logAction("Changement Statut", `${targets.length} colis → ${bulkStatus}`, "", targets[0]?.customer_code ?? "");
      setPkgs((prev) => prev.map((p) =>
        targets.some((t) => t.id === p.id) ? { ...p, status: bulkStatus, selected: false } : p));

      let mailInfo = "";
      if (bulkStatus === "Reçu à Miami" || bulkStatus === "Disponible") {
        const type = bulkStatus === "Reçu à Miami" ? "recu_miami" : "disponible";
        const byClient = new Map<string, Pkg[]>();
        targets.forEach((p) => {
          const arr = byClient.get(p.customer_code) ?? [];
          arr.push(p); byClient.set(p.customer_code, arr);
        });
        let sent = 0, noEmail = 0;
        const problems: string[] = [];
        for (const [code, list] of Array.from(byClient.entries())) {
          const info = tarifMap.get(code);
          if (!info?.email) { noEmail++; continue; }
          try {
            const res = await fetch("/api/notify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type,
                client: { name: info.fullname || list[0].customer_name, code, ville: info.ville?.name ?? "", email: info.email },
                packages: list.map((p) => ({
                  tracking_number: p.tracking_number,
                  tracking_manual: p.tracking_manual,
                  content: p.content,
                  weight: p.weight,
                  fournisseur: p.mcpack_data?.["Proveedor"] ?? p.mcpack_data?.["proveedor"] ?? ""
                }))
              })
            });
            const j = await res.json();
            if (j.ok) sent++;
            else problems.push(`${code}: ${j.reason ?? j.error ?? "erè enkoni"}`);
          } catch (err: any) { problems.push(`${code}: ${err?.message ?? "erè rezo"}`); }
        }
        mailInfo = ` Email: ${sent} voye${noEmail ? `, ${noEmail} kliyan san imèl` : ""}.` +
          (problems.length ? ` ⚠️ ${problems.slice(0, 2).join(" | ").slice(0, 300)}` : "");
      }
      setNotice(`Statut "${bulkStatus}" appliqué sur ${targets.length} colis.` + mailInfo);
      setBulkStatus("");
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
      const r = info ? computePrice(p.weight, info.account_type, info.ville) : null;
      if (r) { await savePrice(p, r.price, 0); n++; } else sans++;
    }
    setNotice(
      `Tarification appliquée sur ${n} colis${selected.length ? " sélectionnés" : " disponibles"}.` +
      (sans ? ` ${sans} colis ignoré(s): kliyan san vil aktif oswa ki pa nan bazdone a.` : "")
    );
  };

  /** Ouvri fenèt fakti pataje a (menm workflow ak tout lòt paj). */
  const [invClient, setInvClient] = useState<Client | null>(null);

  const ouvriFacture = async () => {
    if (!selected.length) return;
    const code = selected[0].customer_code;
    if (!selected.every((p) => p.customer_code === code)) {
      setNotice("Tout koli ki make yo dwe pou menm kliyan an."); return;
    }
    const client = await getClient(code);
    if (!client) { setNotice(`Client "${code}" pa nan bazdone a.`); return; }
    setInvClient(client);
  };

  const remove = async (p: Pkg) => {
    if (!confirm(`Efase colis ${p.tracking_number}?`)) return;
    await deletePackage(p.id);
    setPkgs((prev) => prev.filter((x) => x.id !== p.id));
  };

  /** Koreksyon Tracking Number — ADMIN sèlman, ak audit log (pwen #3) */
  const correctTracking = async (p: Pkg) => {
    const nv = window.prompt(
      `Correction Tracking Number — ${p.tracking_number}\n` +
      `Ancien: ${p.tracking_manual}\n\n` +
      `⚠️ Cette correction sera enregistrée dans l'audit.\n\nNouveau Tracking Number:`,
      p.tracking_manual
    );
    if (nv === null) return;
    const v = nv.trim();
    if (!v || v === p.tracking_manual) return;
    try {
      await saveTrackingManual(p.id, v);
      await logAction("Correction Tracking Number",
        `${p.tracking_manual} → ${v}`, p.tracking_number, p.customer_code);
      setPkgs((prev) => prev.map((x) => x.id === p.id ? { ...x, tracking_manual: v } : x));
      setNotice("Tracking Number corrigé (enregistré dans l'audit).");
    } catch (er: any) { setNotice("Erè koreksyon: " + er.message); }
  };

  const tp = selected.reduce((s, p) => s + p.price_usd, 0);
  const tt = selected.reduce((s, p) => s + p.tax_usd, 0);
  const allChecked = pageRows.length > 0 && pageRows.every((p) => p.selected);


  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="h-page">Packages</h1>
          <p className="text-sm text-mute mt-0.5">Gestion des colis — statuts, tarification & facturation</p>
        </div>
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

      <div className="flex items-center gap-4 text-xs text-mute px-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" /> 🟢 Reçu chez MCPACK</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-line inline-block" /> ⚪ En attente de réception</span>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr>
            <th className="thc"><input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} /></th>
            {["Code", "Nom Client", "Ville", "Tracking ID (Guía)", "Tracking Number", "Lb", "Content", "Price $", "Total $", "Total HTG", "Status", ""]
              .map((h) => <th key={h} className="thc">{h}</th>)}
          </tr></thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={13} className="text-center py-10 text-mute">
                Aucun colis. Utilisez <a href="/sync" className="text-navy underline font-semibold">Synchronisation MCPACK</a>.
              </td></tr>
            ) : pageRows.map((p, i) => (
              <tr key={p.id} className={`${p.received_at ? "!bg-emerald-50" : i % 2 ? "bg-mist" : ""} ${p.selected ? "!bg-blue-50" : ""}`}
                title={p.received_at ? `Reçu chez MCPACK — ${p.received_method}` : "En attente de réception"}>
                <td className="tdc">
                  <input type="checkbox" checked={!!p.selected} onChange={() => toggle(p.id)} />
                </td>
                <td className="tdc font-bold whitespace-nowrap">
                  <Link href={`/clients/${encodeURIComponent(p.customer_code)}`}
                    className="text-navy hover:underline" title="Ouvri dosye kliyan an">
                    {p.customer_code}
                  </Link>
                </td>
                <td className="tdc max-w-[110px] truncate" title={p.customer_name}>
                  <Link href={`/clients/${encodeURIComponent(p.customer_code)}`}
                    className="hover:text-navy hover:underline">
                    {p.customer_name}
                  </Link>
                </td>
                <td className="tdc max-w-[80px] truncate" title={tarifMap.get(p.customer_code)?.ville?.name ?? ""}>
                  {tarifMap.get(p.customer_code)?.ville?.name ?? <span className="text-amber-600">—</span>}
                </td>
                <td className="tdc font-mono text-[11px] whitespace-nowrap">{p.tracking_number}</td>
                <td className="tdc">
                  {!p.tracking_manual ? (
                    // Vid: pèmèt premye antre (yon sèl fwa)
                    <input type="text" defaultValue=""
                      placeholder="—" title="Tracking Number — antre yon sèl fwa (apre l ap fèmen)"
                      className="input !w-24 !py-0.5 !px-1 !text-[11px] font-mono"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (!v) return;
                        saveTrackingManual(p.id, v).then(() => {
                          logAction("Ajout Tracking Number", `${p.tracking_number} → ${v}`, p.tracking_number, p.customer_code);
                          setPkgs((prev) => prev.map((x) => x.id === p.id ? { ...x, tracking_manual: v } : x));
                        }).catch((er: any) => setNotice("Erè tracking: " + er.message));
                      }} />
                  ) : (
                    // Genyen valè: fèmen (read-only) — admin ka korije ak audit
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] whitespace-nowrap"
                      title="Tracking Number verrouillé (donnée critique)">
                      <Lock size={10} className="text-slate-400 shrink-0" />
                      {p.tracking_manual}
                      {role === "admin" && (
                        <button className="text-slate-400 hover:text-navy ml-0.5 shrink-0"
                          title="Correction (admin) — enregistrée dans l'audit"
                          onClick={() => correctTracking(p)}>
                          <Pencil size={11} />
                        </button>
                      )}
                    </span>
                  )}
                </td>
                <td className="tdc text-right">{p.weight}</td>
                <td className="tdc max-w-[90px] truncate" title={p.content}>{p.content}</td>
                <td className="tdc text-right">{usd(p.price_usd)}</td>
                <td className="tdc text-right font-semibold whitespace-nowrap">{usd(p.total_usd)}</td>
                <td className="tdc text-right text-[11px] text-slate-500 whitespace-nowrap">{htg(p.total_htg)}</td>
                <td className="tdc"><StatusBadge status={p.status} /></td>
                <td className="tdc whitespace-nowrap">
                  {p.status !== "Disponible" && p.status !== "Facturé" && (
                    <button className="text-emerald-600 hover:text-emerald-800 mr-1"
                      title="Marquer Disponible (san email — sèvi ak seleksyon an pou voye email)"
                      onClick={() => { setPackagesStatus([p.id], "Disponible").then(() => setPkgs((prev) =>
                        prev.map((x) => x.id === p.id ? { ...x, status: "Disponible" } : x))); }}>
                      <PackageCheck size={14} />
                    </button>
                  )}
                  {role === "admin" && (
                    <button className="text-slate-400 hover:text-red-600" onClick={() => remove(p)}><Trash2 size={14} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} pages={pages} onPage={setPage} />
      </div>

      <div className="card p-4 flex flex-col md:flex-row md:items-center gap-4 sticky bottom-3">
        <div className="flex gap-6 flex-1 flex-wrap">
          <div><p className="text-xs text-mute">Sélection ({selected.length} colis)</p>
            <p className="text-lg font-bold text-navy">{usd(tp)}</p></div>
          <div><p className="text-xs text-mute">Tax</p>
            <p className="text-lg font-bold text-navy">{usd(tt)}</p></div>
          <div className="bg-navy rounded-lg px-4 py-1.5">
            <p className="text-xs text-white/70">Total USD</p>
            <p className="text-xl font-bold text-white">{usd(tp + tt)}</p></div>
          <div className="bg-navy/90 rounded-lg px-4 py-1.5">
            <p className="text-xs text-white/70">Total HTG (taux {rate.toFixed(2)})</p>
            <p className="text-xl font-bold text-white">{htg((tp + tt) * rate)}</p></div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {selectedAll.length > 0 && (
            <>
              <select className="input !w-44 !py-2" value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}>
                <option value="">— Statut... —</option>
                {INTERNAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button className="btn !bg-emerald-600 hover:!bg-emerald-700"
                onClick={appliquerStatut} disabled={busy || !bulkStatus}>
                <PackageCheck size={15} /> Appliquer ({selectedAll.length})
              </button>
            </>
          )}
          <button className="btn btn-ghost border border-line" onClick={bonRemise}
            disabled={busy || !selectedAll.length} title="Lis koli pou ajan transpò yo">
            <ClipboardList size={15} /> Créer Bon de Remise{selectedAll.length ? ` (${selectedAll.length})` : ""}
          </button>
          <button className="btn btn-ghost border border-line"
            onClick={() => exportPackagesPdf(selectedAll.length ? selectedAll : filtered, tarifMap,
              selectedAll.length ? "Colis sélectionnés" : "Liste des colis")}
            title="Exporter la liste en PDF">
            <FileText size={15} /> Exporter PDF
          </button>
          <button className="btn btn-ghost border border-line" onClick={applyTarif} disabled={busy}>
            <Calculator size={15} /> Appliquer tarification
          </button>
          <button className="btn" onClick={ouvriFacture} disabled={busy || !selected.length}>
            <FileText size={15} /> Générer Facture
          </button>
        </div>
      </div>

      {/* ===== Fenèt konfimasyon Facture (opsyon pa fakti) ===== */}
      {invClient && (
        <InvoiceDialog
          client={invClient}
          pkgs={selected}
          footer={footer}
          onClose={() => setInvClient(null)}
          onDone={(msg) => { setNotice(msg); load(); }}
        />
      )}

      {notice && <p className="card px-4 py-3 text-sm text-navy">{notice}</p>}
    </div>
  );
}
