"use client";
/*
 * STANDA COMMERCIAL — Importer les colis d'une Conduce
 * ══════════════════════════════════════════════════════════
 * DEUX chemins (pa gen bot ki navige — itilizatè a rete an kontwòl):
 *   A) Fichier Excel — bouton "Exportar XLS" sou paj Conduce MCPACK la.
 *      Kolòn egzat: Guia, Nombre, Oficina, Peso, Contenido, Cantidad,
 *      Tracking Number. Done fyab/estriktire → si yon koli PA egziste
 *      deja, li KREYE (menm règ ak Extension /api/ingest-conduce).
 *   B) Coller le texte — altènativ rapid, READ-ONLY (JANM kreye nouvo
 *      Package), pou yon verifikasyon rapid san Excel.
 * Single Source of Truth: yon Package pa janm dwaplike (match pa Guía).
 */
import { useRef, useState } from "react";
import { Upload, ClipboardList, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { matchConduceCodes, linkPackagesToConduce, importConduceExcelRows, ConduceMatch } from "@/lib/db";
import { extractAnyCodesFromText } from "@/lib/factureimport";
import { parseConduceWorkbook, ConduceExcelRow } from "@/lib/conduceexcel";
import { useRole } from "@/lib/authx";

type Mode = "excel" | "texte";

export default function ConduceManualPaste({
  conduceId, conduceNumber, onLinked,
}: { conduceId: string; conduceNumber: string; onLinked?: () => void }) {
  const { staff } = useRole();
  const staffName = staff ? `${staff.prenom ?? ""} ${staff.nom ?? ""}`.trim() || (staff.username ?? "") : "";

  const [mode, setMode] = useState<Mode>("excel");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; s: string } | null>(null);

  // ----- Chemen A: Fichier Excel -----
  const fileRef = useRef<HTMLInputElement>(null);
  const [excelRows, setExcelRows] = useState<ConduceExcelRow[] | null>(null);
  const [fileName, setFileName] = useState("");

  const chooseFile = () => fileRef.current?.click();
  const onFile = async (f: File) => {
    setMsg(null); setBusy(true);
    try {
      const rows = await parseConduceWorkbook(await f.arrayBuffer());
      if (!rows.length) { setMsg({ t: "err", s: "Aucun colis détecté dans ce fichier (vérifiez les colonnes)." }); setExcelRows(null); }
      else { setExcelRows(rows); setFileName(f.name); }
    } catch (e: any) {
      setMsg({ t: "err", s: "Erreur lecture Excel : " + (e?.message ?? String(e)) });
    } finally { setBusy(false); }
  };

  const confirmerExcel = async () => {
    if (!excelRows?.length) return;
    setBusy(true);
    try {
      const r = await importConduceExcelRows(conduceId, conduceNumber, excelRows, staffName);
      setMsg({ t: "ok", s: `✔ ${r.created} créés, ${r.updated} mis à jour/liés — ${r.totalWeight.toFixed(2)} lb au total.` });
      setExcelRows(null); setFileName("");
      onLinked?.();
    } catch (e: any) {
      setMsg({ t: "err", s: "Erreur import : " + (e?.message ?? String(e)) });
    } finally { setBusy(false); }
  };

  // ----- Chemen B: Coller le texte (READ-ONLY, altènativ) -----
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<ConduceMatch[] | null>(null);

  const analyser = async () => {
    const codes = extractAnyCodesFromText(text);
    if (!codes.length) { setMsg({ t: "err", s: "Aucun code détecté dans le texte collé." }); return; }
    setBusy(true); setMsg(null);
    try {
      setMatches(await matchConduceCodes(codes));
    } catch (e: any) {
      setMsg({ t: "err", s: "Erreur analyse : " + (e?.message ?? String(e)) });
    } finally { setBusy(false); }
  };

  const confirmerTexte = async () => {
    if (!matches) return;
    setBusy(true);
    try {
      const r = await linkPackagesToConduce(conduceId, conduceNumber, matches, staffName);
      setMsg({ t: "ok", s: `✔ ${r.linked} colis liés` +
        (r.alreadyElsewhere ? ` (${r.alreadyElsewhere} déjà dans une autre conduce, ignorés)` : "") });
      setMatches(null); setText("");
      onLinked?.();
    } catch (e: any) {
      setMsg({ t: "err", s: "Erreur liaison : " + (e?.message ?? String(e)) });
    } finally { setBusy(false); }
  };

  const matched = matches?.filter((m) => m.matched && !m.currentConduceId) ?? [];
  const elsewhere = matches?.filter((m) => m.matched && m.currentConduceId) ?? [];
  const notFound = matches?.filter((m) => !m.matched) ?? [];
  const excelWeight = excelRows?.reduce((s, r) => s + (r.weight || 0), 0) ?? 0;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-navy">
          <ClipboardList size={15} /> Importer les colis — Conduce {conduceNumber}
        </span>
        <div className="flex rounded-lg border border-line overflow-hidden text-xs">
          <button onClick={() => setMode("excel")}
            className={`px-3 py-1.5 font-semibold flex items-center gap-1 ${mode === "excel" ? "bg-navy text-white" : "bg-white text-mute"}`}>
            <FileSpreadsheet size={13} /> Fichier Excel
          </button>
          <button onClick={() => setMode("texte")}
            className={`px-3 py-1.5 font-semibold ${mode === "texte" ? "bg-navy text-white" : "bg-white text-mute"}`}>
            Coller le texte
          </button>
        </div>
      </div>

      {mode === "excel" && (
        <div className="space-y-3">
          <p className="text-xs text-mute">
            Sur MCPACK, ouvrez la Conduce {conduceNumber} → bouton <b>« Exportar XLS »</b> → sélectionnez
            le fichier téléchargé ici. Colonnes lues : Guia, Nombre, Oficina, Peso, Contenido, Cantidad, Tracking Number.
          </p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          <button className="btn btn-ghost" onClick={chooseFile} disabled={busy}>
            <Upload size={15} /> Choisir le fichier Excel
          </button>
          {fileName && <p className="text-xs text-mute">Fichier : <span className="font-mono">{fileName}</span></p>}

          {excelRows && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="pill pill-green"><span className="pill-dot" />{excelRows.length} colis détectés</span>
                <span className="pill pill-gray"><span className="pill-dot" />{excelWeight.toFixed(2)} lb au total</span>
              </div>
              <button className="btn btn-brand" onClick={confirmerExcel} disabled={busy}>
                <CheckCircle2 size={15} /> Importer dans cette conduce ({excelRows.length})
              </button>
            </div>
          )}
        </div>
      )}

      {mode === "texte" && (
        <div className="space-y-3">
          <p className="text-xs text-mute">
            Alternative sans fichier : collez le contenu de la conduce copié depuis MCPACK.
            Cette méthode ne fait que <b>lier</b> des colis existants (elle n&apos;en crée jamais).
          </p>
          <textarea className="input !h-32 font-mono text-[11px]"
            placeholder="Collez le texte de la conduce (même désordonné)…"
            value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-ghost" onClick={analyser} disabled={busy || !text.trim()}>
            <CheckCircle2 size={15} /> Analyser
          </button>

          {matches && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="pill pill-green"><span className="pill-dot" />{matched.length} à lier</span>
                <span className="pill pill-gray"><span className="pill-dot" />{elsewhere.length} dans une autre conduce</span>
                <span className="pill pill-red"><span className="pill-dot" />{notFound.length} introuvables</span>
              </div>
              {matched.length > 0 && (
                <button className="btn btn-brand" onClick={confirmerTexte} disabled={busy}>
                  <CheckCircle2 size={15} /> Confirmer la liaison ({matched.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {msg && (
        <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${
          msg.t === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {msg.s}
        </div>
      )}
    </div>
  );
}
