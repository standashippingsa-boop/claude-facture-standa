"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  AlertCircle, CheckCircle2, CircleDollarSign, FileSearch, FileText,
  LoaderCircle, ReceiptText, Upload,
} from "@/components/icons";
import { extractFactureDetailed } from "@/lib/factureimport";
import {
  analyzeMcpackInvoiceTrackings, createMcpackInvoice, getMcpackInvoices,
  McpackInvoiceAnalysis, payMcpackInvoice, selectMcpackInvoiceConduces,
} from "@/lib/db";
import { validateUpload } from "@/lib/upload";
import type { McpackInvoice } from "@/lib/types";

import { useNoticeToast } from "@/lib/notify";
import { Spinner } from "@/components/Loader";
type Notice = { tone: "ok" | "error" | "info"; text: string } | null;
/** Contrôle de lecture : ce que STANDA a lu dans le PDF vs les totaux imprimés par MCPACK. */
type ReadCheck = { readLbs: number; readCount: number; totals: { lbs: number | null; usd: number | null } | null };
/** La lecture est sûre seulement si la somme des lignes lues = « Pwa Total » imprimé (au centime de livre). */
export function readCheckOk(check: ReadCheck | undefined): boolean {
  return !!check?.totals?.lbs && Math.abs(check.readLbs - check.totals.lbs) < 0.005;
}

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
  const [analysis, setAnalysis] = useState<(McpackInvoiceAnalysis & { fileName: string; readCheck?: ReadCheck }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  /** Conduces décochées : MCPACK ne les a pas encore facturées, elles iront sur la prochaine facture. */
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  useNoticeToast(notice, setNotice);

  /** La facture réellement enregistrée : seulement les Conduces cochées. */
  const selected = analysis
    ? { ...selectMcpackInvoiceConduces(analysis, new Set(analysis.conduces.map((line) => line.conduce.id).filter((id) => !excluded.has(id)))), fileName: analysis.fileName, readCheck: analysis.readCheck }
    : null;
  const toggleConduce = (id: string) => setExcluded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

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

  const analyzeAllConduces = async (trackings: { value: string; weight?: number }[], fileName: string, readCheck?: ReadCheck) => {
    const result = await analyzeMcpackInvoiceTrackings(trackings);
    // Une Conduce dont moins de la moitié des colis figure sur la facture n'est
    // probablement pas encore facturée par MCPACK : décochée par défaut.
    setExcluded(new Set(result.conduces
      .filter((line) => (line.totalPackageCount ?? 0) > 0 && line.packageCount * 2 < (line.totalPackageCount ?? 0))
      .map((line) => line.conduce.id)));
    setAnalysis({ ...result, fileName, readCheck });
    setNotice(result.conduces.length
      ? { tone: "info", text: `${result.conduces.length} Conduce${result.conduces.length > 1 ? "s" : ""} prête${result.conduces.length > 1 ? "s" : ""} à facturer.${result.alreadyRecordedConduces.length ? ` ${result.alreadyRecordedConduces.length} déjà enregistrée${result.alreadyRecordedConduces.length > 1 ? "s" : ""} est/sont mise(s) à part.` : ""}` }
      : result.alreadyRecordedConduces.length
        ? { tone: "info", text: "Toutes les Conduces détectées sont déjà enregistrées ou payées. Elles sont mises à part plus bas." }
        : { tone: "error", text: "Aucune Conduce reliée n'a été retrouvée dans la base avec les références de ce PDF." });
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    const check = validateUpload(file, "pdf");
    if (!check.ok) { setNotice({ tone: "error", text: check.reason ?? "PDF invalide." }); return; }

    setParsing(true); setAnalysis(null); setNotice(null);
    try {
      const { trackings, readLbs, readCount, totals } = await extractFactureDetailed(file);
      if (!trackings.length) {
        setNotice({ tone: "error", text: "Le PDF ne contient aucune référence lisible. Utilisez le PDF MCPACK original, avec le tableau « Nimewo Tracking » visible." });
        return;
      }
      await analyzeAllConduces(trackings, check.filename, { readLbs, readCount, totals });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Analyse du PDF impossible." });
    } finally {
      setParsing(false);
    }
  };

  const saveInvoice = async () => {
    if (!selected?.conduces.length) return;
    // Garde-fou : jamais de facture enregistrée sur une lecture incomplète du PDF.
    if (!readCheckOk(selected.readCheck)) {
      setNotice({ tone: "error", text: "Lecture du PDF incomplète : la somme des colis lus ne correspond pas au « Pwa Total » imprimé par MCPACK. Rien n'a été enregistré." });
      return;
    }
    setSaving(true);
    try {
      await createMcpackInvoice(selected, staffName);
      setAnalysis(null);
      setNotice({ tone: "ok", text: "Facture MCPACK enregistrée. Les Conduces restent « à payer » jusqu'au règlement." });
      await load();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Impossible d'enregistrer la facture MCPACK." });
    } finally {
      setSaving(false);
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
            <p className="text-[11px] text-white/65">Chargez le PDF : STANDA lit ses références et retrouve les Conduces.</p>
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
          Le PDF est lu sur cet appareil et n&apos;est pas conservé sur le site. STANDA filtre tous les numéros de tracking présents dans le PDF, puis retrouve toutes les Conduces concernées, même si les colis sont livrés, archivés ou rangés dans des folders différents.
        </p>


        {analysis && (
          <div className="rounded-2xl border border-navy/15 bg-slate-50/70 p-3.5 space-y-3">
            <div className="flex flex-wrap justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-sm text-ink truncate"><FileText size={14} className="inline mr-1.5 text-navy" />{analysis.fileName}</p>
                <p className="text-[11px] text-mute mt-0.5">Références lues dans le PDF · aucun changement n&apos;est encore enregistré.</p>
              </div>
              <div className="flex gap-1.5 text-[10px] font-bold">
                <span className="pill pill-gray !px-2">{analysis.extractedTrackingCount} références lues</span>
                <span className="pill pill-green !px-2">{analysis.conduces.length} Conduce{analysis.conduces.length > 1 ? "s" : ""}</span>
              </div>
            </div>

            {analysis.conduces.length > 0 && (<>
              <p className="text-[11px] text-mute">Décochez une Conduce que MCPACK n&apos;a pas mise sur cette facture : elle ne sera pas facturée maintenant et restera pour la prochaine facture.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {analysis.conduces.map((line) => {
                  const on = !excluded.has(line.conduce.id);
                  const total = Math.max(line.totalPackageCount ?? 0, line.packageCount);
                  const partial = total > line.packageCount;
                  return (
                    <label key={line.conduce.id} className={`rounded-xl border px-3 py-2.5 flex items-center gap-2 cursor-pointer ${on ? "border-line bg-white" : "border-dashed border-slate-300 bg-slate-100 opacity-70"}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleConduce(line.conduce.id)} className="h-4 w-4 shrink-0 accent-navy" />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono font-extrabold text-navy text-sm truncate">Conduce {line.conduce.conduce_number}</p>
                        <p className={`text-[11px] ${partial ? "font-semibold text-amber-700" : "text-mute"}`}>{line.packageCount} colis sur {total} dans cette facture{on ? "" : " · prochaine facture"}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>)}

            {(() => {
              const rc = analysis.readCheck;
              const ok = readCheckOk(rc);
              return <div className={`rounded-xl border px-3 py-2.5 text-[11px] ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>
                <p className="font-extrabold flex items-center gap-1.5">{ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} Contrôle de lecture du PDF</p>
                <p className="mt-1">
                  Imprimé par MCPACK : <b>{rc?.totals?.lbs != null ? rc.totals.lbs.toFixed(2) + " lb" : "total introuvable"}</b>
                  {rc?.totals?.usd != null && <> · <b>${rc.totals.usd.toFixed(2)}</b></>}
                  {" "}· Lu par STANDA : <b>{(rc?.readLbs ?? 0).toFixed(2)} lb</b> sur {rc?.readCount ?? 0} ligne{(rc?.readCount ?? 0) > 1 ? "s" : ""}
                </p>
                {!ok && <p className="mt-1 font-bold">Enregistrement bloqué : une partie de la facture n&apos;a pas été lue. Vérifiez que c&apos;est bien le PDF MCPACK original (non modifié, non scanné).</p>}
              </div>;
            })()}

            {selected && selected.reconciliation.invoiceLbs > 0 && (() => {
              const rec = selected.reconciliation;
              const gap = rec.systemLbs - rec.invoiceLbs;
              const ok = Math.abs(gap) < 0.01;
              return <div className={`rounded-xl border px-3 py-2.5 text-[11px] ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                <p className="font-extrabold flex items-center gap-1.5">{ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} Livres : facture MCPACK {rec.invoiceLbs.toFixed(2)} lb · STANDA {rec.systemLbs.toFixed(2)} lb{ok ? " · identiques" : ` · écart ${gap > 0 ? "+" : ""}${gap.toFixed(2)} lb`}</p>
                {rec.weightDiffs.length > 0 && <>
                  <p className="mt-1.5 font-bold">Poids différent ({rec.weightDiffs.length}) :</p>
                  <ul className="mt-0.5 space-y-0.5 font-mono">{rec.weightDiffs.map((d) => <li key={d.tracking}>{d.tracking} · Conduce {d.conduceNumber} · {d.customerCode} : MCPACK {d.invoiceLbs} lb / STANDA {d.systemLbs} lb</li>)}</ul>
                </>}
                {rec.missingFromInvoice.length > 0 && <>
                  <p className="mt-1.5 font-bold">Dans nos Conduces mais absent de la facture ({rec.missingFromInvoice.length}) :</p>
                  <ul className="mt-0.5 space-y-0.5 font-mono">{rec.missingFromInvoice.map((d) => <li key={d.tracking + d.conduceNumber}>{d.tracking} · Conduce {d.conduceNumber} · {d.customerCode} : {d.systemLbs} lb</li>)}</ul>
                </>}
              </div>;
            })()}

            {analysis.alreadyRecordedConduces.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-900">
                <p className="font-extrabold flex items-center gap-1.5"><AlertCircle size={14} /> Conduce déjà présente dans une autre facture</p>
                <p className="mt-1">Ces Conduces sont retirées de cette nouvelle facture. Seules les autres Conduces seront validées.</p>
                <ul className="mt-1.5 space-y-0.5 font-semibold">
                  {analysis.alreadyRecordedConduces.map((line) => (
                    <li key={line.conduce.id}>
                      Conduce {line.conduce.conduce_number} · {line.reason}
                      {line.invoiceFileName ? ` (${line.invoiceFileName})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.duplicateTrackings.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] text-red-800">
                <p className="font-extrabold flex items-center gap-1.5"><AlertCircle size={14} /> Numéro de suivi trouvé dans plusieurs Conduces</p>
                <p className="mt-1">Ces numéros de suivi ne sont pas ajoutés automatiquement à la facture. Merci de les vérifier avant de continuer.</p>
                <ul className="mt-1.5 space-y-0.5 font-mono font-semibold">
                  {analysis.duplicateTrackings.map((conflict) => (
                    <li key={conflict.tracking}>{conflict.tracking} → Conduces {conflict.conduceNumbers.join(", ")}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
              <button type="button" className="btn btn-ghost justify-center" disabled={saving} onClick={() => setAnalysis(null)}>Annuler</button>
              <button type="button" className="btn btn-brand justify-center" disabled={saving || !selected?.conduces.length || !readCheckOk(analysis.readCheck)} onClick={saveInvoice}>
                {saving ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {saving ? "Enregistrement…" : `Facturer ${selected?.conduces.length ?? 0} Conduce${(selected?.conduces.length ?? 0) > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-2 text-navy" role="status" aria-label="Chargement"><Spinner size={18} /></div>
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
    : "·";
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-ink truncate"><FileText size={14} className="inline mr-1.5 text-amber-700" />{invoice.file_name || "Facture MCPACK"}</p>
          <p className="text-[11px] text-mute mt-0.5">Enregistrée le {date} · {invoice.matched_package_count} colis associés
            {invoice.invoice_total_lbs != null && <> · <b className="text-ink">{Number(invoice.invoice_total_lbs).toFixed(2)} lb</b></>}
            {invoice.invoice_total_usd != null && <> · <b className="text-ink">${Number(invoice.invoice_total_usd).toFixed(2)}</b></>}
          </p>
          <p className="text-[11px] text-navy font-semibold mt-1.5">
            {invoice.conduces.map((line) => line.conduce?.conduce_number ?? "·").join(" · ")}
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
