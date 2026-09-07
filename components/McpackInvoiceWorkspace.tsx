"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  AlertCircle, CheckCircle2, CircleDollarSign, FileSearch, FileText,
  LoaderCircle, ReceiptText, Upload,
} from "lucide-react";
import { extractFacture } from "@/lib/factureimport";
import type { FactureTracking } from "@/lib/factureimport";
import {
  analyzeMcpackInvoiceTrackings, createMcpackInvoice, getMcpackInvoices,
  McpackInvoiceAnalysis, payMcpackInvoice,
} from "@/lib/db";
import { validateUpload } from "@/lib/upload";
import type { McpackInvoice } from "@/lib/types";

type Notice = { tone: "ok" | "error" | "info"; text: string } | null;

/**
 * Registre fakti MCPACK. PDF a parse sou aparèy staff la; se lis Conduce yo
 * sèlman ki anrejistre apre moun nan fin kontwole li epi klike "Facturer".
 */
export default function McpackInvoiceWorkspace({
  staffName,
  onPaymentRecorded,
}: {
  staffName: string;
  onPaymentRecorded?: () => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [invoices, setInvoices] = useState<McpackInvoice[]>([]);
  const [analysis, setAnalysis] = useState<(McpackInvoiceAnalysis & { fileName: string }) | null>(null);
  const [sourceTrackings, setSourceTrackings] = useState<FactureTracking[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const load = async () => {
    setLoading(true);
    try {
      setInvoices(await getMcpackInvoices());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de charger les factures MCPACK.";
      setNotice({ tone: "error", text: `Registre MCPACK indisponible : ${message}` });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const analyze = async (trackings: FactureTracking[], fileName: string, complete = false) => {
    const result = await analyzeMcpackInvoiceTrackings(trackings, complete ? {} : { maximumTrackings: 8 });
    setAnalysis({ ...result, fileName });
    setNotice(result.conduces.length
      ? { tone: "info", text: complete
        ? "Analyse complète terminée. Vérifiez les Conduces détectées, puis confirmez la facture."
        : `Détection rapide : ${result.checkedTrackingCount} tracking suffisent pour trouver une Conduce. Vous pouvez confirmer ou analyser tout le PDF.` }
      : { tone: "error", text: complete
        ? "Aucune Conduce correspondante : aucun changement ne sera enregistré."
        : `Aucune Conduce dans les ${result.checkedTrackingCount} premiers tracking. Utilisez l'analyse complète pour chercher les autres.` });
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    const check = validateUpload(file, "pdf");
    if (!check.ok) { setNotice({ tone: "error", text: check.reason ?? "PDF invalide." }); return; }

    setParsing(true); setAnalysis(null); setNotice(null);
    try {
      const trackings = await extractFacture(file);
      if (!trackings.length) {
        setNotice({ tone: "error", text: "Aucun tracking n'a été lu. Utilisez le PDF exporté par MCPACK (pas une photo scannée)." });
        return;
      }
      setSourceTrackings(trackings);
      await analyze(trackings, check.filename);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Analyse du PDF impossible." });
    } finally {
      setParsing(false);
    }
  };

  const saveInvoice = async () => {
    if (!analysis?.conduces.length) return;
    setSaving(true);
    try {
      await createMcpackInvoice(analysis, staffName);
      setAnalysis(null);
      setNotice({ tone: "ok", text: "Facture MCPACK enregistrée. Les Conduces restent « à payer » jusqu'au règlement." });
      await load();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Impossible d'enregistrer la facture MCPACK." });
    } finally {
      setSaving(false);
    }
  };

  const analyzeAll = async () => {
    if (!analysis || !sourceTrackings) return;
    setParsing(true);
    try {
      await analyze(sourceTrackings, analysis.fileName, true);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Analyse complète impossible." });
    } finally {
      setParsing(false);
    }
  };

  const pay = async (invoice: McpackInvoice) => {
    const count = invoice.conduces.length;
    if (!window.confirm(
      `Confirmer le paiement MCPACK de « ${invoice.file_name} » ?\n\n` +
      `${count} Conduce${count > 1 ? "s seront" : " sera"} marquée${count > 1 ? "s" : ""} « Payé ».`
    )) return;
    setPayingId(invoice.id);
    try {
      await payMcpackInvoice(invoice, staffName);
      setNotice({ tone: "ok", text: `Paiement enregistré : ${count} Conduce${count > 1 ? "s" : ""} est/sont maintenant payée(s).` });
      await Promise.all([load(), Promise.resolve(onPaymentRecorded?.())]);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Paiement MCPACK impossible." });
    } finally {
      setPayingId(null);
    }
  };

  const unpaid = invoices.filter((invoice) => invoice.status !== "Payée");
  const paid = invoices.filter((invoice) => invoice.status === "Payée");

  return (
    <section className="card overflow-hidden border border-navy/10">
      <div className="p-4 sm:p-5 bg-navy text-white flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <ReceiptText size={20} className="text-brand shrink-0" />
          <div>
            <h2 className="font-extrabold text-[15px]">Factures MCPACK</h2>
            <p className="text-[11px] text-white/65">Analysez le PDF, contrôlez les Conduces, puis enregistrez le paiement.</p>
          </div>
        </div>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFile} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={parsing || saving}
          className="rounded-xl bg-white text-navy px-3.5 py-2.5 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
          {parsing ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}
          {parsing ? "Analyse du PDF…" : "Ajouter le PDF MCPACK"}
        </button>
      </div>

      <div className="p-4 sm:p-5 space-y-3">
        <p className="text-[11px] text-mute leading-relaxed">
          Le PDF est lu sur cet appareil et n&apos;est pas conservé sur le site. La détection rapide consulte seulement quelques tracking et accepte aussi les colis livrés ou archivés.
        </p>

        {notice && (
          <div className={`rounded-xl px-3 py-2.5 text-xs font-semibold flex items-start gap-2 ${
            notice.tone === "ok" ? "bg-emerald-50 text-emerald-800" :
            notice.tone === "error" ? "bg-red-50 text-red-700" : "bg-blue-50 text-navy"
          }`}>
            {notice.tone === "error" ? <AlertCircle size={15} className="shrink-0 mt-0.5" /> :
              notice.tone === "ok" ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <FileSearch size={15} className="shrink-0 mt-0.5" />}
            <span>{notice.text}</span>
          </div>
        )}

        {analysis && (
          <div className="rounded-2xl border border-navy/15 bg-slate-50/70 p-3.5 space-y-3">
            <div className="flex flex-wrap justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-sm text-ink truncate"><FileText size={14} className="inline mr-1.5 text-navy" />{analysis.fileName}</p>
                <p className="text-[11px] text-mute mt-0.5">Résultat de l&apos;analyse — aucun changement n&apos;est encore enregistré.</p>
              </div>
              <div className="flex gap-1.5 text-[10px] font-bold">
                <span className="pill pill-gray !px-2">{analysis.checkedTrackingCount}/{analysis.extractedTrackingCount} vérifié{analysis.checkedTrackingCount > 1 ? "s" : ""}</span>
                <span className="pill pill-green !px-2">{analysis.matchedPackageCount} trouvé{analysis.matchedPackageCount > 1 ? "s" : ""}</span>
              </div>
            </div>

            {analysis.conduces.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {analysis.conduces.map((line) => (
                  <div key={line.conduce.id} className="rounded-xl border border-line bg-white px-3 py-2.5 flex items-center gap-2">
                    <ReceiptText size={16} className="text-navy shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono font-extrabold text-navy text-sm truncate">Conduce {line.conduce.conduce_number}</p>
                      <p className="text-[11px] text-mute">{line.packageCount} colis dans cette facture</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(analysis.unmatchedTrackingCount > 0 || analysis.unlinkedPackageCount > 0) && (
              <p className="text-[11px] text-amber-800 rounded-lg bg-amber-50 px-2.5 py-2">
                {analysis.unmatchedTrackingCount > 0 && `${analysis.unmatchedTrackingCount} tracking non trouvé${analysis.unmatchedTrackingCount > 1 ? "s" : ""} dans la recherche actuelle. `}
                {analysis.unlinkedPackageCount > 0 && `${analysis.unlinkedPackageCount} colis trouvé${analysis.unlinkedPackageCount > 1 ? "s" : ""} sans Conduce.`}
                Ils ne seront pas ajoutés à cette facture.
              </p>
            )}

            {analysis.duplicateTrackings.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] text-red-800">
                <p className="font-extrabold flex items-center gap-1.5"><AlertCircle size={14} /> Tracking trouvé dans plusieurs Conduces</p>
                <p className="mt-1">Ces tracking ne sont pas ajoutés automatiquement à la facture. Vérifiez-les avant de continuer.</p>
                <ul className="mt-1.5 space-y-0.5 font-mono font-semibold">
                  {analysis.duplicateTrackings.map((conflict) => (
                    <li key={conflict.tracking}>{conflict.tracking} → Conduces {conflict.conduceNumbers.join(", ")}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
              <button type="button" className="btn btn-ghost justify-center" disabled={saving} onClick={() => { setAnalysis(null); setSourceTrackings(null); }}>Annuler</button>
              {analysis.skippedTrackingCount > 0 && sourceTrackings && (
                <button type="button" className="btn btn-ghost justify-center" disabled={saving || parsing}
                  onClick={() => { void analyzeAll(); }}>
                  <FileSearch size={15} /> Analyser les {analysis.extractedTrackingCount} tracking
                </button>
              )}
              <button type="button" className="btn btn-brand justify-center" disabled={saving || !analysis.conduces.length} onClick={saveInvoice}>
                {saving ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {saving ? "Enregistrement…" : `Facturer ${analysis.conduces.length} Conduce${analysis.conduces.length > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-mute py-1"><LoaderCircle size={14} className="animate-spin" />Chargement du registre…</div>
        ) : unpaid.length > 0 ? (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-extrabold uppercase tracking-wide text-amber-800">À payer à MCPACK · {unpaid.length}</p>
            {unpaid.map((invoice) => <InvoiceCard key={invoice.id} invoice={invoice} paying={payingId === invoice.id} onPay={() => pay(invoice)} />)}
          </div>
        ) : (
          <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 size={15} /> Aucune facture MCPACK en attente de paiement.
          </div>
        )}

        {paid.length > 0 && (
          <p className="text-[11px] text-mute pt-1">{paid.length} facture{paid.length > 1 ? "s" : ""} MCPACK déjà payée{paid.length > 1 ? "s" : ""} reste/restent dans le registre.</p>
        )}
      </div>
    </section>
  );
}

function InvoiceCard({ invoice, paying, onPay }: { invoice: McpackInvoice; paying: boolean; onPay: () => void }) {
  const count = invoice.conduces.length;
  const date = invoice.created_at
    ? new Date(invoice.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
    : "—";
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-ink truncate"><FileText size={14} className="inline mr-1.5 text-amber-700" />{invoice.file_name || "Facture MCPACK"}</p>
          <p className="text-[11px] text-mute mt-0.5">Enregistrée le {date} · {invoice.matched_package_count} colis associés</p>
          <p className="text-[11px] text-navy font-semibold mt-1.5">
            {invoice.conduces.map((line) => line.conduce?.conduce_number ?? "—").join(" · ")}
          </p>
        </div>
        <button type="button" onClick={onPay} disabled={paying}
          className="btn btn-brand justify-center shrink-0 !bg-emerald-600 hover:!bg-emerald-700">
          {paying ? <LoaderCircle size={15} className="animate-spin" /> : <CircleDollarSign size={15} />}
          {paying ? "Validation…" : `Marquer ${count} payée${count > 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
