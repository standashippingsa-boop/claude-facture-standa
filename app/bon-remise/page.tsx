"use client";
/*
 * STANDA COMMERCIAL — BON DE REMISE DEPI CONDUCES · V15
 * ═══════════════════════════════════════════════════════
 * WORKFLOW (3 etap, jan ou dekri l):
 *   1) Seleksyone yon oswa PLIZYÈ Conduce
 *   2) Tout koli conduce sa yo desann → filtre pa VIL (ex: Gonaïves) + rechèch
 *   3) Koche koli yo → "Créer le Bon de Remise" → PDF ak NIMEWO CONDUCE yo ladan
 *
 * KONT SANTRAL BIZNIS (Paramètres → central_account_code, ex: MC-36191):
 *   Kliyan biznis ki poko gen pwòp kont yo pase sou kont sa a. Li PA mare ak
 *   yon sèl vil: li parèt nan NENPÒT bon, epi li pran VIL DESTINASYON an ou
 *   chwazi a. Konsa yon bon Port-de-Paix ak yon bon Gonaïves toude ka genyen l.
 */
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, FileDown, Search, Truck, X } from "lucide-react";
import Loader, { SavedToast } from "@/components/Loader";
import RefreshButton from "@/components/RefreshButton";
import {
  ClientTarifInfo, getCentralAccountCode, getClientTarifMap,
  getConduces, getPackagesByConduceIds
} from "@/lib/db";
import { generateBonRemise } from "@/lib/bonremise";
import type { Conduce, Pkg } from "@/lib/types";
import { dateFr } from "@/lib/utils";

/** Vil "flexib" pou kont santral la — pa gen vil fiks. */
const CENTRAL_VILLE = "— Compte central —";

export default function BonRemisePage() {
  const [conduces, setConduces] = useState<Conduce[] | null>(null);
  const [tarifMap, setTarifMap] = useState<Map<string, ClientTarifInfo>>(new Map());
  const [central, setCentral] = useState("");

  const [selCond, setSelCond] = useState<Set<string>>(new Set());
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [loadingPkgs, setLoadingPkgs] = useState(false);

  const [ville, setVille] = useState("");         // vil destinasyon (filtè + PDF)
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [cs, tm, cc] = await Promise.all([getConduces(), getClientTarifMap(), getCentralAccountCode()]);
    setConduces(cs); setTarifMap(tm); setCentral(cc.toUpperCase());
  };
  useEffect(() => { load(); }, []);

  /** Chaje koli yo chak fwa seleksyon conduce a chanje. */
  useEffect(() => {
    const ids = Array.from(selCond);
    if (!ids.length) { setPkgs([]); setSel(new Set()); return; }
    let annule = false;
    setLoadingPkgs(true);
    getPackagesByConduceIds(ids)
      .then((list) => { if (!annule) setPkgs(list); })
      .catch(() => { if (!annule) setPkgs([]); })
      .finally(() => { if (!annule) setLoadingPkgs(false); });
    return () => { annule = true; };
  }, [selCond]);

  const isCentral = (p: Pkg) =>
    !!central && String(p.customer_code ?? "").trim().toUpperCase() === central;

  /** Vil yon koli. Kont santral -> flexib (pa yon vil fiks). */
  const villeOf = (p: Pkg): string =>
    isCentral(p) ? CENTRAL_VILLE : (tarifMap.get(p.customer_code)?.ville?.name ?? "");

  /** Nimewo conduce pa koli — pou PDF la. */
  const conduceOf = useMemo(() => {
    const byId = new Map((conduces ?? []).map((c) => [c.id, c.conduce_number]));
    const m: Record<string, string> = {};
    for (const p of pkgs) if (p.conduce_id) m[p.id] = byId.get(p.conduce_id) ?? "";
    return m;
  }, [pkgs, conduces]);

  /** Lis vil yo ki reyèlman prezan nan koli yo. */
  const villes = useMemo(() => {
    const set = new Set<string>();
    for (const p of pkgs) { const v = villeOf(p); if (v && v !== CENTRAL_VILLE) set.add(v); }
    return Array.from(set).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkgs, tarifMap, central]);

  /**
   * FILTÈ. Lè yon vil chwazi, koli KONT SANTRAL la RETE VIZIB —
   * se egzakteman sa ou mande: kont lan ka antre nan nenpòt bon.
   */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pkgs.filter((p) => {
      if (ville && villeOf(p) !== ville && !isCentral(p)) return false;
      if (!needle) return true;
      return [p.tracking_number, p.tracking_manual, p.customer_code, p.customer_name, p.content]
        .some((f) => String(f ?? "").toLowerCase().includes(needle));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkgs, ville, q, tarifMap, central]);

  const chosen = pkgs.filter((p) => sel.has(p.id));
  const poidsSel = chosen.reduce((s, p) => s + (Number(p.weight) || 0), 0);
  const centralSel = chosen.filter(isCentral).length;

  const toggle = (id: string) =>
    setSel((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const toggleAll = () =>
    setSel((prev) => {
      const ids = filtered.map((p) => p.id);
      const tout = ids.every((i) => prev.has(i));
      const n = new Set(prev);
      ids.forEach((i) => (tout ? n.delete(i) : n.add(i)));
      return n;
    });

  const creer = async () => {
    if (!chosen.length) return;
    setBusy(true);
    try {
      await generateBonRemise(chosen, tarifMap, {
        destination: ville, conduceOf, centralCode: central
      });
      setToast(`Bon de remise créé — ${chosen.length} colis${ville ? ` · ${ville}` : ""}`);
    } finally { setBusy(false); }
  };

  if (conduces === null) return <Loader inline />;

  return (
    <div className="space-y-5 pb-28">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="h-page flex items-center gap-2"><ClipboardList size={22} /> Bon de Remise</h1>
          <p className="text-sm text-mute mt-0.5">
            Sélectionnez des conduces, filtrez par ville, puis générez le bon.
          </p>
        </div>
        <RefreshButton onRefresh={load} />
      </div>

      {/* ══ ÉTAPE 1 — CONDUCES ══ */}
      <section className="rounded-2xl bg-navy text-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-white/15 grid place-items-center text-[11px] font-bold">1</span>
          <h2 className="text-sm font-bold uppercase tracking-wide">Choisir les conduces</h2>
          {selCond.size > 0 && (
            <span className="ml-auto text-[11px] bg-white/15 rounded-full px-2.5 py-1 font-semibold">
              {selCond.size} sélectionnée(s)
            </span>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-56 overflow-y-auto pr-1">
          {conduces.length === 0 && <p className="text-white/50 text-xs py-3">Aucune conduce.</p>}
          {conduces.map((c) => {
            const on = selCond.has(c.id);
            return (
              <button key={c.id}
                onClick={() => setSelCond((prev) => {
                  const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n;
                })}
                className={`text-left rounded-xl px-3 py-2.5 border transition ${
                  on ? "bg-brand border-brand" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>
                <div className="flex items-center gap-2">
                  <Truck size={14} className={on ? "text-white" : "text-white/50"} />
                  <span className="font-mono font-bold text-sm truncate">{c.conduce_number}</span>
                </div>
                <p className={`text-[11px] mt-0.5 truncate ${on ? "text-white/80" : "text-white/45"}`}>
                  {c.office || "—"} · {c.conduce_date ? dateFr(c.conduce_date) : dateFr(c.created_at)}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ══ ÉTAPE 2 — FILTRES ══ */}
      {selCond.size > 0 && (
        <section className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-navy text-white grid place-items-center text-[11px] font-bold">2</span>
            <h2 className="text-sm font-bold text-navy uppercase tracking-wide">Filtrer les colis</h2>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select className="input w-52" value={ville} onChange={(e) => setVille(e.target.value)}>
              <option value="">Toutes les villes</option>
              {villes.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input w-full !pl-9" placeholder="Tracking, client, contenu…"
                value={q} onChange={(e) => setQ(e.target.value)} />
              {q && <button onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-navy"><X size={14} /></button>}
            </div>
            <span className="text-xs text-mute whitespace-nowrap">
              {filtered.length} / {pkgs.length} colis
            </span>
          </div>
          {ville && central && (
            <p className="text-[11px] text-navy bg-blue-50 border border-navy/15 rounded-lg px-3 py-2 mt-3">
              Les colis du <b>compte central {central}</b> restent visibles quelle que soit la ville —
              ils prendront <b>{ville}</b> comme destination sur ce bon.
            </p>
          )}
        </section>
      )}

      {/* ══ ÉTAPE 3 — COLIS ══ */}
      {selCond.size > 0 && (
        <section className="card overflow-hidden">
          {loadingPkgs ? <Loader inline size={64} /> : filtered.length === 0 ? (
            <p className="py-12 text-center text-mute text-sm">Aucun colis pour ce filtre.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr>
                  <th className="thc w-10">
                    <input type="checkbox" onChange={toggleAll}
                      checked={filtered.length > 0 && filtered.every((p) => sel.has(p.id))} />
                  </th>
                  {["Conduce", "Tracking ID (Guía)", "Tracking Number", "Code Client", "Nom", "Ville", "Poids"]
                    .map((h, i) => <th key={h} className={`thc ${i === 6 ? "text-right" : "text-left"}`}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filtered.map((p, i) => {
                    const on = sel.has(p.id);
                    const cen = isCentral(p);
                    return (
                      <tr key={p.id}
                        onClick={() => toggle(p.id)}
                        className={`cursor-pointer transition ${
                          on ? "bg-blue-50" : i % 2 ? "bg-mist" : ""} hover:bg-blue-50`}>
                        <td className="tdc" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={on} onChange={() => toggle(p.id)} />
                        </td>
                        <td className="tdc font-mono text-navy font-semibold">{conduceOf[p.id] || "—"}</td>
                        <td className="tdc font-mono">{p.tracking_number}</td>
                        <td className="tdc font-mono text-mute">{p.tracking_manual || "—"}</td>
                        <td className="tdc font-semibold">{p.customer_code}</td>
                        <td className="tdc truncate max-w-[160px]">{p.customer_name}</td>
                        <td className="tdc">
                          {cen
                            ? <span className="pill pill-blue"><span className="pill-dot" />{ville || "Flexible"}</span>
                            : (villeOf(p) || "—")}
                        </td>
                        <td className="tdc text-right whitespace-nowrap">{(Number(p.weight) || 0).toFixed(2)} lb</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ══ BARRE DE SÉLECTION ══ */}
      {chosen.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-50 pointer-events-none">
          <div className="mx-auto max-w-4xl p-4 pointer-events-auto">
            <div className="rounded-2xl bg-navy text-white shadow-lift px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className="font-bold text-sm">{chosen.length} colis</span>
              <span className="text-white/60 text-xs">
                {poidsSel.toFixed(2)} lb
                {ville ? ` · ${ville}` : ""}
                {centralSel > 0 ? ` · ${centralSel} du compte central` : ""}
              </span>
              <div className="flex-1" />
              <button onClick={() => setSel(new Set())}
                className="text-white/70 hover:text-white text-xs font-semibold px-2">Vider</button>
              <button onClick={creer} disabled={busy}
                className="rounded-xl bg-brand hover:bg-brand-dark px-4 py-2 text-sm font-bold
                           flex items-center gap-2 disabled:opacity-60">
                <FileDown size={15} /> {busy ? "Création…" : "Créer le Bon de Remise"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <SavedToast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
