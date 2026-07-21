"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, CheckCircle2, RefreshCw, FileText, X } from "lucide-react";
import { parseMcpackWorkbook } from "@/lib/xlsx";
import { parseMcpackPdf, PdfPkgRow } from "@/lib/pdfimport";
import {
  commitPdfImport, commitSync, getClients, getImports, getSettings,
  getVilles, logAction, previewSync, SyncPreview
} from "@/lib/db";
import { Client, ImportLog, Ville } from "@/lib/types";
import { dateFr } from "@/lib/utils";

export default function SyncPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState("");
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [villes, setVilles] = useState<Ville[]>([]);
  const [autoPricing, setAutoPricing] = useState(true);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ImportLog | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [pdfRows, setPdfRows] = useState<PdfPkgRow[] | null>(null);   // modal chwazi kliyan
  const [pdfName, setPdfName] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [pdfClient, setPdfClient] = useState("");
  const [pdfDone, setPdfDone] = useState<string | null>(null);

  const loadSide = async () => {
    const [v, s, l, c] = await Promise.all([getVilles(), getSettings(), getImports(), getClients()]);
    setVilles(v); setClients(c);
    setAutoPricing(s.auto_pricing !== "false");
    setLogs(l);
  };
  useEffect(() => { loadSide().catch((e) => setErr(e.message)); }, []);

  const handlePdf = async (f: File) => {
    setErr(null); setPdfDone(null); setPdfName(f.name); setBusy(true);
    try {
      const rows = await parseMcpackPdf(await f.arrayBuffer());
      if (!rows.length) { setErr("Aucun colis détecté dans le PDF. Vérifiez que c'est bien un PDF MCPACK."); return; }
      setPdfRows(rows); setPdfClient("");
    } catch (e: any) {
      setErr("Erè lekti PDF: " + (e.message ?? String(e)));
    } finally { setBusy(false); }
  };

  const validerPdf = async () => {
    if (!pdfRows || !pdfClient) return;
    const client = clients.find((c) => c.id === pdfClient);
    if (!client) return;
    setBusy(true);
    try {
      const r = await commitPdfImport(pdfRows, client, autoPricing);
      setPdfDone(`✅ Import PDF réussi: ${r.created} créés, ${r.updated} mis à jour, ${r.ignored} ignorés — client ${client.customer_code}.`);
      setPdfRows(null); setPdfClient(""); setPdfName("");
      if (pdfRef.current) pdfRef.current.value = "";
      await loadSide();
    } catch (e: any) { setErr("Erè: " + e.message); }
    finally { setBusy(false); }
  };

  const handleFile = async (f: File) => {
    setErr(null); setDone(null); setPreview(null); setFilename(f.name); setBusy(true);
    try {
      const rows = parseMcpackWorkbook(await f.arrayBuffer());
      if (!rows.length) {
        setErr("Sistèm nan pa jwenn kolòn MCPACK yo (Cliente, Guia, Peso...) nan fichye a. Verifye se bon Exportar XLS la.");
        return;
      }
      setPreview(await previewSync(rows));
    } catch (e: any) {
      setErr("Erè lekti fichye: " + (e.message ?? String(e)));
    } finally { setBusy(false); }
  };

  const valider = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const log = await commitSync(preview, filename, autoPricing);
      await logAction("Synchronisation MCPACK",
        `${filename}: ${log.new_packages} nouveaux, ${log.existing_packages} existants, ${log.new_clients} clients, ${log.errors} erreurs`);
      setDone(log); setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      await loadSide();
    } catch (e: any) {
      setErr("Erè importation: " + (e.message ?? String(e)));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-xl font-extrabold text-navy">Synchronisation MCPACK</h1>

      <div className="card p-6">
        <p className="text-sm text-slate-600 mb-4">
          1. Sou MCPACK, klike <b>Exportar XLS</b>. &nbsp;2. Chwazi fichye a isit la. &nbsp;
          3. Verifye rezime a epi <b>Valider Importation</b>. Doublon yo (menm Guia/Tracking) p ap janm ajoute 2 fwa.
        </p>
        <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-line rounded-xl py-10 cursor-pointer hover:border-navy-light transition-colors">
          <Upload className="text-navy-light" />
          <span className="text-sm font-semibold text-navy">Synchroniser MCPACK — chwazi fichye Excel la</span>
          <span className="text-xs text-slate-400">.xls / .xlsx {filename && `— ${filename}`}</span>
          <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={autoPricing} onChange={(e) => setAutoPricing(e.target.checked)} />
          Appliquer la tarification automatique sur les nouveaux colis (selon la ville du client)
          {!villes.some((v) => v.active) && <span className="text-xs text-amber-600">(poko gen vil aktif — Paramètres &gt; Tarification)</span>}
        </label>
      </div>

      {/* ===== IMPORT PDF MCPACK (V8 Faz 2) ===== */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={16} className="text-navy-light" />
          <h2 className="text-sm font-bold text-navy">Import PDF MCPACK</h2>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Pataje oswa telechaje yon PDF ki soti nan MCPACK. Sistèm nan ap li Guía, Tracking Number,
          Poids, Contenu, Date, Heure ak Estatus otomatikman. Kòm PDF MCPACK yo <b>pa gen Customer Code</b>,
          w ap chwazi kliyan an apre analiz la.
        </p>
        <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-line rounded-xl py-8 cursor-pointer hover:border-navy-light transition-colors">
          <FileText className="text-navy-light" />
          <span className="text-sm font-semibold text-navy">Import PDF — chwazi fichye PDF la</span>
          <span className="text-xs text-slate-400">.pdf {pdfName && `— ${pdfName}`}</span>
          <input ref={pdfRef} type="file" accept="application/pdf,.pdf" className="hidden"
            onChange={(e) => e.target.files?.[0] && handlePdf(e.target.files[0])} />
        </label>
        {pdfDone && <p className="mt-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">{pdfDone}</p>}
      </div>

      {busy && !preview && !pdfRows && <p className="text-sm text-slate-500">Analyse en cours...</p>}
      {err && <p className="card px-4 py-3 text-sm text-red-600">{err}</p>}

      {/* ===== Modal: chwazi kliyan pou koli PDF yo ===== */}
      {pdfRows && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setPdfRows(null)}>
          <div className="card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-navy uppercase tracking-wide">
                Import PDF — {pdfRows.length} colis détectés
              </h2>
              <button className="text-slate-400 hover:text-navy" onClick={() => setPdfRows(null)}><X size={18} /></button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              ⚠️ Aucun Customer Code détecté. Veuillez sélectionner le client concerné :
            </div>
            <select className="input w-full" value={pdfClient} onChange={(e) => setPdfClient(e.target.value)}>
              <option value="">— Sélectionner le client —</option>
              {clients.filter((c) => c.customer_code).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_code} — {[c.fullname, c.surname].filter(Boolean).join(" ")}
                </option>
              ))}
            </select>

            <div className="border border-line rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0"><tr>
                  {["Guía", "Tracking", "Lb", "Contenu", "Date", "Heure", "Estatus"].map((h) =>
                    <th key={h} className="thc">{h}</th>)}
                </tr></thead>
                <tbody>
                  {pdfRows.map((r, i) => (
                    <tr key={i} className={i % 2 ? "bg-mist" : ""}>
                      <td className="tdc font-mono text-[11px]">{r.guia}</td>
                      <td className="tdc font-mono text-[11px]">{r.tracking_number}</td>
                      <td className="tdc text-right">{r.weight.toFixed(2)}</td>
                      <td className="tdc max-w-[110px] truncate" title={r.content}>{r.content}</td>
                      <td className="tdc whitespace-nowrap">{r.created_date}</td>
                      <td className="tdc whitespace-nowrap">{r.heure}</td>
                      <td className="tdc max-w-[120px] truncate" title={r.status_raw}>{r.status_raw}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <button className="btn" onClick={validerPdf} disabled={busy || !pdfClient}>
                {busy ? "Import en cours..." : `Importer ${pdfRows.length} colis`}
              </button>
              <button className="btn btn-ghost" onClick={() => setPdfRows(null)}>Annuler</button>
            </div>
            <p className="text-[11px] text-slate-400">
              Anti-doublon: koli ki gen menm Tracking Number deja nan sistèm nan p ap kreye 2 fwa.
            </p>
          </div>
        </div>
      )}

      {preview && (
        <div className="card p-6">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-4">Résultat de l'analyse — {filename}</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            {[["Lignes analysées", preview.totalRows],
              ["Nouveaux colis", preview.newRows.length],
              ["Colis existants", preview.existing],
              ["Nouveaux clients", preview.newClientCodes.length],
              ["Erreurs", preview.errors]].map(([l, v]) => (
              <div key={l as string} className="bg-mist rounded-lg py-3">
                <p className="text-2xl font-extrabold text-navy">{v}</p>
                <p className="text-xs text-slate-500">{l}</p>
              </div>
            ))}
          </div>
          {preview.newRows.length > 0 && (
            <div className="mt-4 max-h-64 overflow-auto border border-line rounded-lg">
              <table className="w-full text-xs">
                <thead><tr>{["Cliente", "Guia", "Peso", "Cant", "Contenido", "Creado"].map((h) =>
                  <th key={h} className="th !py-2">{h}</th>)}</tr></thead>
                <tbody>{preview.newRows.map((r, i) => (
                  <tr key={r.tracking_number} className={i % 2 ? "bg-mist" : ""}>
                    <td className="td">{r.customer_code} — {r.customer_name}</td>
                    <td className="td font-mono">{r.tracking_number}</td>
                    <td className="td">{r.weight}</td>
                    <td className="td">{r.quantity}</td>
                    <td className="td">{r.content}</td>
                    <td className="td">{r.created_date}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
          <button className="btn mt-4" onClick={valider} disabled={busy || preview.newRows.length === 0}>
            <CheckCircle2 size={15} /> {busy ? "Importation..." : `Valider Importation (${preview.newRows.length} colis)`}
          </button>
        </div>
      )}

      {done && (
        <div className="card p-5 bg-emerald-50 border-emerald-200 space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 font-bold">
            <CheckCircle2 size={20} /> Synchronisation terminée avec succès
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            {([["Nouveaux packages", done.new_packages, "text-emerald-700"],
               ["Packages mis à jour", done.existing_packages, "text-blue-700"],
               ["Nouveaux clients", done.new_clients, "text-teal-700"],
               ["Erreurs", done.errors, done.errors > 0 ? "text-red-600" : "text-slate-500"]] as const).map(([k, v, c]) => (
              <div key={k} className="bg-white rounded-lg py-3 border border-emerald-100">
                <p className={`text-2xl font-extrabold ${c}`}>{v}</p>
                <p className="text-[11px] text-slate-500 uppercase mt-0.5">{k}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-emerald-700">Enregistré dans le Journal. Les doublons (même Guía / Tracking) ont été ignorés automatiquement.</p>
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="px-4 py-3 border-b border-line flex items-center gap-2">
          <RefreshCw size={14} className="text-navy-light" />
          <h2 className="text-sm font-bold text-navy">Historique des imports</h2>
        </div>
        <table className="w-full text-sm">
          <thead><tr>{["Date", "Fichier", "Lignes", "Nouveaux", "Existants", "Nouveaux clients", "Erreurs"]
            .map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-slate-400">Aucun import pour le moment.</td></tr>
            ) : logs.map((l, i) => (
              <tr key={l.id} className={i % 2 ? "bg-mist" : ""}>
                <td className="td">{dateFr(l.created_at)}</td>
                <td className="td">{l.filename}</td>
                <td className="td">{l.total_rows}</td>
                <td className="td font-semibold text-emerald-700">{l.new_packages}</td>
                <td className="td">{l.existing_packages}</td>
                <td className="td">{l.new_clients}</td>
                <td className="td">{l.errors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
