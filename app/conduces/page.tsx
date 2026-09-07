"use client";
/*
 * STANDA COMMERCIAL — CONDUCES · V17 (CLASSEURS PAR DATE)
 * ═══════════════════════════════════════════════════════
 * Yon Conduce se yon manifest Caribe Tours. Men nan travay reyèl la, ou antre
 * PLIZYÈ conduce menm jou a (lè w fenk rekipere machandiz Dajabon). Donk
 * inite travay la se JOUNEN an, pa conduce a.
 *
 * STRIKTI:
 *   CLASSEUR (yon jou)  ->  Conduces jounen an  ->  Koli yo
 *
 *   • Chak jou se yon KATAB: dat la, konbyen conduce, konbyen koli, pwa,
 *     pousantaj fakti, epi BENEFIS ESTIME (pwa × 0.80 USD).
 *   • Klike sou katab la -> conduces jounen an deplòtye anndan l.
 *   • Klike sou NIMEWO conduce a -> ou antre nan conduce a.
 *
 * PROGRESYON: yon echèl pousantaj (pa yon bouton "Ouvrir"). Ou wè imedyatman
 * ki lo ki prèt pou fini.
 *
 * MOBILE / TABLÈT: tout bagay se kat ki anpile — pa gen tablo ki depase ekran
 * an. Ou ka travay sou telefòn depi Dajabon san pwoblèm.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Boxes, CheckCircle2, ClipboardList, FileDown, Folder, FolderOpen, Trash2,
  Search, TrendingUp, X, Plus, Sparkles
} from "lucide-react";
import Loader from "@/components/Loader";
import RefreshButton from "@/components/RefreshButton";
import ConducePaymentControl from "@/components/ConducePaymentControl";
import McpackInvoiceWorkspace from "@/components/McpackInvoiceWorkspace";
import { useRole } from "@/lib/authx";
import { createPendingConduces, deleteConduce, deriveConduceStatus, getBonRemiseConduceIds, getConduces, getConduceStats, getMcpackInvoices, setConduceStatus } from "@/lib/db";
import { PROFIT_PER_LB, estimateProfit } from "@/lib/pricing";
import { usd } from "@/lib/utils";
import type { Conduce, McpackInvoiceStatus } from "@/lib/types";

interface Row extends Conduce {
  count: number; weight: number; facturedCount: number; verifiedCount: number;
  specialCount: number;
  /** Eta fakti MCPACK ki gen Conduce sa a, si PDF MCPACK te deja valide li. */
  mcpackInvoiceStatus?: McpackInvoiceStatus;
  /** Yon Bon de remise deja soti pou lo sa a: li pa gen dwa seleksyone ankò. */
  bonRemiseCreated?: boolean;
}
interface Classeur {
  key: string;        // "2026-08-19"
  label: string;      // "mercredi 19 août 2026"
  dayName: string;    // "mercredi 19"
  short: string;      // "19 août 2026"
  rows: Row[];
  count: number; weight: number; facturedCount: number; specialCount: number;
  paidCount: number; unpaidCount: number;
}

/** Jou yon conduce: dat conduce a si li la, sinon dat kreyasyon an. */
const dayKey = (c: Conduce) => String(c.conduce_date || c.created_at).slice(0, 10);

export default function ConducesPage() {
  const router = useRouter();
  const { staff } = useRole();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"toutes" | "actives" | "historique">("toutes");
  /** Jounen ki louvri a. null = gri katab yo (vi dosye). */
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bonRemiseRegistryReady, setBonRemiseRegistryReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newConduceNumber, setNewConduceNumber] = useState("");
  const [creating, setCreating] = useState(false);
  const staffName = staff ? `${staff.prenom ?? ""} ${staff.nom ?? ""}`.trim() || (staff.username ?? "") : "";

  const load = async () => {
    try {
      const [list, mcpackInvoices] = await Promise.all([getConduces(), getMcpackInvoices()]);
      let recordedBonRemiseConduces = new Set<string>();
      try {
        recordedBonRemiseConduces = await getBonRemiseConduceIds();
        setBonRemiseRegistryReady(true);
        setSel((previous) => new Set([...previous].filter((id) => !recordedBonRemiseConduces.has(id))));
      } catch {
        // San registre a, nou dezaktive seleksyon pou Bon de remise pou pa gen doublon.
        setBonRemiseRegistryReady(false);
        setNotice("Le registre des Bons de remise doit être activé avant de sélectionner une Conduce.");
      }
      const mcpackInvoiceStatusByConduce = new Map<string, McpackInvoiceStatus>();
      for (const invoice of mcpackInvoices) {
        for (const line of invoice.conduces) {
          mcpackInvoiceStatusByConduce.set(line.conduce_id, invoice.status);
        }
      }
      const withStats = await Promise.all(list.map(async (c) => {
        const s = await getConduceStats(c.id);
        const derived = deriveConduceStatus(s.count, s.facturedCount);
        if (derived !== c.status) {
          try { await setConduceStatus(c.id, derived); } catch { /* pa bloke afichaj la */ }
        }
        return {
          ...c, status: derived, count: s.count, weight: s.weight,
          facturedCount: s.facturedCount, verifiedCount: s.verifiedCount, specialCount: s.specialCount,
          mcpackInvoiceStatus: mcpackInvoiceStatusByConduce.get(c.id),
          bonRemiseCreated: recordedBonRemiseConduces.has(c.id),
        };
      }));
      setRows(withStats);
    } catch { setRows([]); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const all = rows ?? [];
  const estArchive = (r: Row) => r.status === "Facturée";

  /** Gwoupe conduces yo pa JOU — se katab yo. */
  const classeurs = useMemo<Classeur[]>(() => {
    const needle = search.trim().toLowerCase();
    const pool = all
      .filter((r) => tab === "toutes" ? true : tab === "actives" ? !estArchive(r) : estArchive(r))
      .filter((r) => !needle
        || r.conduce_number.toLowerCase().includes(needle)
        || (r.office ?? "").toLowerCase().includes(needle));

    const map = new Map<string, Row[]>();
    for (const r of pool) {
      const k = dayKey(r);
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return Array.from(map.entries())
      .map(([key, list]) => {
        const d = new Date(key + "T12:00:00");
        const ok = !isNaN(d.getTime());
        return {
          key,
          label: ok ? d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : key,
          dayName: ok ? d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" }) : key,
          short: ok ? d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "",
          rows: list.sort((a, b) => a.conduce_number.localeCompare(b.conduce_number)),
          count: list.reduce((s, r) => s + r.count, 0),
          weight: list.reduce((s, r) => s + r.weight, 0),
          facturedCount: list.reduce((s, r) => s + r.facturedCount, 0),
          specialCount: list.reduce((s, r) => s + r.specialCount, 0),
          paidCount: list.filter((r) => r.payment_status === "Payé" || r.mcpackInvoiceStatus === "Payée").length,
          unpaidCount: list.filter((r) => r.mcpackInvoiceStatus === "Facturée" && r.payment_status !== "Payé").length,
        };
      })
      .sort((a, b) => b.key.localeCompare(a.key));   // pi resan an anwo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, tab, search]);

  const actives = all.filter((r) => !estArchive(r));
  const historique = all.filter(estArchive);
  const totalKoli = classeurs.reduce((s, c) => s + c.count, 0);
  const totalPoids = classeurs.reduce((s, c) => s + c.weight, 0);
  const totalRete = classeurs.reduce((s, c) => s + (c.count - c.facturedCount), 0);
  const totalMcpakAPayer = classeurs.reduce((s, c) => s + c.unpaidCount, 0);

  /** Jounen ki louvri a (si genyen). */
  const jour = openDay ? classeurs.find((c) => c.key === openDay) ?? null : null;

  /** Efase yon conduce ki te mal kreye (koli ki poko fakti yo detache, pa efase). */
  const supprimer = async (r: Row) => {
    if (!confirm(
      `Supprimer la conduce ${r.conduce_number} ?\n\n` +
      `${r.count} colis seront DÉTACHÉS (ils ne sont pas supprimés) et pourront être rattachés ailleurs.\n\n` +
      `Cette action est irréversible.`)) return;
    try {
      const { detached } = await deleteConduce(r.id);
      setNotice(`Conduce ${r.conduce_number} supprimée${detached ? ` — ${detached} colis détachés` : ""}.`);
      await load();
    } catch (e: unknown) { setNotice((e as Error).message); }
  };

  /** Efase TOUT conduces yon jounen (katab la) — youn pa youn, ak menm gad la. */
  const supprimerJour = async (cl: Classeur) => {
    if (!confirm(
      `Supprimer les ${cl.rows.length} conduce(s) du ${cl.label} ?\n\n` +
      `${cl.count} colis seront DÉTACHÉS (pas supprimés).\n\n` +
      `Une conduce contenant des colis déjà facturés sera conservée.\n\nCette action est irréversible.`)) return;
    let ok = 0; const echecs: string[] = [];
    for (const r of cl.rows) {
      try { await deleteConduce(r.id); ok++; }
      catch { echecs.push(r.conduce_number); }
    }
    setNotice(echecs.length
      ? `${ok} conduce(s) supprimée(s). Conservée(s) car déjà facturée(s) : ${echecs.join(", ")}.`
      : `${ok} conduce(s) supprimée(s).`);
    setOpenDay(null);
    await load();
  };

  const toggleSel = (id: string) =>
    setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  /** Mete eta lokal la touswit apre validasyon peman MCPACK la. */
  const onPaymentChanged = (next: Conduce) =>
    setRows((prev) => prev?.map((r) => r.id === next.id ? { ...r, ...next } : r) ?? null);

  /** Kreye yon Conduce DIRÈKTEMAN nan katab dat ki louvri a. */
  const createInFolder = async () => {
    if (!jour) return;
    const number = newConduceNumber.trim();
    if (!number) { setNotice("Entrez le numéro de la Conduce."); return; }
    setCreating(true);
    try {
      const [result] = await createPendingConduces([number], staffName, { conduceDate: jour.key });
      setNewConduceNumber(""); setAdding(false);
      setNotice(result?.alreadyExisted
        ? `La Conduce ${result.number} existe déjà : elle reste dans son classeur d'origine.`
        : `Conduce ${result?.number ?? number} ajoutée au classeur du ${jour.label}.`);
      await load();
    } catch (e: unknown) {
      setNotice((e as Error)?.message ?? "Impossible d'ajouter cette Conduce.");
    } finally { setCreating(false); }
  };

  if (rows === null) return <Loader inline />;

  return (
    <div className="space-y-4 pb-28">

      {/* ══ Antèt ══ */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          {jour ? (
            <>
              <button onClick={() => setOpenDay(null)}
                className="text-navy inline-flex items-center gap-1 hover:underline text-sm font-semibold">
                <ArrowLeft size={15} /> Toutes les journées
              </button>
              <h1 className="h-page capitalize mt-1 truncate">{jour.dayName} {jour.short}</h1>
            </>
          ) : (
            <>
              <h1 className="h-page flex items-center gap-2"><ClipboardList size={22} /> Conduces</h1>
              <p className="text-sm text-mute mt-0.5">Classées par jour d&apos;arrivée</p>
            </>
          )}
        </div>
        <div className="flex gap-2 items-center w-full sm:w-auto">
          {jour && (
            <button className="btn btn-brand whitespace-nowrap" onClick={() => setAdding((v) => !v)}>
              <Plus size={15} /> Ajouter
            </button>
          )}
          <div className="relative flex-1 sm:flex-none">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input w-full sm:w-56 !pl-9" placeholder="Numéro, office…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Effacer"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink">
                <X size={14} />
              </button>
            )}
          </div>
          <RefreshButton onRefresh={load} />
        </div>
      </div>

      {/* ══ Rezime — peman MCPACK lan separe de fakti kliyan yo ══ */}
      {!jour && classeurs.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          {([
            ["Journées", String(classeurs.length)],
            ["Colis à facturer", String(totalRete)],
            ["MCPACK à payer", String(totalMcpakAPayer)],
            ["Poids total", `${totalPoids.toFixed(0)} lb`],
            ["Bénéfice estimé", usd(estimateProfit(totalPoids))]
          ] as const).map(([label, val], i) => {
            const isPayment = label === "MCPACK à payer";
            const isProfit = i === 4;
            return (
            <div key={label} className={`card px-3.5 py-3 ${isProfit ? "bg-navy text-white" : ""} ${isPayment ? "border-amber-200" : ""}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wide ${isProfit ? "text-white/60" : isPayment ? "text-amber-700" : "text-mute"}`}>{label}</p>
              <p className={`text-xl sm:text-2xl font-extrabold leading-tight mt-0.5 ${isProfit ? "text-white" : isPayment ? "text-amber-800" : "text-ink"}`}>{val}</p>
            </div>
          );})}
        </div>
      )}

      {/* Fakti MCPACK yo pa menm bagay ak fakti kliyan yo. */}
      {!jour && <McpackInvoiceWorkspace staffName={staffName} onPaymentRecorded={load} />}

      {/* ══ Onglè ══ */}
      {!jour && (
      <div className="flex gap-1 border-b border-line overflow-x-auto">
        {([["toutes", "Toutes", all.length], ["actives", "En cours", actives.length], ["historique", "Historique", historique.length]] as const).map(
          ([k, label, n]) => (
            <button key={k} onClick={() => { setTab(k); setSel(new Set()); setOpenDay(null); }}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition ${
                tab === k ? "border-navy text-navy" : "border-transparent text-mute hover:text-ink"}`}>
              {label} <span className="text-xs font-normal">({n})</span>
            </button>
          ))}
      </div>
      )}

      {/* ══ KATAB YO ══ */}
      {jour ? (
        <>
          {adding && (
            <div className="card p-4 border border-navy/15">
              <div className="flex items-start gap-2">
                <FolderOpen size={17} className="text-navy mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-navy">Ajouter une Conduce dans ce classeur</p>
                  <p className="text-xs text-mute mt-0.5">Elle sera classée dans la journée du {jour.label}. Les colis seront ajoutés après l&apos;import MCPACK.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <input className="input font-mono flex-1" autoFocus placeholder="Numéro de Conduce (ex. 10534)"
                  value={newConduceNumber} onChange={(e) => setNewConduceNumber(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") createInFolder(); }} />
                <button className="btn btn-brand justify-center" onClick={createInFolder} disabled={creating || !newConduceNumber.trim()}>
                  <Plus size={15} /> {creating ? "Ajout…" : "Ajouter au classeur"}
                </button>
                <button className="btn btn-ghost justify-center" onClick={() => { setAdding(false); setNewConduceNumber(""); }} disabled={creating}>
                  Annuler
                </button>
              </div>
            </div>
          )}
          <JourOuvert cl={jour} sel={sel} onSel={toggleSel}
            onOpenConduce={(id) => router.push(`/conduces/${id}`)}
            onDelete={supprimer} onDeleteDay={() => supprimerJour(jour)} onPaymentChanged={onPaymentChanged}
            bonRemiseRegistryReady={bonRemiseRegistryReady} />
        </>
      ) : classeurs.length === 0 ? (
        <div className="card p-10 sm:p-12 text-center">
          <Boxes size={32} className="mx-auto text-slate-300" />
          <p className="text-sm text-mute mt-3">
            {search.trim()
              ? <>Aucune conduce ne correspond à «&nbsp;{search.trim()}&nbsp;».</>
              : tab === "historique"
                ? "Aucune journée entièrement facturée pour le moment."
                : tab === "actives"
                  ? "Aucune conduce en cours — voyez l'onglet Historique."
                  : <>Aucune conduce enregistrée. Importez-en depuis{" "}
                      <Link href="/sync" className="text-navy underline font-semibold">Synchronisation</Link>.</>}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {classeurs.map((cl) => (
            <ClasseurTile key={cl.key} cl={cl} onOpen={() => setOpenDay(cl.key)} />
          ))}
        </div>
      )}

      {notice && (
        <div className="card px-4 py-3 flex items-start gap-2">
          <p className="text-sm text-navy flex-1">{notice}</p>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-ink shrink-0">✕</button>
        </div>
      )}

      {/* ══ Bare aksyon flotan ══ */}
      {sel.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
          <div className="mx-auto max-w-3xl p-3 pointer-events-auto">
            <div className="rounded-2xl bg-navy text-white shadow-lift px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className="font-bold text-sm">{sel.size} conduce{sel.size > 1 ? "s" : ""}</span>
              <div className="flex-1" />
              <Link href="/bon-remise"
                className="rounded-lg bg-white text-navy font-bold text-xs px-3 py-2 inline-flex items-center gap-1.5">
                <FileDown size={14} /> Bon de Remise
              </Link>
              <button onClick={() => setSel(new Set())}
                className="rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold px-3 py-2">
                Effacer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Echèl pousantaj — montre ki lo prèske fini. */
function Echelle({ pct, tone = "brand" }: { pct: number; tone?: "brand" | "white" }) {
  return (
    <div className={`h-1.5 rounded-full overflow-hidden ${tone === "white" ? "bg-white/20" : "bg-line"}`}>
      <div className={`h-full rounded-full transition-all ${tone === "white" ? "bg-white" : "bg-brand"}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

/**
 * KATAB — yon ti dosye kòt a kòt (tankou dosye sou òdinatè).
 * Li konpak espre: ou wè plizyè jounen an menm tan. Klike pou louvri.
 */
function ClasseurTile({ cl, onOpen }: { cl: Classeur; onOpen: () => void }) {
  const pct = cl.count ? Math.round((cl.facturedCount / cl.count) * 100) : 0;
  const fini = cl.count > 0 && cl.facturedCount >= cl.count;

  return (
    <button onClick={onOpen}
      className="card card-hover p-3.5 text-left w-full flex flex-col gap-2 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <Folder size={26} className={fini ? "text-brand" : "text-navy"} />
        <span className="pill pill-gray shrink-0 !px-2">{cl.rows.length}</span>
      </div>

      <div className="min-w-0">
        <p className="font-extrabold text-ink text-sm leading-tight capitalize truncate">{cl.dayName}</p>
        <p className="text-[11px] text-mute truncate">{cl.short}</p>
      </div>

      <div className="text-[11px] text-mute leading-snug">
        {cl.count} colis · {cl.weight.toFixed(0)} lb
      </div>

      <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
        <span className={cl.unpaidCount ? "text-amber-700" : cl.paidCount ? "text-emerald-700" : "text-mute"}>
          MCPACK : {cl.unpaidCount ? `${cl.unpaidCount} à payer` : cl.paidCount ? "tout payé" : "aucune facture"}
        </span>
        {cl.specialCount > 0 && <span className="text-amber-700 inline-flex items-center gap-0.5"><Sparkles size={10} />{cl.specialCount} spécial{cl.specialCount > 1 ? "aux" : ""}</span>}
      </div>

      <div className="flex items-center gap-2 mt-auto pt-1">
        <div className="flex-1"><Echelle pct={pct} /></div>
        <span className={`text-[11px] font-bold tabular-nums shrink-0 ${fini ? "text-brand" : "text-navy"}`}>{pct}%</span>
      </div>
    </button>
  );
}

/** JOUNEN LOUVRI — conduces jounen an, youn anba lòt, ak rezime jounen an. */
function JourOuvert({ cl, sel, onSel, onOpenConduce, onDelete, onDeleteDay, onPaymentChanged, bonRemiseRegistryReady }: {
  cl: Classeur; sel: Set<string>; onSel: (id: string) => void; onOpenConduce: (id: string) => void;
  onDelete: (r: Row) => void; onDeleteDay: () => void; onPaymentChanged: (next: Conduce) => void;
  bonRemiseRegistryReady: boolean;
}) {
  const pct = cl.count ? Math.round((cl.facturedCount / cl.count) * 100) : 0;

  return (
    <div className="space-y-2.5">
      {/* Antèt jounen an */}
      <div className="card p-4">
        <div className="flex items-start gap-3">
          <FolderOpen size={22} className="text-navy shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-ink text-[15px] capitalize">{cl.label}</p>
            <p className="text-[11px] text-mute mt-0.5">
              {cl.rows.length} conduce{cl.rows.length > 1 ? "s" : ""} · {cl.count} colis · {cl.weight.toFixed(1)} lb
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2 text-[10px] font-bold">
              <span className={cl.unpaidCount ? "text-amber-700" : cl.paidCount ? "text-emerald-700" : "text-mute"}>
                {cl.paidCount || cl.unpaidCount
                  ? <>MCPACK : {cl.paidCount} payée{cl.paidCount > 1 ? "s" : ""} · {cl.unpaidCount} à payer</>
                  : "Aucune facture MCPACK"}
              </span>
              {cl.specialCount > 0 && <span className="text-amber-700 inline-flex items-center gap-0.5"><Sparkles size={11} />{cl.specialCount} colis spécial{cl.specialCount > 1 ? "aux" : ""}</span>}
            </div>
            <div className="mt-2.5 flex items-center gap-2.5">
              <div className="flex-1"><Echelle pct={pct} /></div>
              <span className="text-xs font-bold text-navy tabular-nums shrink-0">{pct}%</span>
            </div>
          </div>
          <button onClick={onDeleteDay} title="Supprimer toutes les conduces de cette journée"
            className="shrink-0 text-slate-300 hover:text-red-600 p-1.5">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Conduces jounen an */}
      {cl.rows.map((r) => {
        const p = r.count ? Math.round((r.facturedCount / r.count) * 100) : 0;
        const vide = r.count === 0;
        const done = r.count > 0 && r.facturedCount >= r.count;
        const selectionBlocked = !bonRemiseRegistryReady || !!r.bonRemiseCreated;
        return (
          <div key={r.id} className="card p-3.5">
            <div className="flex items-start gap-2.5">
              <input type="checkbox" className="mt-1 w-4 h-4 shrink-0 accent-emerald-600 disabled:cursor-not-allowed"
                checked={sel.has(r.id)} disabled={selectionBlocked} onChange={() => onSel(r.id)}
                title={r.bonRemiseCreated ? "Cette Conduce est déjà dans un Bon de remise." : !bonRemiseRegistryReady ? "Le registre des Bons de remise doit être activé." : undefined}
                aria-label={`Sélectionner ${r.conduce_number}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => onOpenConduce(r.id)}
                    className="font-mono font-extrabold text-navy text-[14px] hover:underline">
                    {r.conduce_number}
                  </button>
                  <ConducePaymentControl conduce={r} invoiceStatus={r.mcpackInvoiceStatus} compact onChanged={onPaymentChanged} />
                  {r.bonRemiseCreated && <span className="pill pill-green !px-2"><CheckCircle2 size={10} className="mr-0.5" />Déjà dans un bon</span>}
                  {r.specialCount > 0 && <span className="pill pill-amber !px-2"><Sparkles size={10} className="mr-0.5" />{r.specialCount} spécial{r.specialCount > 1 ? "aux" : ""}</span>}
                </div>
                <p className="text-[11px] text-mute mt-0.5 truncate">
                  {r.office || "Office —"} · {r.count} colis · {r.weight.toFixed(1)} lb
                </p>
                {vide ? (
                  <p className="text-[11px] text-amber-700 mt-1.5">
                    Colis pas encore synchronisés depuis MCPACK.
                  </p>
                ) : (
                  <div className="mt-2 flex items-center gap-2.5">
                    <div className="flex-1"><Echelle pct={p} /></div>
                    <span className={`text-[11px] font-bold tabular-nums shrink-0 ${done ? "text-brand" : "text-mute"}`}>
                      {r.facturedCount}/{r.count} · {p}%
                    </span>
                  </div>
                )}
              </div>
              <button onClick={() => onDelete(r)} title={`Supprimer ${r.conduce_number}`}
                className="shrink-0 text-slate-300 hover:text-red-600 p-1.5">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        );
      })}

      {/* Benefis jounen an */}
      <div className="rounded-2xl bg-navy text-white p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-white/55">Bénéfice estimé — journée</p>
          <p className="text-[10px] text-white/45 mt-0.5">{cl.weight.toFixed(1)} lb × {usd(PROFIT_PER_LB)}/lb</p>
        </div>
        <span className="text-xl font-extrabold inline-flex items-center gap-1.5 shrink-0">
          <TrendingUp size={16} className="text-brand" />{usd(estimateProfit(cl.weight))}
        </span>
      </div>
    </div>
  );
}
