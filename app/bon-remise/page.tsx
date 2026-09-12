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
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ClipboardList, FileDown, Truck } from "lucide-react";
import Loader, { SavedToast } from "@/components/Loader";
import RefreshButton from "@/components/RefreshButton";
import FilterConsole from "@/components/FilterConsole";
import {
  ClientTarifInfo, getCentralAccountCode, getClientTarifMap,
  createBonRemiseRecord, deleteBonRemiseRecord, getBonRemiseConduceIds, getBonRemiseRecords, saveBonRemisePdf,
  getConduces, getPackagesByConduceIds
} from "@/lib/db";
import { createBonRemiseNumber, generateBonRemise } from "@/lib/bonremise";
import type { BonRemiseRecord, Conduce, Pkg } from "@/lib/types";
import { dateFr } from "@/lib/utils";
import { useRole } from "@/lib/authx";
import { useRememberListContext } from "@/lib/list-context";
import { specialPackageInfo } from "@/lib/special-package";
import { openSecureDocument } from "@/lib/secure-document";

/** Vil "flexib" pou kont santral la — pa gen vil fiks. */
const CENTRAL_VILLE = "— Compte central —";

export default function BonRemisePage() {
  const { staff } = useRole();
  const searchParams = useSearchParams();
  const [conduces, setConduces] = useState<Conduce[] | null>(null);
  const [bonRecords, setBonRecords] = useState<BonRemiseRecord[]>([]);
  const [tarifMap, setTarifMap] = useState<Map<string, ClientTarifInfo>>(new Map());
  const [central, setCentral] = useState("");
  const [recordedConduces, setRecordedConduces] = useState<Set<string>>(new Set());
  const [registryReady, setRegistryReady] = useState(false);

  const [selCond, setSelCond] = useState<Set<string>>(new Set());
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [loadingPkgs, setLoadingPkgs] = useState(false);

  const [ville, setVille] = useState("");         // vil destinasyon (filtè + PDF)
  const [q, setQ] = useState("");
  const [customerF, setCustomerF] = useState("");
  const [statusF, setStatusF] = useState("");
  const [dateF, setDateF] = useState("");
  const [specialF, setSpecialF] = useState("");
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  useRememberListContext("bon-remise", {
    selectedConduces: Array.from(selCond), ville, q, customerF, statusF, dateF,
    specialF, minWeight, maxWeight, selectedPackages: Array.from(sel),
  }, (saved) => {
    const text = (name: string) => typeof saved[name] === "string" ? saved[name] : "";
    const ids = (name: string) => Array.isArray(saved[name]) ? saved[name].filter((id): id is string => typeof id === "string") : [];
    setSelCond(new Set(ids("selectedConduces"))); setVille(text("ville")); setQ(text("q"));
    setCustomerF(text("customerF")); setStatusF(text("statusF")); setDateF(text("dateF"));
    setSpecialF(text("specialF")); setMinWeight(text("minWeight")); setMaxWeight(text("maxWeight"));
    setSel(new Set(ids("selectedPackages")));
  });
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const staffName = staff ? `${staff.prenom ?? ""} ${staff.nom ?? ""}`.trim() || (staff.username ?? "") : "";

  const load = async () => {
    try {
      const [cs, tm, cc, records] = await Promise.all([getConduces(), getClientTarifMap(), getCentralAccountCode(), getBonRemiseRecords()]);
      setConduces(cs); setTarifMap(tm); setCentral(cc.toUpperCase()); setBonRecords(records);
      try {
        // Enfòmatif sèlman (badge "Colis déjà remis") — yon Conduce ki gen
        // colis pou plizyè vil rete SELEKSYONAB apre yon premye Bon, paske
        // se PA KOLI (packages.bon_remise_id) blokaj anti-doublon an fèt.
        const used = await getBonRemiseConduceIds();
        setRecordedConduces(used);
        setRegistryReady(true);
      } catch {
        // Pi pridan: pa kite kreye yon bon san registre ki pwoteje kont doublon.
        setRegistryReady(false);
        setToast("Le registre des Bons de remise doit être activé avant toute sélection.");
      }
    } catch {
      setConduces([]);
      setToast("Impossible de charger les Conduces.");
    }
  };
  useEffect(() => { load(); }, []);

  // Lè staff la te seleksyone Conduce filtre yo depi paj Conduces la, pote
  // menm seleksyon an isit la.
  useEffect(() => {
    if (!conduces || !registryReady) return;
    const requested = new Set((searchParams.get("conduces") ?? "").split(",").filter(Boolean));
    if (!requested.size) return;
    const valid = conduces.filter((conduce) => requested.has(conduce.id));
    if (valid.length) setSelCond((previous) => new Set([...previous, ...valid.map((conduce) => conduce.id)]));
  }, [conduces, registryReady, searchParams]);

  /** Chaje koli yo chak fwa seleksyon conduce a chanje. Koli ki deja sou yon Bon pa antre. */
  useEffect(() => {
    const ids = Array.from(selCond);
    if (!ids.length) { setPkgs([]); setSel(new Set()); return; }
    let annule = false;
    setLoadingPkgs(true);
    getPackagesByConduceIds(ids)
      .then((list) => { if (!annule) setPkgs(list.filter((p) => !p.bon_remise_id)); })
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
      if (customerF && p.customer_code !== customerF) return false;
      if (statusF && p.status !== statusF) return false;
      if (dateF && !String(p.created_date ?? "").includes(dateF)) return false;
      const special = specialPackageInfo(p).isSpecial;
      if (specialF === "yes" && !special) return false;
      if (specialF === "no" && special) return false;
      if (minWeight && (Number(p.weight) || 0) < Number(minWeight)) return false;
      if (maxWeight && (Number(p.weight) || 0) > Number(maxWeight)) return false;
      if (!needle) return true;
      return [p.tracking_number, p.tracking_manual, p.customer_code, p.customer_name, p.content]
        .some((f) => String(f ?? "").toLowerCase().includes(needle));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkgs, ville, q, tarifMap, central]);

  const chosen = pkgs.filter((p) => sel.has(p.id));
  const filteredSelectedCount = filtered.filter((p) => sel.has(p.id)).length;
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => sel.has(p.id));
  const poidsSel = chosen.reduce((s, p) => s + (Number(p.weight) || 0), 0);
  const centralSel = chosen.filter(isCentral).length;
  const clientsSel = new Set(chosen.map((p) => p.customer_code).filter(Boolean)).size;
  const specialSel = chosen.filter((p) => specialPackageInfo(p).isSpecial).length;

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

  const clearFilters = () => {
    setQ(""); setVille(""); setCustomerF(""); setStatusF(""); setDateF("");
    setSpecialF(""); setMinWeight(""); setMaxWeight("");
  };

  const customerOptions = useMemo(() => Array.from(new Set(pkgs.map((p) => p.customer_code).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value })), [pkgs]);
  const statusOptions = useMemo(() => Array.from(new Set(pkgs.map((p) => p.status).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value })), [pkgs]);

  const creer = async () => {
    if (!chosen.length) return;
    if (!ville) {
      setToast("Choisissez d’abord la ville de destination du Bon de remise.");
      return;
    }
    const conduceIds = Array.from(new Set(chosen
      .map((p) => String(p.conduce_id ?? "").trim())
      .filter(Boolean)));
    if (!conduceIds.length) {
      setToast("Aucune Conduce n'est reliée aux colis sélectionnés.");
      return;
    }
    setBusy(true);
    let recordId = "";
    try {
      const bonNumber = createBonRemiseNumber();
      const record = await createBonRemiseRecord({
        bonNumber, packageIds: chosen.map((p) => p.id), conduceIds, packageCount: chosen.length, destination: ville, who: staffName,
      });
      recordId = record.id;
      const pdf = await generateBonRemise(chosen, tarifMap, {
        destination: ville, conduceOf, centralCode: central, number: bonNumber,
      });
      // Le téléchargement local reste disponible même si l'archivage échoue.
      // Un Bon créé ne doit jamais être annulé après que le PDF a été produit.
      let archiveWarning = "";
      try { await saveBonRemisePdf(record.id, pdf.blob, pdf.filename); }
      catch { archiveWarning = " — PDF téléchargé, mais l'archive sécurisée a échoué."; }
      setRecordedConduces((previous) => new Set([...previous, ...conduceIds]));
      setSel(new Set()); setSelCond(new Set()); setVille(""); setQ("");
      await load();
      setToast(`Bon de remise ${bonNumber} créé — ${chosen.length} colis${ville ? ` · ${ville}` : ""}${archiveWarning}`);
    } catch (error) {
      // Si PDF la pa rive kreye, retire mak la pou Conduce yo pa rete bloke.
      if (recordId) await deleteBonRemiseRecord(recordId).catch(() => undefined);
      setToast(error instanceof Error ? error.message : "Impossible de créer le Bon de remise.");
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
            <div className="ml-auto flex items-center gap-2"><span className="text-[11px] bg-white/15 rounded-full px-2.5 py-1 font-semibold">
              {selCond.size} sélectionnée(s)
            </span><button type="button" onClick={() => { setSelCond(new Set()); setSel(new Set()); }} className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-bold hover:bg-white/20">Désélectionner</button></div>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-56 overflow-y-auto pr-1">
          {conduces.length === 0 && <p className="text-white/50 text-xs py-3">Aucune conduce.</p>}
          {conduces.map((c) => {
            const on = selCond.has(c.id);
            // Enfòmatif sèlman: yon Conduce ka gen colis pou plizyè vil, li
            // rete seleksyonab menm si li deja kontribye nan yon lòt Bon —
            // koli ki deja remis yo ap eskli otomatikman nan Etap 3.
            const alreadyRecorded = recordedConduces.has(c.id);
            const disabled = !registryReady;
            return (
              <button key={c.id}
                type="button"
                disabled={disabled}
                title={!registryReady ? "Le registre des Bons de remise doit être activé." : alreadyRecorded ? "Certains colis de cette Conduce sont déjà dans un autre Bon de remise ; ils seront exclus automatiquement." : undefined}
                onClick={() => setSelCond((prev) => {
                  const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n;
                })}
                className={`text-left rounded-xl px-3 py-2.5 border transition ${
                  on ? "bg-brand border-brand" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>
                <div className="flex items-center gap-2">
                  <Truck size={14} className={on ? "text-white" : "text-white/50"} />
                  <span className="font-mono font-bold text-sm truncate">{c.conduce_number}</span>
                  {on && <span className="ml-auto grid place-items-center h-5 w-5 rounded-full bg-emerald-500 text-white"><CheckCircle2 size={13} /></span>}
                  {!on && alreadyRecorded && <span className="ml-auto text-[10px] font-bold text-emerald-300 inline-flex items-center gap-1"><CheckCircle2 size={12} />Colis déjà remis</span>}
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
          <FilterConsole query={q} onQueryChange={setQ} queryPlaceholder="Tracking, client, contenu…"
            resultCount={filtered.length} onClear={clearFilters}
            selection={{ selectedCount: filteredSelectedCount, allSelected: allFilteredSelected, onToggleAll: toggleAll, label: "Sélectionner les colis filtrés" }}
            fields={[
              { key: "ville", label: "Ville", type: "select", value: ville, onChange: setVille, options: villes.map((value) => ({ value, label: value })) },
              { key: "client", label: "Code client", type: "select", value: customerF, onChange: setCustomerF, options: customerOptions },
              { key: "status", label: "Statut", type: "select", value: statusF, onChange: setStatusF, options: statusOptions },
              { key: "date", label: "Date", type: "text", value: dateF, onChange: setDateF, placeholder: "2026-09" },
              { key: "special", label: "Colis spécial", type: "select", value: specialF, onChange: setSpecialF, options: [{ value: "yes", label: "Seulement spéciaux" }, { value: "no", label: "Sans spécial" }] },
              { key: "minWeight", label: "Poids min. (lb)", type: "number", value: minWeight, onChange: setMinWeight, min: 0, step: 0.01 },
              { key: "maxWeight", label: "Poids max. (lb)", type: "number", value: maxWeight, onChange: setMaxWeight, min: 0, step: 0.01 },
            ]} />
          {ville && central && (
            <p className="text-[11px] text-navy bg-blue-50 border border-navy/15 rounded-lg px-3 py-2 mt-3">
              Les colis du <b>compte central {central}</b> restent visibles quelle que soit la ville —
              ils prendront <b>{ville}</b> comme destination sur ce bon.
            </p>
          )}
        </section>
      )}

      {/* ══ REGISTRE — traçabilité, ville, réception et PDF sécurisé ══ */}
      {bonRecords.length > 0 && (
        <section className="card overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-line p-4">
            <div><h2 className="h-sec">Bons de remise récents</h2><p className="mt-1 text-xs text-mute">Chaque Bon conserve sa ville, son nombre de colis, son état de réception et son PDF sécurisé.</p></div>
            <span className="badge bg-slate-100 text-slate-600">{bonRecords.length}</span>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {bonRecords.map((bon) => <article key={bon.id} className="rounded-2xl border border-line bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-2"><div><p className="font-mono text-sm font-black text-navy">{bon.bon_number}</p><p className="mt-1 text-xs font-semibold text-slate-600">{bon.destination || "Destination non précisée"} · {bon.package_count} colis</p></div><span className={`badge ${bon.received_at ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{bon.received_at ? "Reçu" : "En route"}</span></div>
              <p className="mt-2 text-[11px] text-slate-500">Créé le {dateFr(bon.created_at)}{bon.created_by ? ` · ${bon.created_by}` : ""}{bon.received_by ? ` · reçu par ${bon.received_by}` : ""}</p>
              {bon.pdf_path ? <button type="button" onClick={() => void openSecureDocument("bon-remise", bon.id).catch((error) => setToast(error instanceof Error ? error.message : "PDF indisponible."))} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-navy px-3 text-xs font-bold text-white hover:bg-brand"><FileDown size={14} />Ouvrir le PDF</button> : <p className="mt-3 text-xs font-semibold text-amber-700">PDF non archivé</p>}
            </article>)}
          </div>
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
                    const special = specialPackageInfo(p);
                    return (
                      <tr key={p.id}
                        onClick={() => toggle(p.id)}
                        className={`cursor-pointer transition ${
                          on ? "bg-blue-50" : i % 2 ? "bg-mist" : ""} hover:bg-blue-50`}>
                        <td className="tdc" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={on} onChange={() => toggle(p.id)} />
                        </td>
                        <td className="tdc font-mono text-navy font-semibold">{conduceOf[p.id] || "—"}</td>
                        <td className="tdc font-mono">
                          <div className="flex flex-col gap-0.5">
                            <span>{p.tracking_number}</span>
                            {special.isSpecial && <span className="w-fit rounded-full bg-amber-100 px-1.5 py-0.5 font-sans text-[9px] font-bold text-amber-800" title={`Raison : ${special.reason}`}>* Spécial</span>}
                          </div>
                        </td>
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
                {ville ? ` · ${ville}` : " · choisissez une ville"}
                {clientsSel ? ` · ${clientsSel} client${clientsSel > 1 ? "s" : ""}` : ""}
                {specialSel ? ` · ${specialSel} spécial${specialSel > 1 ? "aux" : ""}` : ""}
                {centralSel > 0 ? ` · ${centralSel} du compte central` : ""}
              </span>
              <div className="flex-1" />
              <button onClick={() => setSel(new Set())}
                className="text-white/70 hover:text-white text-xs font-semibold px-2">Vider</button>
              <button onClick={creer} disabled={busy || !ville}
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
