"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, CheckCircle2, RefreshCw, FileText, X, Image } from "lucide-react";
import { parseMcpackWorkbook } from "@/lib/xlsx";
import { scanPhotos } from "@/lib/photoscan";
import { extractFacture, extractFromText } from "@/lib/factureimport";
import {
  commitSync, getClients, getImports, getSettings,
  getVilles, logAction, analyzePhotoScans, applyPhotoValidations, logOcrScans, PhotoMatch,
  matchFactureTrackings, FactureMatch, commitFactureDisponible, uploadScanPhoto, previewSync, SyncPreview, undoLastImport
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
  const [lastBatch, setLastBatch] = useState<string | null>(null);
  // ===== Import Facture MCPACK (pwen #6a) =====
  const factureRef = useRef<HTMLInputElement>(null);
  const [factures, setFactures] = useState<FactureMatch[] | null>(null);
  const [factProg, setFactProg] = useState("");
  const [factureText, setFactureText] = useState("");
  const [corrections, setCorrections] = useState<Record<string, string>>({});

  /** RÈG N°8 — Annuler la dernière importation */
  const annulerImport = async () => {
    if (!confirm("Annuler la dernière importation photo? Les colis reviendront à leur état précédent.")) return;
    setBusy(true);
    try {
      const r = await undoLastImport();
      setApplyDone(r.ok
        ? `↩️ Importation ${r.batchId} annulée — ${r.restored} colis restaurés.`
        : `⚠️ ${r.reason}`);
      setLastBatch(null);
    } catch (e: any) { setErr("Erè: " + e.message); }
    finally { setBusy(false); }
  };

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
      setLastBatch(r.batchId);
      setApplyDone(`✅ Importation ${r.batchId}: ${r.received} colis marqués reçus${r.trackingAdded ? `, ${r.trackingAdded} Tracking Number ajoutés` : ""}.`);
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
      // Telechaje SÈLMAN foto ki pa idantifye yo (pou admin ka ouvri yo pita nan Journal)
      const urls: Record<string, string> = {};
      const nonId = analyzed.filter((a) => !a.matched);
      for (let i = 0; i < nonId.length; i++) {
        const f = arr.find((x) => x.name === nonId[i].filename);
        if (!f) continue;
        setScanProg(`Sauvegarde photo non identifiée ${i + 1}/${nonId.length}...`);
        const u = await uploadScanPhoto(f);
        if (u) urls[nonId[i].filename] = u;
      }
      await logOcrScans(analyzed, urls);
      setScans(analyzed);
      // Pre-seleksyone sèlman sa ki "validated" (konfyans wo, san enkoyerans)
      // MODE ZÉRO RISQUE: pre-koche SÈLMAN sa ki gen konfyans ≥98% e zewo konfli
      setAccepted(new Set(analyzed.filter((a) => a.canApply).map((a) => a.filename)));
      setScanProg("");
    } catch (e: any) {
      setErr("Erè analiz foto: " + (e.message ?? String(e)));
    } finally { setBusy(false); }
  };

  // ===== Import Facture MCPACK — ekstrè + match (pwen #6a, READ-ONLY) =====
  const handleFactures = async (files: FileList) => {
    setErr(null); setFactures(null); setBusy(true);
    try {
      const arr = Array.from(files);
      const all: { value: string; weight?: number; source: "pdf" | "image" | "text" }[] = [];
      for (let i = 0; i < arr.length; i++) {
        setFactProg(`Fichier ${i + 1}/${arr.length} — ${arr[i].name}...`);
        const items = await extractFacture(arr[i], (p) =>
          setFactProg(`Fichier ${i + 1}/${arr.length} — ${Math.round(p * 100)}%`));
        all.push(...items);
      }
      // dedoublonnen sou tracking
      const seen = new Set<string>();
      const uniq = all.filter((t) => { const k = t.value.toUpperCase(); if (seen.has(k)) return false; seen.add(k); return true; });
      setFactProg("Vérification des correspondances...");
      const matched = await matchFactureTrackings(uniq);
      setFactures(matched);
      setFactProg("");
    } catch (e: any) {
      setErr("Erè import facture: " + (e.message ?? String(e)));
    } finally { setBusy(false); }
  };

  // Re-verifye YON SÈL tracking non identifié (menm san chanjman)
  const reverifierUn = async (originalTracking: string) => {
    if (!factures) return;
    const value = (corrections[originalTracking] ?? originalTracking).trim();
    if (!value) return;
    setBusy(true); setErr(null);
    try {
      const [res] = await matchFactureTrackings([{ value, source: "text" as const }]);
      // Ranplase antre sa a nan lis la ak nouvo rezilta a
      setFactures((prev) => (prev ?? []).map((f) =>
        (!f.matched && f.tracking === originalTracking) ? res : f));
      setCorrections((c) => { const n = { ...c }; delete n[originalTracking]; return n; });
    } catch (e: any) {
      setErr("Erè vérification: " + (e.message ?? String(e)));
    } finally { setBusy(false); }
  };

  // ===== Korije koli non identifiés epi re-verifye (pwen #9) =====
  const reverifierCorriges = async () => {
    if (!factures) return;
    const unmatched = factures.filter((f) => !f.matched);
    // Pran valè korije yo (si admin chanje) oswa valè orijinal la
    const corriges = unmatched.map((f) => ({
      original: f.tracking,
      value: (corrections[f.tracking] ?? f.tracking).trim()
    })).filter((c) => c.value);
    if (!corriges.length) return;
    setBusy(true); setErr(null);
    try {
      const rematched = await matchFactureTrackings(corriges.map((c) => ({ value: c.value, source: "text" as const })));
      // Rekonstwi lis la: kenbe matched yo, ranplase unmatched ak nouvo rezilta yo
      const stillMatched = factures.filter((f) => f.matched);
      setFactures([...stillMatched, ...rematched]);
      setCorrections({});
    } catch (e: any) {
      setErr("Erè re-vérification: " + (e.message ?? String(e)));
    } finally { setBusy(false); }
  };
  const validerFactures = async () => {
    if (!factures) return;
    const cibles = factures.filter((f) => f.matched && !f.alreadyDisponible);
    if (!cibles.length) { setErr("Okenn koli pou mete Disponible."); return; }
    if (!confirm(`Marquer ${cibles.length} colis comme « Disponible » ?\n\n(Aucun email ne sera envoyé à cette étape.)`)) return;
    setBusy(true); setErr(null);
    try {
      const r = await commitFactureDisponible(factures);
      setApplyDone(`✅ Import Facture ${r.batchId}: ${r.updated} colis marqués Disponible.`);
      setLastBatch(r.batchId);
      setFactures(null); setFactureText("");
      await loadSide();
    } catch (e: any) {
      setErr("Erè validation facture: " + (e.message ?? String(e)));
    } finally { setBusy(false); }
  };
  const handleFactureText = async () => {
    setErr(null); setFactures(null); setBusy(true);
    try {
      const items = extractFromText(factureText);
      if (!items.length) { setErr("Okenn Tracking Number detekte nan tèks la."); return; }
      setFactProg("Vérification des correspondances...");
      const matched = await matchFactureTrackings(items);
      setFactures(matched);
      setFactProg("");
    } catch (e: any) {
      setErr("Erè analyse texte: " + (e.message ?? String(e)));
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
          <div className="flex-1" />
          <button className="btn btn-ghost border border-line !py-1 !text-xs" onClick={annulerImport} disabled={busy}>
            ↩️ Annuler la dernière importation
          </button>
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
          const conf = scans.filter((s) => s.verdict === "conflict");
          const nom = scans.filter((s) => s.verdict === "no_match");
          return (
            <div className="mt-4 space-y-3">
              {/* Rezime */}
              <div className="bg-navy/5 border border-line rounded-lg p-4 space-y-3">
                <p className="text-sm font-bold text-navy">🔍 Simulation d&apos;importation — rien n&apos;est encore enregistré</p>
                <div className="flex gap-4 text-sm flex-wrap items-center">
                  <span className="text-emerald-700 font-semibold">🟢 {ok.length} validées (≥98%)</span>
                  <span className="text-amber-700 font-semibold">🟡 {rev.length} à vérifier</span>
                  {conf.length > 0 && <span className="text-red-600 font-semibold">🔴 {conf.length} conflits</span>}
                  {nom.length > 0 && <span className="text-slate-500">⚪ {nom.length} non trouvés</span>}
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  <button className="btn btn-ghost border border-line !py-1 !text-xs"
                    onClick={() => setAccepted(new Set(scans.filter((s) => s.matched).map((s) => s.filename)))}>
                    Tout accepter
                  </button>
                  <button className="btn btn-ghost border border-line !py-1 !text-xs"
                    onClick={() => setAccepted(new Set())}>
                    Tout refuser
                  </button>
                  <div className="flex-1" />
                  <span className="text-xs text-slate-500">Sélectionnées: <b>{accepted.size}</b></span>
                  <button className="btn" onClick={validerPhotos} disabled={busy || !accepted.size}>
                    Enregistrer {accepted.size} modification(s)
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Chanjman otorize yo: <b>Tracking Number</b> (si chan an vid), <b>date/heure de réception</b>.
                  Scanner a pa ka JANM chanje pwa, pri, tax, DGA, vil, kliyan ni Customer Code.
                </p>
              </div>

              {/* Tablo validasyon — Aksepte / Rejte chak foto */}
              <div className="border border-line rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr>
                    <th className="thc">✔</th>
                    {["Aperçu", "Tracking ID (Guía)", "Tracking Number", "Client", "Confiance", "Action proposée"]
                      .map((h) => <th key={h} className="thc">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {scans.map((s, i) => (
                      <tr key={i} className={
                        s.verdict === "conflict" ? "!bg-red-50"
                        : s.verdict === "validated" ? "!bg-emerald-50"
                        : s.verdict === "review" ? "!bg-amber-50" : i % 2 ? "bg-mist" : ""}>
                        <td className="tdc">
                          <input type="checkbox" checked={accepted.has(s.filename)}
                            disabled={!s.matched || s.verdict === "conflict"}
                            onChange={() => toggleAccept(s.filename)} />
                        </td>
                        <td className="tdc">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s.previewUrl} alt={s.filename} className="w-12 h-12 object-cover rounded border border-line" />
                        </td>
                        <td className="tdc font-mono text-[11px]">
                          {s.guia || <span className="text-slate-300">—</span>}
                          {s.guiaSource === "barcode" && <span className="ml-1 badge bg-blue-100 text-blue-700">code-barres</span>}
                        </td>
                        <td className="tdc font-mono text-[11px]">
                          {s.proposedTracking
                            ? <span className="text-emerald-700 font-semibold">+ {s.proposedTracking}</span>
                            : s.matchedManual || s.tracking_number || <span className="text-slate-300">— (vide)</span>}
                        </td>
                        <td className="tdc font-bold text-navy">{s.matchedCode || s.customer_code || "—"}</td>
                        <td className="tdc">
                          <span className={`badge ${s.confidence >= 90 ? "bg-emerald-100 text-emerald-700"
                            : s.confidence >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                            {Math.round(s.confidence)}%
                          </span>
                        </td>
                        <td className="tdc max-w-[280px]">
                          <span className={
                            s.verdict === "conflict" ? "text-red-700 font-semibold"
                            : s.verdict === "validated" ? "text-emerald-700"
                            : s.verdict === "review" ? "text-amber-800" : "text-slate-500"}>
                            {s.verdict === "conflict" ? "🔴 " : s.verdict === "validated" ? "🟢 "
                              : s.verdict === "review" ? "🟡 " : "⚪ "}{s.message}
                          </span>
                          {s.conflicts.map((m, j) => (
                            <span key={j} className="block text-[11px] text-red-700">⚠️ {m}</span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400">
                <b>Mode Zéro Risque:</b> scanner a pa devine, pa kreye koli, epi li bloke tout konfli.
                Konfyans minimòm pou modifikasyon otomatik: <b>98%</b>. Fakti yo toujou kalkile ak done bazdone a
                (jamè done foto). Tout analiz nan Journal OCR ak ansyen/nouvo valè.
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

      {/* ===== Import Facture MCPACK (pwen #6a) ===== */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-navy" />
          <h2 className="h-sec">Import Facture MCPACK <span className="text-mute font-normal">(PDF ou capture d&apos;écran)</span></h2>
        </div>
        <p className="text-xs text-mute">
          Chwazi fakti MCPACK yo (PDF oswa screenshot). Sistèm nan ap ekstrè Tracking Number yo epi
          montre ki koli yo koresponn — <b>san chanje anyen</b>. Ou verifye anvan.
        </p>
        <input ref={factureRef} type="file" accept=".pdf,image/*" multiple className="hidden"
          onChange={(e) => e.target.files && e.target.files.length && handleFactures(e.target.files)} />
        <button className="btn btn-ghost" onClick={() => factureRef.current?.click()} disabled={busy}>
          <Upload size={15} /> Choisir PDF / captures
        </button>

        <div className="pt-1">
          <p className="text-xs font-semibold text-ink mb-1">
            Ou <span className="text-brand-dark">coller le texte</span> de la facture (le plus fiable) :
          </p>
          <textarea className="input !h-24 font-mono text-[11px]"
            placeholder="Kopye tèks fakti a (menm si li degaye) epi kole l isit — sistèm nan ap pran Tracking Number yo otomatikman..."
            value={factureText} onChange={(e) => setFactureText(e.target.value)} />
          <button className="btn btn-brand mt-2" onClick={handleFactureText} disabled={busy || !factureText.trim()}>
            <CheckCircle2 size={15} /> Analyser le texte collé
          </button>
        </div>
        {factProg && <p className="text-xs text-navy flex items-center gap-2"><RefreshCw size={12} className="animate-spin" /> {factProg}</p>}

        {factures && (() => {
          const matched = factures.filter((f) => f.matched);
          const unmatched = factures.filter((f) => !f.matched);
          const dispo = matched.filter((f) => !f.alreadyDisponible);
          const deja = matched.filter((f) => f.alreadyDisponible);
          return (
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="pill pill-green"><span className="pill-dot" />{dispo.length} à rendre Disponible</span>
                <span className="pill pill-gray"><span className="pill-dot" />{deja.length} déjà Disponible/Facturé</span>
                <span className="pill pill-red"><span className="pill-dot" />{unmatched.length} non identifiés</span>
              </div>

              {matched.length > 0 && (
                <div className="card overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr>
                      {["Tracking Number", "Tracking ID (Guía)", "Client", "Statut actuel", "Source"].map((h) =>
                        <th key={h} className="thc">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {matched.map((f, i) => {
                        const aRendre = !f.alreadyDisponible;   // koli w pran nan fakti a
                        return (
                          <tr key={i} className={aRendre ? "bg-red-50 border-l-4 border-red-700" : (i % 2 ? "bg-mist" : "")}>
                            <td className={`tdc font-mono ${aRendre ? "text-red-800 font-bold" : ""}`}>{f.tracking}</td>
                            <td className="tdc font-mono text-[11px]">{f.guia}</td>
                            <td className="tdc"><span className="font-bold text-navy">{f.customerCode}</span> — {f.customerName}</td>
                            <td className="tdc">{f.status}</td>
                            <td className="tdc text-mute">{f.source === "pdf" ? "PDF" : f.source === "text" ? "Texte" : "Image"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {unmatched.length > 0 && (
                <div className="card p-3 bg-red-50/40 border border-red-200">
                  <p className="text-xs font-bold text-red-700 mb-2">
                    Colis non identifiés ({unmatched.length}) — corrigez le Tracking Number puis re-vérifiez :
                  </p>
                  <div className="space-y-1.5">
                    {unmatched.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          className="input !py-1 !text-[11px] font-mono flex-1"
                          defaultValue={f.tracking}
                          onChange={(e) => setCorrections((c) => ({ ...c, [f.tracking]: e.target.value }))}
                          placeholder="Tracking Number à corriger..." />
                        <button className="btn btn-ghost !py-1 !px-2.5 !text-[11px] shrink-0"
                          onClick={() => reverifierUn(f.tracking)} disabled={busy}
                          title="Vérifier ce tracking (même sans le modifier)">
                          <CheckCircle2 size={13} /> Vérifier
                        </button>
                        <span className="text-[10px] text-red-600 shrink-0 w-16">non trouvé</span>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-ghost mt-2.5" onClick={reverifierCorriges} disabled={busy}>
                    <RefreshCw size={14} /> Re-vérifier les corrigés
                  </button>
                  <p className="text-[10px] text-mute mt-1.5">
                    Astuce : vérifiez qu&apos;il n&apos;y a pas d&apos;espace, de 0/O ou 1/l confondus. Après correction, les colis trouvés rejoignent la liste à valider.
                  </p>
                </div>
              )}

              {dispo.length > 0 && (
                <div className="flex items-center gap-3 flex-wrap border-t border-line pt-3">
                  <button className="btn btn-brand" onClick={validerFactures} disabled={busy}>
                    <CheckCircle2 size={15} /> Valider → Disponible ({dispo.length})
                  </button>
                  <span className="text-xs text-mute">Aucun email envoyé à cette étape. Les colis déjà Disponible/Facturé sont ignorés.</span>
                </div>
              )}
            </div>
          );
        })()}
      </div>

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
