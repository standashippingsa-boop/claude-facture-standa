"use client";
import { useEffect, useMemo, useState } from "react";
import Loader from "@/components/Loader";
import { History, Trash2, Eye } from "lucide-react";
import RefreshButton from "@/components/RefreshButton";
import Pagination from "@/components/Pagination";
import FilterConsole from "@/components/FilterConsole";
import { JournalRow, clearJournal, getJournal } from "@/lib/db";
import { useRole } from "@/lib/authx";
import { useRememberListContext } from "@/lib/list-context";

const PER_PAGE = 30;

/** Kalite aksyon yo (pou filtre) — badge koulè pou chak. */
const ACTION_STYLES: Record<string, string> = {
  "Import PDF": "bg-purple-100 text-purple-700",
  "Import Excel": "bg-indigo-100 text-indigo-700",
  "Synchronisation MCPACK": "bg-blue-100 text-blue-700",
  "Analyse Photo": "bg-cyan-100 text-cyan-700",
  "Photo non identifiée": "bg-red-100 text-red-700",
  "Import Facture": "bg-green-100 text-green-700",
  "Import Facture → Disponible": "bg-green-100 text-green-700",
  "Création Package": "bg-emerald-100 text-emerald-700",
  "Modification Package": "bg-amber-100 text-amber-700",
  "Changement Statut": "bg-orange-100 text-orange-700",
  "Modification Prix": "bg-pink-100 text-pink-700",
  "Facturation": "bg-navy/10 text-navy",
  "Activation Client": "bg-teal-100 text-teal-700",
  "Paiement client reçu": "bg-emerald-100 text-emerald-800",
  "Colis remis": "bg-sky-100 text-sky-800",
  "Bon de remise reçu": "bg-blue-100 text-blue-800"
};

/** Rezime lizib yon User-Agent brit — pou tooltip Audit Log Enterprise. */
function shortUA(ua: string): string {
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navigateur";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" :
    /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return [browser, os].filter(Boolean).join(" · ");
}

export default function JournalPage() {
  const { role } = useRole();
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [userF, setUserF] = useState("");
  const [customerF, setCustomerF] = useState("");
  const [fromF, setFromF] = useState("");
  const [toF, setToF] = useState("");
  const [page, setPage] = useState(1);
  useRememberListContext("journal", { search, action, userF, customerF, fromF, toF, page }, (saved) => {
    const text = (name: string) => typeof saved[name] === "string" ? saved[name] : "";
    setSearch(text("search")); setAction(text("action")); setUserF(text("userF")); setCustomerF(text("customerF"));
    setFromF(text("fromF")); setToF(text("toF"));
    setPage(typeof saved.page === "number" && saved.page > 0 ? saved.page : 1);
  });
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
      (!userF || r.user_name === userF) &&
      (!customerF || r.customer_code === customerF) &&
      (!fromF || String(r.created_at ?? "").slice(0, 10) >= fromF) &&
      (!toF || String(r.created_at ?? "").slice(0, 10) <= toF) &&
      (!q || r.user_name.toLowerCase().includes(q) || r.details.toLowerCase().includes(q)
        || r.customer_code.toLowerCase().includes(q) || r.package_ref.toLowerCase().includes(q)));
  }, [rows, search, action, userF, customerF, fromF, toF]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const view = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  useEffect(() => { setPage(1); }, [search, action, userF, customerF, fromF, toF]);
  const clearFilters = () => { setSearch(""); setAction(""); setUserF(""); setCustomerF(""); setFromF(""); setToF(""); };
  const userOptions = Array.from(new Set(rows.map((row) => row.user_name).filter(Boolean))).sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }));
  const customerOptions = Array.from(new Set(rows.map((row) => row.customer_code).filter(Boolean))).sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }));

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
        <RefreshButton onRefresh={load} />
        {role === "admin" && (
          <button className="btn btn-ghost border border-line text-red-600" onClick={clear}>
            <Trash2 size={15} /> Effacer le journal
          </button>
        )}
      </div>

      <FilterConsole query={search} onQueryChange={setSearch} queryPlaceholder="Utilisateur, détail, code, colis…"
        resultCount={filtered.length} onClear={clearFilters}
        fields={[
          { key: "action", label: "Action", type: "select", value: action, onChange: setAction, options: actions.map((value) => ({ value, label: value })) },
          { key: "user", label: "Utilisateur", type: "select", value: userF, onChange: setUserF, options: userOptions },
          { key: "customer", label: "Code client", type: "select", value: customerF, onChange: setCustomerF, options: customerOptions },
          { key: "from", label: "À partir du", type: "date", value: fromF, onChange: setFromF },
          { key: "to", label: "Jusqu'au", type: "date", value: toF, onChange: setToF },
        ]} />

      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr>
            {["Date", "Heure", "Utilisateur", "Action", "Détails", "Colis", "Client"].map((h) =>
              <th key={h} className="thc">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-4"><Loader inline size={56} /></td></tr>
            ) : view.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-slate-400">Pa gen anrejistreman.</td></tr>
            ) : view.map((r, i) => {
              const t = fmt(r.created_at);
              return (
                <tr key={r.id} className={i % 2 ? "bg-mist" : ""}>
                  <td className="tdc whitespace-nowrap">{t.d}</td>
                  <td className="tdc whitespace-nowrap">{t.h}</td>
                  <td className="tdc max-w-[150px] truncate"
                    title={[r.user_name, r.ip_address && `IP: ${r.ip_address}`, r.user_agent && shortUA(r.user_agent)]
                      .filter(Boolean).join(" · ")}>
                    {r.user_name || "—"}
                  </td>
                  <td className="tdc"><span className={`badge ${ACTION_STYLES[r.action] ?? "bg-slate-100 text-slate-600"}`}>{r.action}</span></td>
                  <td className="tdc max-w-[240px]">
                    {(() => {
                      const m = r.details?.match(/photo:(https?:\/\/\S+)/);
                      const clean = r.details?.replace(/\s*\|\s*photo:https?:\/\/\S+/, "") || "—";
                      return (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate" title={clean}>{clean}</span>
                          {m && (
                            <a href={m[1]} target="_blank" rel="noreferrer"
                              className="shrink-0 inline-flex items-center gap-1 text-navy hover:underline font-semibold text-[11px]">
                              <Eye size={12} /> Voir photo
                            </a>
                          )}
                        </div>
                      );
                    })()}
                  </td>
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
