"use client";
import { useEffect, useMemo, useState } from "react";
import { Calculator, ClipboardList, FileText, PackageCheck, Trash2, X } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import Pagination from "@/components/Pagination";
import {
  ClientTarifInfo, createInvoiceFromComputation, deletePackage, getClient, getClientTarifMap,
  getPackages, getSettings, getUsdRate, saveTrackingManual, setPackagesStatus,
  getSmallParcelConfig, logAction, saveInvoicePdfUrl, updatePackagePrice
} from "@/lib/db";
import { computePrice, round2 } from "@/lib/pricing";
import { computeInvoice, InvoiceComputation, verifyTotal } from "@/lib/invoice-engine";
import { generateUploadDownload } from "@/lib/pdf";
import { sendInvoicePdfWhatsApp } from "@/lib/whatsapp";
import { Client, INTERNAL_STATUSES, Pkg } from "@/lib/types";
import { htg, parseMcpackDate, usd } from "@/lib/utils";
import { generateBonRemise } from "@/lib/bonremise";
import { exportPackagesPdf } from "@/lib/listpdf";
import { useRole } from "@/lib/authx";

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
  const [bulkStatus, setBulkStatus] = useState("");
  const [footer, setFooter] = useState("Mèsi paske ou fè STANDA COMMERCIAL konfyans.");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateF, setDateF] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { role } = useRole();
  const [sim, setSim] = useState<Simulation | null>(null);
  // Opsyon fakti — chak toggle endepandan (admin chwazi pou CHAK fakti)
  const [useTaxe, setUseTaxe] = useState(false);
  const [taxeVal, setTaxeVal] = useState("");
  const [useDga, setUseDga] = useState(false);
  const [fraisDga, setFraisDga] = useState("");
  const [useDisc, setUseDisc] = useState(false);
  const [discount, setDiscount] = useState("");
  const [calcMode, setCalcMode] = useState<"addition" | "small_control">("addition");
  const [smallCfg, setSmallCfg] = useState({ min: 0.1, max: 0.99, price: 3.7 });
  const [comp, setComp] = useState<InvoiceComputation | null>(null);

  const load = async () => {
    const [p, tm, r, s, cfg] = await Promise.all([
      getPackages(), getClientTarifMap(), getUsdRate(), getSettings(), getSmallParcelConfig()
    ]);
    setSmallCfg(cfg);
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

  /** Etap 1: Simulation Facture — preview anvan jenerasyon final la */
  const [simClient, setSimClient] = useState<Client | null>(null);

  const simuler = async () => {
    if (!selected.length) return;
    const code = selected[0].customer_code;
    if (!selected.every((p) => p.customer_code === code)) {
      setNotice("Tout koli ki make yo dwe pou menm kliyan an."); return;
    }
    // Chaje kliyan konplè (ak vil li — sous pri/lb la)
    const client = await getClient(code);
    if (!client) { setNotice(`Client "${code}" pa nan bazdone a.`); return; }
    setSimClient(client);
    setUseTaxe(false); setTaxeVal(""); setUseDga(false); setFraisDga("");
    setUseDisc(false); setDiscount(""); setCalcMode("addition");
    setSim({
      clientName: selected[0].customer_name, clientCode: code,
      count: selected.length,
      weight: round2(selected.reduce((s, p) => s + p.weight, 0)),
      subtotal: 0, tax: 0, totalUsd: 0, rate, totalHtg: 0
    });
  };

  /** Etap 2: konfimasyon -> kreye fakti a toutbon */
  const generer = async () => {
    if (!selected.length || !sim || !simClient) return;
    if (!comp) { setNotice("Calcul indisponible."); return; }
    // BLOKE si validasyon moteur la echwe
    if (!comp.ok) { setNotice("❌ " + comp.errors.join(" ")); return; }
    if (!verifyTotal(comp)) { setNotice("❌ Erreur de calcul détectée. Facture bloquée."); return; }
    const code = simClient.customer_code;
    setBusy(true);
    try {
      const inv = await createInvoiceFromComputation(simClient, comp, rate, calcMode);
      // Items pou PDF — soti DIRÈK nan moteur la (menm montan)
      const items = comp.lines.map((l) => ({
        invoice_id: inv.id, tracking_number: l.pkg.tracking_number,
        tracking_manual: l.pkg.tracking_manual ?? "",
        weight: l.weight, content: l.pkg.content, price: l.amount, tax: 0, total: l.amount,
        is_small: l.isSmall, per_lb: l.perLb
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

  /** Rekalkile ak MOTEUR FINANCIER chak fwa opsyon yo chanje. */
  useEffect(() => {
    if (!sim || !simClient || !selected.length) { setComp(null); return; }
    const c = computeInvoice({
      client: simClient, pkgs: selected, rate, smallCfg, mode: calcMode,
      taxeFixe: useTaxe ? Number(taxeVal) || 0 : 0,
      fraisDga: useDga ? Number(fraisDga) || 0 : 0,
      discount: useDisc ? Number(discount) || 0 : 0
    });
    setComp(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim, simClient, calcMode, useTaxe, taxeVal, useDga, fraisDga, useDisc, discount, rate]);

  const simSubtotal = comp?.subtotal ?? 0;
  const simTotal = comp?.totalUsd ?? 0;

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

      <div className="flex items-center gap-4 text-xs text-slate-500 px-1">
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
              <tr><td colSpan={13} className="text-center py-10 text-slate-400">
                Aucun colis. Utilisez <a href="/sync" className="text-navy underline font-semibold">Synchronisation MCPACK</a>.
              </td></tr>
            ) : pageRows.map((p, i) => (
              <tr key={p.id} className={`${p.received_at ? "!bg-emerald-50" : i % 2 ? "bg-mist" : ""} ${p.selected ? "!bg-blue-50" : ""}`}
                title={p.received_at ? `Reçu chez MCPACK — ${p.received_method}` : "En attente de réception"}>
                <td className="tdc">
                  <input type="checkbox" checked={!!p.selected} onChange={() => toggle(p.id)} />
                </td>
                <td className="tdc font-bold text-navy whitespace-nowrap">{p.customer_code}</td>
                <td className="tdc max-w-[110px] truncate" title={p.customer_name}>{p.customer_name}</td>
                <td className="tdc max-w-[80px] truncate" title={tarifMap.get(p.customer_code)?.ville?.name ?? ""}>
                  {tarifMap.get(p.customer_code)?.ville?.name ?? <span className="text-amber-600">—</span>}
                </td>
                <td className="tdc font-mono text-[11px] whitespace-nowrap">{p.tracking_number}</td>
                <td className="tdc">
                  <input type="text" defaultValue={p.tracking_manual}
                    placeholder="—" title="Tracking Number (transpòtè) — sync pa janm efase l"
                    className="input !w-24 !py-0.5 !px-1 !text-[11px] font-mono"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v === (p.tracking_manual ?? "")) return;
                      saveTrackingManual(p.id, v).then(() =>
                        setPkgs((prev) => prev.map((x) => x.id === p.id ? { ...x, tracking_manual: v } : x))
                      ).catch((er: any) => setNotice("Erè tracking: " + er.message));
                    }} />
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
          <button className="btn" onClick={simuler} disabled={busy || !selected.length}>
            <FileText size={15} /> Générer Facture
          </button>
        </div>
      </div>

      {/* ===== Fenèt konfimasyon Facture (opsyon pa fakti) ===== */}
      {sim && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => !busy && setSim(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-navy">Générer Facture — Options</h2>
              <button className="text-slate-400 hover:text-slate-600" onClick={() => setSim(null)} disabled={busy}>
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-3">
              <b className="text-navy">{sim.clientCode}</b> — {sim.clientName} · {sim.count} colis · {sim.weight.toFixed(2)} LB
            </p>

            {/* MODE DE CALCUL DES COLIS */}
            <div className="border border-line rounded-lg p-3 mb-3">
              <p className="text-xs font-bold text-navy uppercase mb-2">Mode de calcul des colis</p>
              <label className="flex items-start gap-2 text-sm py-1 cursor-pointer">
                <input type="radio" name="mode" className="mt-1" checked={calcMode === "addition"}
                  onChange={() => setCalcMode("addition")} />
                <span><b>Additionner tous les poids</b> — chaque colis = poids × Prix/LB</span>
              </label>
              <label className="flex items-start gap-2 text-sm py-1 cursor-pointer">
                <input type="radio" name="mode" className="mt-1" checked={calcMode === "small_control"}
                  onChange={() => setCalcMode("small_control")} />
                <span><b>Contrôle des petits colis</b> — {smallCfg.min}–{smallCfg.max} lb = tarif fixe {usd(smallCfg.price)} ; les autres = poids × Prix/LB</span>
              </label>
            </div>

            {/* ÉTAPE 1 — Taxe Fixe */}
            <div className="space-y-2 mb-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useTaxe} onChange={(e) => setUseTaxe(e.target.checked)} />
                <b>Taxe Fixe</b>
                {useTaxe && (
                  <input type="number" step="0.01" min="0" autoFocus placeholder="0.00"
                    className="input !w-28 !py-1 text-right ml-auto"
                    value={taxeVal} onChange={(e) => setTaxeVal(e.target.value)} />
                )}
              </label>
              {/* ÉTAPE 2 — Frais DGA */}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useDga} onChange={(e) => setUseDga(e.target.checked)} />
                <b>Frais DGA</b>
                {useDga && (
                  <input type="number" step="0.01" min="0" placeholder="0.00"
                    className="input !w-28 !py-1 text-right ml-auto"
                    value={fraisDga} onChange={(e) => setFraisDga(e.target.value)} />
                )}
              </label>
              {/* ÉTAPE 3 — Discount */}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useDisc} onChange={(e) => setUseDisc(e.target.checked)} />
                <b>Discount</b>
                {useDisc && (
                  <input type="number" step="0.01" min="0" placeholder="0.00"
                    className="input !w-28 !py-1 text-right ml-auto"
                    value={discount} onChange={(e) => setDiscount(e.target.value)} />
                )}
              </label>
            </div>

            {/* PRIX/LB — LECTURE SEULE (soti nan Paramètres) */}
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-2">
              <span className="text-xs text-slate-600">Prix/LB utilisé <span className="text-slate-400">(Paramètres — lecture seule)</span></span>
              <b className="text-navy font-mono">{comp && comp.ok ? usd(comp.perLb) : "—"}
                {comp && comp.ok && <span className="text-slate-400 font-normal"> / {comp.ville}</span>}</b>
            </div>

            {/* ERÈ VALIDASYON — bloke fakti a */}
            {comp && !comp.ok && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2 space-y-1">
                <p className="text-xs font-bold text-red-700">❌ Facture bloquée — corriger avant de continuer:</p>
                {comp.errors.map((e, i) => <p key={i} className="text-[11px] text-red-600">• {e}</p>)}
              </div>
            )}

            {/* APERÇU — Résumé */}
            <div className="bg-mist rounded-lg p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Poids total</span><b>{(comp?.totalWeight ?? 0).toFixed(2)} LB</b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sous-total colis</span><b>{usd(simSubtotal)}</b>
              </div>
              {useTaxe && Number(taxeVal) > 0 && (
                <div className="flex justify-between"><span className="text-slate-500">Taxe Fixe</span><b>{usd(Number(taxeVal))}</b></div>
              )}
              {useDga && Number(fraisDga) > 0 && (
                <div className="flex justify-between"><span className="text-slate-500">Frais DGA</span><b>{usd(Number(fraisDga))}</b></div>
              )}
              {useDisc && Number(discount) > 0 && (
                <div className="flex justify-between"><span className="text-slate-500">Discount</span><b>−{usd(Number(discount))}</b></div>
              )}
              <div className="flex justify-between border-t border-line pt-1.5 text-navy">
                <span className="font-bold">TOTAL USD</span><b>{usd(simTotal)}</b>
              </div>
              <div className="flex justify-between items-center bg-navy text-white rounded-lg px-3 py-2 mt-1">
                <span className="font-semibold">TOTAL HTG</span>
                <b className="text-lg">{htg(comp?.totalHtg ?? 0)}</b>
              </div>
              <p className="text-[11px] text-slate-400 text-right">Taux: 1 USD = {sim.rate.toFixed(2)} HTG · Prix/LB non modifié</p>
            </div>

            <div className="mt-5 flex gap-3">
              <button className="btn flex-1" onClick={generer} disabled={busy || !comp || !comp.ok}>
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
