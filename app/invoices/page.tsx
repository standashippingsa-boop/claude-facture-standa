"use client";
import { useEffect, useState } from "react";
import { Banknote, Eye, Download, Printer, Send, XCircle, Scale } from "lucide-react";
import { cancelInvoice, closeInvoicePayments, getInvoiceItems, getInvoices, getSettings, getUnsettledAgentPaymentIdsByInvoice, saveInvoicePdfPath } from "@/lib/db";
import { useRole } from "@/lib/authx";
import RefreshButton from "@/components/RefreshButton";
import { Spinner } from "@/components/Loader";
import FilterConsole from "@/components/FilterConsole";
import { generateUploadDownload, openInvoicePdf } from "@/lib/pdf";
import { sendInvoicePdfWhatsApp } from "@/lib/whatsapp";
import { Invoice } from "@/lib/types";
import { invoicePayableAmounts, invoiceRemainingAmounts, paymentStatusFromAmounts } from "@/lib/invoice-payable";
import { dateFr, htg, usd } from "@/lib/utils";
import { useRememberListContext } from "@/lib/list-context";
import { openSecureDocument } from "@/lib/secure-document";

import { useNoticeToast } from "@/lib/notify";
import { supabase } from "@/lib/supabase";
import ClientPaymentForm, { PaymentModal, type ClientPaymentSubmit } from "@/components/ClientPaymentForm";
import { invoiceStatusLines, type PaymentInvoice } from "@/lib/payment-allocation";
const PAYMENT_TONE: Record<string, string> = {
  "Payé": "bg-emerald-100 text-emerald-700",
  "Payé partiel": "bg-amber-100 text-amber-800",
  "Non payé": "bg-red-100 text-red-700"
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [fromF, setFromF] = useState("");
  const [toF, setToF] = useState("");
  const [customerF, setCustomerF] = useState("");
  const [minTotal, setMinTotal] = useState("");
  const [maxTotal, setMaxTotal] = useState("");
  useRememberListContext("invoices", { search, fromF, toF, customerF, minTotal, maxTotal }, (saved) => {
    const text = (name: string) => typeof saved[name] === "string" ? saved[name] : "";
    setSearch(text("search")); setFromF(text("fromF")); setToF(text("toF"));
    setCustomerF(text("customerF")); setMinTotal(text("minTotal")); setMaxTotal(text("maxTotal"));
  });
  // Lyen "Voir les factures" fich kliyan an (/invoices?client=MC-XXXX): kouri
  // APRE restorasyon filtè sovgade yo (efè deklare apre), donk kliyan nan URL
  // la toujou genyen, epi lòt filtè yo vide pou tout fakti li parèt.
  useEffect(() => {
    const client = new URLSearchParams(window.location.search).get("client")?.trim();
    if (!client) return;
    setCustomerF(client); setSearch(""); setFromF(""); setToF(""); setMinTotal(""); setMaxTotal("");
  }, []);
  const [footer, setFooter] = useState("Mèsi paske ou fè STANDA COMMERCIAL konfyans.");
  const [notice, setNotice] = useState<string | null>(null);
  useNoticeToast(notice, setNotice);
  const [busy, setBusy] = useState(false);
  const { role, staff } = useRole();
  const staffName = staff ? `${staff.prenom ?? ""} ${staff.nom ?? ""}`.trim() || (staff.username ?? "") : "";

  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  useNoticeToast(paymentError, setPaymentError, { tone: "error", title: "Paiement non enregistré" });
  const [unsettledByInvoice, setUnsettledByInvoice] = useState<Map<string, string[]>>(new Map());

  const load = async () => {
    await getInvoices().then(setInvoices).catch((e) => setNotice("Erè: " + e.message));
    await getSettings().then((s) => s.invoice_footer && setFooter(s.invoice_footer)).catch(() => {});
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Bouton "Clôturer" (ADMIN sèlman — RLS pa kite anplwaye li invoice_payments).
  useEffect(() => {
    if (role !== "admin" || !invoices.length) { setUnsettledByInvoice(new Map()); return; }
    let cancelled = false;
    getUnsettledAgentPaymentIdsByInvoice(invoices.map((inv) => inv.id))
      .then((map) => { if (!cancelled) setUnsettledByInvoice(map); });
    return () => { cancelled = true; };
  }, [role, invoices]);

  /** CLÔTURER une facture payée — sort ses paiements agent de la caisse à remettre (voir lib/db.ts). */
  const cloturer = async (inv: Invoice) => {
    const paymentIds = unsettledByInvoice.get(inv.id) ?? [];
    if (!paymentIds.length) return;
    if (!confirm(
      `Clôturer la facture ${inv.invoice_number} ?\n\n` +
      `Les paiements de point de retrait liés à cette facture sortiront de la caisse à remettre et passeront dans l'historique.\n` +
      `➜ Rien n'est supprimé : le paiement, le reçu et le solde client restent intacts.`
    )) return;
    setBusy(true);
    try {
      const result = await closeInvoicePayments(inv.invoice_number, paymentIds);
      setUnsettledByInvoice((prev) => { const next = new Map(prev); next.delete(inv.id); return next; });
      setNotice(`✅ Facture ${inv.invoice_number} clôturée : ${result.settled} paiement(s).`);
    } catch (e: any) {
      setNotice("Erè clôture: " + (e?.message ?? String(e)));
    } finally { setBusy(false); }
  };

  const withItems = async (inv: Invoice) => ({ inv, items: await getInvoiceItems(inv.id) });

  /** ANNULER une facture (koreksyon erè) — koli yo retounen "Disponible" pou refakturasyon. */
  const annuler = async (inv: Invoice) => {
    if (!confirm(
      `Annuler la facture ${inv.invoice_number} ?

` +
      `Client : ${inv.customer_name}
` +
      `Montant : ${usd(inv.total_usd)}
` +
      `Colis : ${inv.package_count}

` +
      `➜ Les colis redeviendront « Disponible » et pourront être re-facturés.
` +
      `➜ La facture sera supprimée définitivement.
` +
      `➜ L'opération est enregistrée dans l'audit.`
    )) return;
    setBusy(true);
    try {
      const r = await cancelInvoice(inv.id);
      if (r.ok) {
        setNotice(`✅ Facture ${inv.invoice_number} annulée — ${r.restored} colis remis en « Disponible ».`);
        setInvoices((prev) => prev.filter((x) => x.id !== inv.id));
      } else {
        setNotice("Erè anilasyon: " + (r.reason ?? "inconnue"));
      }
    } catch (e: any) {
      setNotice("Erè anilasyon: " + (e?.message ?? String(e)));
    } finally { setBusy(false); }
  };

  /** Ouvri panno "Enregistrer un paiement" (ADMIN sèlman — RLS pa kite anplwaye). */
  const startPayment = (inv: Invoice) => {
    setPaymentTarget(inv);
    setPaymentError(null);
  };

  /** Même route serveur que Rapports financiers / Points de retrait : une ou plusieurs lignes de paiement. */
  const confirmPayment = async (payload: ClientPaymentSubmit) => {
    if (!paymentTarget || paymentBusy) return;
    setPaymentBusy(true);
    setPaymentError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      const response = await fetch("/api/admin-invoice-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token, invoice_ids: payload.invoiceIds, lines: payload.lines.map((line) => ({ amount: line.amount, currency: line.currency, payment_method: line.method, payment_reference: line.reference })) })
      });
      const result = await response.json().catch(() => ({ ok: false, reason: "Réponse du serveur illisible. Actualisez avant de réessayer." }));
      if (!response.ok || !result.ok) throw new Error(result.reason || "Paiement impossible.");
      setNotice(`✅ Paiement enregistré — ${payload.summary}\n${invoiceStatusLines(result.payments ?? [])}`);
      setPaymentTarget(null);
      await load();
    } catch (e: unknown) {
      setPaymentError((e as Error)?.message ?? "Paiement impossible.");
    } finally { setPaymentBusy(false); }
  };

  const voir = async (inv: Invoice) => {
    if (inv.has_pdf || inv.pdf_path || inv.pdf_url) {
      try { await openSecureDocument("invoice", inv.id); }
      catch (error) { setNotice(error instanceof Error ? error.message : "PDF indisponible."); }
      return;
    }
    const { items } = await withItems(inv);
    await openInvoicePdf(inv, items, footer);
  };
  const telecharger = async (inv: Invoice) => {
    const { items } = await withItems(inv);
    const { path } = await generateUploadDownload(inv, items, footer, { download: true });
    if (path && !inv.has_pdf) { await saveInvoicePdfPath(inv.id, path); inv.pdf_path = path; inv.has_pdf = true; }
  };
  const imprimer = async (inv: Invoice) => {
    const { items } = await withItems(inv);
    await generateUploadDownload(inv, items, footer, { autoPrint: true });
  };
  const envoyer = async (inv: Invoice) => {
    const { items } = await withItems(inv);
    // Rejenere PDF la (san telechaje) pou nou ka pataje FICHYE a menm
    const pdf = await generateUploadDownload(inv, items, footer);
    if (pdf.path && !inv.has_pdf) { await saveInvoicePdfPath(inv.id, pdf.path); inv.pdf_path = pdf.path; inv.has_pdf = true; }
    const how = await sendInvoicePdfWhatsApp(inv, pdf.blob, pdf.filename);
    setNotice(how === "file"
      ? `PDF facture ${inv.invoice_number} pataje dirèkteman sou WhatsApp pou ${inv.customer_name}.`
      : how === "manual"
      ? `WhatsApp ouvri pou ${inv.customer_name}. Telechaje PDF la epi atache li nan mesaj la.`
      : "Pataj la anile.");
  };

  const q = search.trim().toLowerCase();
  const filtered = invoices.filter((f) => {
    const date = String(f.created_at ?? "").slice(0, 10);
    if (fromF && date < fromF) return false;
    if (toF && date > toF) return false;
    if (customerF && f.customer_code !== customerF) return false;
    if (minTotal && (Number(f.grand_total) || 0) < Number(minTotal)) return false;
    if (maxTotal && (Number(f.grand_total) || 0) > Number(maxTotal)) return false;
    return !q || f.invoice_number.toLowerCase().includes(q) || f.customer_code.toLowerCase().includes(q) ||
      f.customer_name.toLowerCase().includes(q);
  });
  const customerOptions = Array.from(new Set(invoices.map((invoice) => invoice.customer_code).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }));
  const clearFilters = () => { setSearch(""); setFromF(""); setToF(""); setCustomerF(""); setMinTotal(""); setMaxTotal(""); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-extrabold text-navy">Invoices</h1>
        <RefreshButton onRefresh={load} />
      </div>

      <FilterConsole query={search} onQueryChange={setSearch} queryPlaceholder="No facture, code ou nom client…"
        resultCount={filtered.length} onClear={clearFilters}
        fields={[
          { key: "customer", label: "Code client", type: "select", value: customerF, onChange: setCustomerF, options: customerOptions },
          { key: "from", label: "À partir du", type: "date", value: fromF, onChange: setFromF },
          { key: "to", label: "Jusqu'au", type: "date", value: toF, onChange: setToF },
          { key: "min", label: "Total min. (USD)", type: "number", value: minTotal, onChange: setMinTotal, min: 0, step: 0.01 },
          { key: "max", label: "Total max. (USD)", type: "number", value: maxTotal, onChange: setMaxTotal, min: 0, step: 0.01 },
        ]} />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr>{["Date", "No Facture", "Code Client", "Nom Client", "Sous-total", "Tax", "Total USD", "Taux", "Total HTG", "Paiement", "Actions"]
            .map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-10 text-slate-400">Aucune facture.</td></tr>
            ) : filtered.map((f, i) => {
              const paymentStatus = paymentStatusFromAmounts(f);
              const remaining = invoiceRemainingAmounts(f).remainingUsd;
              return (
              <tr key={f.id} className={i % 2 ? "bg-mist" : ""}>
                <td className="td whitespace-nowrap">{dateFr(f.created_at)}</td>
                <td className="td font-bold text-navy">{f.invoice_number}</td>
                <td className="td">{f.customer_code}</td>
                <td className="td">{f.customer_name}</td>
                <td className="td text-right">{usd(f.subtotal)}</td>
                <td className="td text-right">{usd(f.tax)}</td>
                <td className="td text-right font-bold">{usd(f.grand_total)}</td>
                <td className="td text-right text-xs text-slate-500">{Number(f.exchange_rate_used).toFixed(2)}</td>
                <td className="td text-right font-bold text-navy">{htg(f.total_htg || f.grand_total * f.exchange_rate_used)}</td>
                <td className="td whitespace-nowrap">
                  <span className={`badge ${PAYMENT_TONE[paymentStatus] ?? "bg-slate-100 text-slate-600"}`}>{paymentStatus}</span>
                  {remaining > 0.01 && <span className="block mt-0.5 text-[11px] text-mute">Reste {usd(remaining)}</span>}
                </td>
                <td className="td whitespace-nowrap">
                  <button title="Voir" className="text-navy hover:text-navy-light mr-3" onClick={() => voir(f)}><Eye size={16} /></button>
                  <button title="Télécharger" className="text-navy hover:text-navy-light mr-3" onClick={() => telecharger(f)}><Download size={16} /></button>
                  <button title="Ré-imprimer" className="text-navy hover:text-navy-light mr-3" onClick={() => imprimer(f)}><Printer size={16} /></button>
                  <button title="Envoyer sur WhatsApp" className="text-[#128C4B] hover:text-[#25D366]" onClick={() => envoyer(f)}><Send size={16} /></button>
                  {role === "admin" && remaining > 0.01 && (
                    <button title="Enregistrer un paiement"
                      className="text-emerald-600 hover:text-emerald-800 ml-3" disabled={busy}
                      onClick={() => startPayment(f)}><Banknote size={16} /></button>
                  )}
                  {role === "admin" && (
                    <button title="Annuler la facture"
                      className="text-slate-400 hover:text-red-600 ml-3 disabled:opacity-50" disabled={busy}
                      onClick={() => annuler(f)}>{busy ? <Spinner size={14} /> : <XCircle size={16} />}</button>
                  )}
                  {role === "admin" && paymentStatus === "Payé" && (unsettledByInvoice.get(f.id)?.length ?? 0) > 0 && (
                    <button title="Clôturer la facture"
                      className="text-indigo-600 hover:text-indigo-800 ml-3 disabled:opacity-50" disabled={busy}
                      onClick={() => cloturer(f)}>{busy ? <Spinner size={14} /> : <Scale size={16} />}</button>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>


      {paymentTarget && (() => {
        return (
          <PaymentModal onClose={() => { if (!paymentBusy) setPaymentTarget(null); }}>
            <ClientPaymentForm key={paymentTarget.id} customerCode={paymentTarget.customer_code} customerName={paymentTarget.customer_name}
              invoices={[{ ...paymentTarget, has_pdf: true } as unknown as PaymentInvoice]} initialSelected={[paymentTarget.id]}
              busy={paymentBusy} onSubmit={(payload) => void confirmPayment(payload)} onClose={() => { if (!paymentBusy) setPaymentTarget(null); }} />
          </PaymentModal>
        );
      })()}
    </div>
  );
}
