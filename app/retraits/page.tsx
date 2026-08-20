"use client";
/*
 * STANDA COMMERCIAL — DEMANDES DE RETRAIT (ADMIN) · V14
 * ══════════════════════════════════════════════════════
 * Kliyan an notifye davans ki koli li pral vin pran. Isit la ekip la:
 *   1) wè detay koli yo,
 *   2) prepare yo epi mete estati a ajou (kliyan an wè li),
 *   3) SELEKSYONE koli yo epi FAKTI yo dirèkteman — MENM MOTÈ a
 *      (InvoiceDialog -> computeInvoice), donk menm règ, menm validasyon,
 *      menm PDF, menm WhatsApp ak paj Packages la.
 *
 * RÈG SEKIRITE:
 *  • Koli yo relije FRÈ depi bazdone a (pa konfyans nan snapshot retrait la).
 *  • Sèlman koli ki "Disponible" epi ki POKO fakti ka seleksyone.
 *  • Yon fwa fakti: koli a soti nan lis la epi ale nan Historique/Factures.
 */
import { useEffect, useState } from "react";
import { FileText, Inbox, Loader2 } from "lucide-react";
import RefreshButton from "@/components/RefreshButton";
import { SavedToast } from "@/components/Loader";
import InvoiceDialog from "@/components/InvoiceDialog";
import {
  getClient, getPackagesByTrackings, getRetraits, getSettings, setRetraitStatus
} from "@/lib/db";
import { Client, Pkg, Retrait, RetraitStatus } from "@/lib/types";
import { dateFr, usd } from "@/lib/utils";

const STATUTS: RetraitStatus[] = ["En attente", "Préparé", "Remis"];
const BADGE: Record<RetraitStatus, string> = {
  "En attente": "bg-amber-100 text-amber-700",
  "Préparé": "bg-blue-100 text-blue-700",
  "Remis": "bg-emerald-100 text-emerald-700"
};
const DEFAULT_FOOTER = "Mèsi paske ou fè STANDA COMMERCIAL konfyans.";

interface Target { client: Client; pkgs: Pkg[]; footer: string; retraitId: string }

export default function RetraitsPage() {
  const [retraits, setRetraits] = useState<Retrait[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [filtre, setFiltre] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /** Koli reyèl yo chaje depi bazdone a, pa demann: { [retraitId]: Pkg[] } */
  const [live, setLive] = useState<Record<string, Pkg[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [sel, setSel] = useState<Record<string, Set<string>>>({});
  const [target, setTarget] = useState<Target | null>(null);

  const load = () => getRetraits().then(setRetraits).catch((e) => setNotice("Erè: " + e.message));
  useEffect(() => { load(); }, []);

  const changer = async (r: Retrait, status: RetraitStatus) => {
    try {
      await setRetraitStatus(r.id, status);
      setRetraits((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)));
      setToast(`${r.customer_code} → ${status}`);
    } catch (e: unknown) { setNotice("Erè: " + (e as Error).message); }
  };

  /** Louvri yon demann: relije koli yo FRÈ depi bazdone a. */
  const toggle = async (r: Retrait) => {
    if (open === r.id) { setOpen(null); return; }
    setOpen(r.id);
    if (live[r.id]) return;
    setLoadingId(r.id);
    try {
      const trackings = (r.items ?? []).map((i) => i.tracking_number);
      const pkgs = await getPackagesByTrackings(trackings);
      setLive((prev) => ({ ...prev, [r.id]: pkgs }));
    } catch (e: unknown) { setNotice("Erè: " + (e as Error).message); }
    finally { setLoadingId(null); }
  };

  const toggleSel = (rid: string, pid: string) =>
    setSel((prev) => {
      const n = new Set(prev[rid] ?? []);
      if (n.has(pid)) n.delete(pid); else n.add(pid);
      return { ...prev, [rid]: n };
    });

  /** FACTURER — menm motè ak paj Packages (InvoiceDialog). */
  const facturer = async (r: Retrait) => {
    const chosen = (live[r.id] ?? []).filter((p) => (sel[r.id] ?? new Set()).has(p.id));
    if (!chosen.length) return;
    setLoadingId(r.id);
    try {
      const [c, s] = await Promise.all([getClient(r.customer_code), getSettings()]);
      if (!c) { setNotice(`Client ${r.customer_code} introuvable.`); return; }
      setTarget({ client: c, pkgs: chosen, footer: s.invoice_footer || DEFAULT_FOOTER, retraitId: r.id });
    } catch (e: unknown) { setNotice("Erè: " + (e as Error).message); }
    finally { setLoadingId(null); }
  };

  /** Apre fakti a: retire koli fakti yo nan lis la, epi rafrechi demann yo. */
  const apresFacture = async (message: string) => {
    const t = target;
    setTarget(null);
    setToast(message);
    if (!t) return;
    const done = new Set(t.pkgs.map((p) => p.id));
    setLive((prev) => ({ ...prev, [t.retraitId]: (prev[t.retraitId] ?? []).filter((p) => !done.has(p.id)) }));
    setSel((prev) => ({ ...prev, [t.retraitId]: new Set() }));
    await load();
  };

  const list = filtre ? retraits.filter((r) => r.status === filtre) : retraits;
  const enAttente = retraits.filter((r) => r.status === "En attente").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-extrabold text-navy flex items-center gap-2">
          <Inbox size={20} /> Demandes de retrait
          {enAttente > 0 && <span className="badge bg-amber-100 text-amber-700">{enAttente} en attente</span>}
        </h1>
        <div className="flex gap-2 items-center">
          <select className="input w-44" value={filtre} onChange={(e) => setFiltre(e.target.value)}>
            <option value="">Tous statuts</option>
            {STATUTS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <RefreshButton onRefresh={load} />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Ouvrez une demande pour voir les colis, les préparer, puis les <b>facturer directement</b> —
        même moteur de facturation que la page Packages. Seuls les colis <b>Disponible</b> et
        <b> non facturés</b> peuvent être sélectionnés.
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr>
            {["Date", "Code Client", "Nom", "Ville", "Colis", "Poids total (lb)", "Statut", "Aksyon"]
              .map((h) => <th key={h} className="th">{h}</th>)}
          </tr></thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-slate-400">
                Poko gen demande de retrait.
              </td></tr>
            ) : list.map((r, i) => (
              <RetraitRow key={r.id} r={r} zebra={i % 2 === 1} open={open === r.id}
                pkgs={live[r.id]} loading={loadingId === r.id}
                sel={sel[r.id] ?? new Set()}
                onToggle={() => toggle(r)}
                onToggleSel={(pid) => toggleSel(r.id, pid)}
                onStatus={(s) => changer(r, s)}
                onFacturer={() => facturer(r)} />
            ))}
          </tbody>
        </table>
      </div>

      {notice && <p className="card px-4 py-3 text-sm text-navy">{notice}</p>}
      {toast && <SavedToast message={toast} onClose={() => setToast(null)} />}

      {/* MÊME fenêtre de facturation que Packages / Dossier client */}
      {target && (
        <InvoiceDialog
          client={target.client}
          pkgs={target.pkgs}
          footer={target.footer}
          onClose={() => setTarget(null)}
          onDone={apresFacture} />
      )}
    </div>
  );
}

function RetraitRow({
  r, zebra, open, pkgs, loading, sel, onToggle, onToggleSel, onStatus, onFacturer
}: {
  r: Retrait; zebra: boolean; open: boolean; pkgs?: Pkg[]; loading: boolean;
  sel: Set<string>;
  onToggle: () => void; onToggleSel: (pkgId: string) => void;
  onStatus: (s: RetraitStatus) => void; onFacturer: () => void;
}) {
  /** Yon koli ka fakti sèlman si li Disponible epi li poko fakti. */
  const facturable = (p: Pkg) => p.status === "Disponible" && !p.invoice_id;
  const choisis = (pkgs ?? []).filter((p) => sel.has(p.id));
  const totalSel = choisis.reduce((s, p) => s + (Number(p.weight) || 0), 0);

  return (
    <>
      <tr onClick={onToggle} className={`cursor-pointer hover:bg-blue-50 ${zebra ? "bg-mist" : ""}`}>
        <td className="td whitespace-nowrap">{dateFr(r.created_at)}</td>
        <td className="td font-bold text-navy">{r.customer_code}</td>
        <td className="td">{r.customer_name}</td>
        <td className="td">{r.ville || "—"}</td>
        <td className="td text-right">{r.package_count}</td>
        <td className="td text-right">{Number(r.total_weight).toFixed(2)}</td>
        <td className="td"><span className={`badge ${BADGE[r.status]}`}>{r.status}</span></td>
        <td className="td whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {STATUTS.filter((s) => s !== r.status).map((s) => (
            <button key={s} onClick={() => onStatus(s)}
              className="text-navy hover:underline text-xs font-semibold mr-3">
              → {s}
            </button>
          ))}
        </td>
      </tr>

      {open && (
        <tr className="bg-blue-50/50">
          <td colSpan={8} className="px-8 py-3">
            {loading && !pkgs ? (
              <p className="py-4 text-center text-xs text-mute flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Chargement des colis…
              </p>
            ) : (pkgs ?? []).length === 0 ? (
              <p className="py-4 text-center text-xs text-mute">
                Aucun colis trouvé dans la base pour cette demande (déjà facturés ou supprimés).
              </p>
            ) : (
              <>
                <table className="w-full text-xs">
                  <thead><tr className="text-slate-500 text-left">
                    <th className="py-1 pr-2 w-8"></th>
                    <th className="py-1 pr-3">Tracking ID (Guía)</th>
                    <th className="py-1 pr-3">Tracking Number</th>
                    <th className="py-1 pr-3">Contenu</th>
                    <th className="py-1 pr-3">Statut</th>
                    <th className="py-1 text-right">Poids (lb)</th>
                  </tr></thead>
                  <tbody>
                    {(pkgs ?? []).map((p) => {
                      const ok = facturable(p);
                      return (
                        <tr key={p.id} className={`border-t border-line/60 ${ok ? "" : "opacity-50"}`}>
                          <td className="py-1 pr-2">
                            <input type="checkbox" disabled={!ok}
                              checked={sel.has(p.id)} onChange={() => onToggleSel(p.id)}
                              title={ok ? "Sélectionner pour facturer" : "Colis non disponible ou déjà facturé"} />
                          </td>
                          <td className="py-1 pr-3 font-mono">{p.tracking_number}</td>
                          <td className="py-1 pr-3 font-mono">{p.tracking_manual || "—"}</td>
                          <td className="py-1 pr-3">{p.content || "—"}</td>
                          <td className="py-1 pr-3">
                            {p.invoice_id
                              ? <span className="text-emerald-700 font-semibold">Facturé — {usd(p.total_usd)}</span>
                              : p.status}
                          </td>
                          <td className="py-1 text-right">{Number(p.weight).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-line/60">
                  <p className="text-[11px] text-mute">
                    {choisis.length
                      ? <>{choisis.length} colis sélectionné(s) · {totalSel.toFixed(2)} lb</>
                      : <>Cochez les colis <b>Disponible</b> à facturer.</>}
                  </p>
                  <button className="btn !py-1.5 !px-3 !text-xs disabled:opacity-40"
                    disabled={!choisis.length || loading} onClick={onFacturer}>
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                    Facturer ({choisis.length})
                  </button>
                </div>
              </>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
