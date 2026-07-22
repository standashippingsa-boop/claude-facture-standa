"use client";
import { useEffect, useMemo, useState } from "react";
import { History, Trash2, Filter } from "lucide-react";
import Pagination from "@/components/Pagination";
import { JournalRow, clearJournal, getJournal } from "@/lib/db";
import { useRole } from "@/lib/authx";

const PER_PAGE = 30;

/** Kalite aksyon yo (pou filtre) — badge koulè pou chak. */
const ACTION_STYLES: Record<string, string> = {
  "Import PDF": "bg-purple-100 text-purple-700",
  "Import Excel": "bg-indigo-100 text-indigo-700",
  "Synchronisation MCPACK": "bg-blue-100 text-blue-700",
  "Analyse Photo": "bg-cyan-100 text-cyan-700",
  "Création Package": "bg-emerald-100 text-emerald-700",
  "Modification Package": "bg-amber-100 text-amber-700",
  "Changement Statut": "bg-orange-100 text-orange-700",
  "Modification Prix": "bg-pink-100 text-pink-700",
  "Facturation": "bg-navy/10 text-navy",
  "Activation Client": "bg-teal-100 text-teal-700"
};

export default function JournalPage() {
  const { role } = useRole();
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setRows(await getJournal()); } catch (e: any) { setNotice("Erè: " + e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const actions = useMemo(() => Array.from(new Set(rows.map((r) => r.action))).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      (!action || r.action === action) &&
      (!q || r.user_name.toLowerCase().includes(q) || r.details.toLowerCase().includes(q)
        || r.customer_code.toLowerCase().includes(q) || r.package_ref.toLowerCase().includes(q)));
  }, [rows, search, action]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const view = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  useEffect(() => { setPage(1); }, [search, action]);

  const clear = async () => {
    if (!confirm("Efase TOUT jounal la? Aksyon sa a definitif.")) return;
    try { await clearJournal(); setNotice("✅ Journal effacé."); load(); }
    catch (e: any) { setNotice("Erè: " + e.message); }
  };

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return { d: d.toLocaleDateString("fr-FR"), h: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-extrabold text-navy flex items-center gap-2"><History size={20} /> Journal des modifications</h1>
        <span className="badge bg-slate-100 text-slate-600">{filtered.length}</span>
        <div className="flex-1" />
        {role === "admin" && (
          <button className="btn btn-ghost border border-line text-red-600" onClick={clear}>
            <Trash2 size={15} /> Effacer le journal
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <input className="input flex-1 min-w-[200px]" placeholder="Rechercher: utilisateur, détail, code, colis..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-slate-400" />
          <select className="input !w-52" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Toutes les actions</option>
            {actions.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr>
            {["Date", "Heure", "Utilisateur", "Action", "Détails", "Colis", "Client"].map((h) =>
              <th key={h} className="thc">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-slate-400">Ap chaje...</td></tr>
            ) : view.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-slate-400">Pa gen anrejistreman.</td></tr>
            ) : view.map((r, i) => {
              const t = fmt(r.created_at);
              return (
                <tr key={r.id} className={i % 2 ? "bg-mist" : ""}>
                  <td className="tdc whitespace-nowrap">{t.d}</td>
                  <td className="tdc whitespace-nowrap">{t.h}</td>
                  <td className="tdc max-w-[150px] truncate" title={r.user_name}>{r.user_name || "—"}</td>
                  <td className="tdc"><span className={`badge ${ACTION_STYLES[r.action] ?? "bg-slate-100 text-slate-600"}`}>{r.action}</span></td>
                  <td className="tdc max-w-[240px] truncate" title={r.details}>{r.details || "—"}</td>
                  <td className="tdc font-mono text-[11px]">{r.package_ref || "—"}</td>
                  <td className="tdc font-bold text-navy">{r.customer_code || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination page={page} pages={pages} onPage={setPage} />
      </div>

      {notice && <p className="card px-4 py-3 text-sm text-navy">{notice}</p>}
    </div>
  );
}
