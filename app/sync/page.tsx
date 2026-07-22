"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, CheckCircle2, RefreshCw, FileText, X, Image } from "lucide-react";
import { parseMcpackWorkbook } from "@/lib/xlsx";
import { scanPhotos } from "@/lib/photoscan";
import {
  commitSync, getClients, getImports, getSettings,
  getVilles, logAction, analyzePhotoScans, applyPhotoValidations, logOcrScans, PhotoMatch, previewSync, SyncPreview
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
  const [clients, setClients] = useState<Client[]>([]);
  const photoRef = useRef<HTMLInputElement>(null);
  const [scans, setScans] = useState<PhotoMatch[] | null>(null);
  const [scanProg, setScanProg] = useState("");
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [applyDone, setApplyDone] = useState<string | null>(null);

  const toggleAccept = (f: string) => setAccepted((prev) => {
    const n = new Set(prev); n.has(f) ? n.delete(f) : n.add(f); return n;
  });

  const validerPhotos = async () => {
    if (!scans) return;
    const items = scans.filter((s) => accepted.has(s.filename) && s.matched);
    if (!items.length) { setErr("Okenn foto valide ki matche yon koli."); return; }
    setBusy(true);
    try {
      const r = await applyPhotoValidations(items);
      setApplyDone(`✅ ${r.received} colis marqués reçus${r.trackingAdded ? `, ${r.trackingAdded} Tracking Number ajoutés` : ""}.`);
      setScans(null); setAccepted(new Set());
    } catch (e: any) { setErr("Erè: " + e.message); }
    finally { setBusy(false); }
  };

  const loadSide = async () => {
    const [v, s, l, c] = await Promise.all([getVilles(), getSettings(), getImports(), getClients()]);
    setVilles(v); setClients(c);
    setAutoPricing(s.auto_pricing !== "false");
    setLogs(l);
  };
  useEffect(() => { loadSide().catch((e) => setErr(e.message)); }, []);

  const handlePhotos = async (files: FileList) => {
    setErr(null); setScans(null); setBusy(true);
    const arr = Array.from(files);
    try {
      setScanProg(`Analyse de ${arr.length} photo(s)...`);
      const raw = await scanPhotos(arr, (idx, total, p) =>
        setScanProg(`Photo ${idx + 1}/${total} — ${Math.round(p * 100)}%`));
      const analyzed = await analyzePhotoScans(raw.map((r) => ({
        filename: r.filename, previewUrl: r.previewUrl, guia: r.guia, guiaSource: r.guiaSource,
        tracking_number: r.tracking_number, customer_code: r.customer_code,
        confidence: r.confidence, step: r.step
      })));
      await logOcrScans(analyzed);
      setScans(analyzed);
      // Pre-seleksyone sèlman sa ki "validated" (konfyans wo, san enkoyerans)
      setAccepted(new Set(analyzed.filter((a) => a.verdict === "validated").map((a) => a.filename)));
      setScanProg("");
    } catch (e: any) {
      setErr("Erè analiz foto: " + (e.message ?? String(e)));
    } finally { setBusy(false); }
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

      {/* ===== ANALYSE PHOTOS DES COLIS (V8 Faz 3) ===== */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-3">
          <Image size={16} className="text-navy-light" />
          <h2 className="text-sm font-bold text-navy">Analyse Photos des Colis</h2>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Ajoute plizyè foto etikèt koli yo ansanm. Sistèm nan ap li Customer Code, Tracking Number
          ak Guía sou chak etikèt, epi konpare yo ak bazdone a. Koli ki <b className="text-emerald-700">deja resevwa</b> nan
          MCPACK ap parèt an <b className="text-emerald-700">vèt</b>. Sa ede w idantifye koli ki rive menm san lis MCPACK.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl py-6 cursor-pointer hover:border-navy-light transition-colors">
            <Image className="text-navy-light" />
            <span className="text-sm font-semibold text-navy">Chwazi foto yo</span>
            <span className="text-xs text-slate-400">plizyè imaj</span>
            <input ref={photoRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => e.target.files?.length && handlePhotos(e.target.files)} />
          </label>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl py-6 cursor-pointer hover:border-navy-light transition-colors">
            <FileText className="text-navy-light" />
            <span className="text-sm font-semibold text-navy">Chwazi yon DOSYE koli</span>
            <span className="text-xs text-slate-400">non dosye a = dat rive a</span>
            <input type="file" accept="image/*" multiple {...({ webkitdirectory: "" } as any)}
              className="hidden" onChange={(e) => e.target.files?.length && handlePhotos(e.target.files)} />
          </label>
        </div>
        {scanProg && <p className="mt-3 text-sm text-navy-light flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> {scanProg}</p>}

        {applyDone && <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">{applyDone}</p>}

        {scans && (() => {
          const ok = scans.filter((s) => s.verdict === "validated");
          const rev = scans.filter((s) => s.verdict === "review");
          return (
            <div className="mt-4 space-y-3">
              {/* Rezime */}
              <div className="flex gap-4 text-sm flex-wrap items-center">
                <span className="text-emerald-700 font-semibold">🟢 {ok.length} validées</span>
                <span className="text-amber-700 font-semibold">🟡 {rev.length} à vérifier</span>
                <span className="text-slate-500">Sélectionnées: {accepted.size}</span>
                <div className="flex-1" />
                <button className="btn" onClick={validerPhotos} disabled={busy || !accepted.size}>
                  Importer {accepted.size} colis validé(s)
                </button>
              </div>

              {/* Tablo validasyon — Aksepte / Rejte chak foto */}
              <div className="border border-line rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr>
                    <th className="thc">✔</th>
                    {["Aperçu", "Tracking ID (Guía)", "Tracking Number", "Customer Code", "Confiance", "Résultat"]
                      .map((h) => <th key={h} className="thc">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {scans.map((s, i) => (
                      <tr key={i} className={
                        s.verdict === "validated" ? "!bg-emerald-50"
                        : s.incoherences.length ? "!bg-amber-50" : i % 2 ? "bg-mist" : ""}>
                        <td className="tdc">
                          <input type="checkbox" checked={accepted.has(s.filename)}
                            disabled={!s.matched} onChange={() => toggleAccept(s.filename)} />
                        </td>
                        <td className="tdc">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s.previewUrl} alt={s.filename} className="w-12 h-12 object-cover rounded border border-line" />
                        </td>
                        <td className="tdc font-mono text-[11px]">
                          {s.guia || <span className="text-slate-300">—</span>}
                          {s.guiaSource === "barcode" && <span className="ml-1 badge bg-blue-100 text-blue-700">code-barres</span>}
                        </td>
                        <td className="tdc font-mono text-[11px]">{s.tracking_number || s.matchedManual || <span className="text-slate-300">—</span>}</td>
                        <td className="tdc font-bold text-navy">{s.matchedCode || s.customer_code || "—"}</td>
                        <td className="tdc">
                          <span className={`badge ${s.confidence >= 90 ? "bg-emerald-100 text-emerald-700"
                            : s.confidence >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                            {Math.round(s.confidence)}%
                          </span>
                        </td>
                        <td className="tdc max-w-[260px]">
                          <span className={s.verdict === "validated" ? "text-emerald-700" : "text-amber-800"}>
                            {s.verdict === "validated" ? "🟢 " : "🟡 "}{s.message}
                          </span>
                          {s.incoherences.map((m, j) => (
                            <span key={j} className="block text-[11px] text-amber-700">⚠️ {m}</span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400">
                Scanner a <b>pa devine</b>: barcode an premye (≥98% konfyans), answit Tracking ID nan tèks,
                answit Tracking Number nan zòn dedye a. Okenn koli pa antre san ou valide l. Pwa foto a pa itilize —
                pwa ofisyèl la rete sa ki nan sistèm nan. Tout analiz antre nan Journal OCR.
              </p>
            </div>
          );
        })()}
      </div>

      {busy && !preview && <p className="text-sm text-slate-500">Analyse en cours...</p>}
      {err && <p className="card px-4 py-3 text-sm text-red-600">{err}</p>}

      {/* ===== Modal: chwazi kliyan pou koli PDF yo ===== */}
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
