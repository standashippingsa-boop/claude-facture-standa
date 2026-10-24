"use client";
import { useEffect, useState } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { openSecureDocument } from "@/lib/secure-document";
import { notify } from "@/lib/notify";

type ReportRow = { id: string; created_at: string; user_name: string; details: string };

/**
 * RAPPORTS DES AGENCES — rapports PDF envoyés par les points de retrait
 * (journal « Rapport agence (PDF) », fichier dans le stockage privé).
 * Le PDF s'ouvre via /api/documents/agent-report/<id> (administration seulement).
 */
export default function AgentReportsList() {
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = async () => {
    const { data, error } = await supabase.from("journal").select("id, created_at, user_name, details")
      .eq("action", "Rapport agence (PDF)").order("created_at", { ascending: false }).limit(40);
    setRows(error ? [] : (data ?? []) as ReportRow[]);
  };
  useEffect(() => { void load(); }, []);
  const open = async (id: string) => {
    setBusyId(id);
    try { await openSecureDocument("agent-report", id); }
    catch (error) { notify.error(error instanceof Error ? error.message : "PDF indisponible.", { title: "Rapport" }); }
    finally { setBusyId(null); }
  };
  return <section id="rapports" className="card scroll-mt-20 overflow-hidden">
    <div className="flex items-start justify-between gap-3 border-b border-line p-4">
      <div><h2 className="h-sec">Rapports des agences</h2><p className="mt-1 text-xs text-mute">Rapports PDF envoyés par les points de retrait après leurs remises (caisse, moyens de paiement, colis remis, soldes).</p></div>
      <button type="button" onClick={() => void load()} aria-label="Actualiser" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><RefreshCw size={15} /></button>
    </div>
    {rows === null ? <div className="h-24 animate-pulse bg-slate-50" /> : rows.length ? <div className="max-h-96 divide-y divide-line overflow-auto">{rows.map((row) => {
      const [zone, ...rest] = String(row.details ?? "").split(" — ");
      return <div key={row.id} className="flex items-center gap-3 px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange-50 text-[#e85e19]"><FileText size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-navy">{zone} · {String(row.user_name ?? "").replace(" · agent_retrait", "")}</p>
          <p className="truncate text-xs text-mute">{new Date(row.created_at).toLocaleString("fr-FR")} · {rest.join(" — ")}</p>
        </div>
        <button type="button" disabled={busyId === row.id} onClick={() => void open(row.id)} className="btn btn-ghost !py-1.5 text-xs">{busyId === row.id ? "…" : "Ouvrir le PDF"}</button>
      </div>;
    })}</div> : <p className="py-8 text-center text-sm text-slate-400">Aucun rapport reçu pour le moment.</p>}
  </section>;
}
