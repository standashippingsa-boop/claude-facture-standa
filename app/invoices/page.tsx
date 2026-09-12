"use client";
import { useEffect, useState } from "react";
import { Banknote, Eye, Download, Printer, Send, XCircle } from "lucide-react";
import { cancelInvoice, getInvoiceItems, getInvoices, getSettings, recordInvoicePayment, saveInvoicePdfPath } from "@/lib/db";
import { useRole } from "@/lib/authx";
import RefreshButton from "@/components/RefreshButton";
import FilterConsole from "@/components/FilterConsole";
import { generateUploadDownload, openInvoicePdf } from "@/lib/pdf";
import { sendInvoicePdfWhatsApp } from "@/lib/whatsapp";
import { Invoice } from "@/lib/types";
import { invoicePayableAmounts, invoiceRemainingAmounts, paymentStatusFromAmounts } from "@/lib/invoice-payable";
import { dateFr, htg, usd } from "@/lib/utils";
import { useRememberListContext } from "@/lib/list-context";
import { openSecureDocument } from "@/lib/secure-document";

const PAYMENT_METHODS = ["Espèces", "MonCash", "NatCash", "Zelle", "Virement bancaire"];
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
  const [footer, setFooter] = useState("Mèsi paske ou fè STANDA COMMERCIAL konfyans.");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { role, staff } = useRole();
  const staffName = staff ? `${staff.prenom ?? ""} ${staff.nom ?? ""}`.trim() || (staff.username ?? "") : "";

  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState<"USD" | "HTG">("USD");
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const load = async () => {
    await getInvoices().then(setInvoices).catch((e) => setNotice("Erè: " + e.message));
    await getSettings().then((s) => s.invoice_footer && setFooter(s.invoice_footer)).catch(() => {});
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const withItems = async (inv: Invoice) => ({ inv, items: await getInvoiceItems(inv.id) });

  /** ANNULER une facture (koreksyon erè) — koli yo retounen "Disponible" pou refakturasyon. */
  const annuler = async (inv: Invoice) => {
    if (!confirm(
      `Annuler la facture ${inv.invoice_number} ?\n\n` +
      `Client : ${inv.customer_name}\n` +
      `Montant : ${usd(inv.total_usd)}\n` +
      `Colis : ${inv.package_count}\n\n` +
      `➜ Les colis redeviendront « Disponible » et pourront être re-facturés.\n` +
      `➜ La facture sera supprimée définitivement.\n` +
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
    setPaymentAmount("");
    setPaymentCurrency("USD");
    setPaymentMethod(PAYMENT_METHODS[0]);
    setPaymentReference("");
    setPaymentError(null);
  };

  const confirmPayment = async () => {
    if (!paymentTarget) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setPaymentError("Entrez un montant valide."); return; }
    setPaymentBusy(true);
    setPaymentError(null);
    try {
      const result = await recordInvoicePayment({
        invoiceId: paymentTarget.id, amount, currency: paymentCurrency,
        paymentMethod, paymentReference, who: staffName
      });
      const extra = result.overpaymentAmount > 0.009
        ? ` Arrondi accepté : ${result.overpaymentAmount.toFixed(2)} ${paymentCurrency}.` : "";
      setInvoices((prev) => prev.map((x) => x.id === paymentTarget.id
        ? { ...x, payment_status: result.paymentStatus, payment_paid_usd: result.paidUsd, payment_paid_htg: result.paidHtg }
        : x));
      setNotice(`✅ Paiement enregistré sur ${paymentTarget.invoice_number} : ${result.paymentStatus}.${extra}`);
      setPaymentTarget(null);
    } catch (e: any) {
      setPaymentError(e?.message ?? "Paiement impossible.");
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
                    <button title="Annuler la facture (colis redeviennent Disponible)"
                      className="text-slate-400 hover:text-red-600 ml-3" disabled={busy}
                      onClick={() => annuler(f)}><XCircle size={16} /></button>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {notice && <p className="card px-4 py-3 text-sm text-navy">{notice}</p>}

      {paymentTarget && (() => {
        const remainingUsd = invoiceRemainingAmounts(paymentTarget).remainingUsd;
        return (
          <div className="fixed inset-0 z-[70] grid place-items-center bg-navy/35 p-4" role="dialog" aria-modal="true" aria-label="Enregistrer un paiement">
            <div className="card w-full max-w-sm p-5 shadow-lift">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Banknote size={20} /></span>
                <div className="min-w-0">
                  <h2 className="text-base font-extrabold text-navy">Enregistrer un paiement</h2>
                  <p className="mt-1 text-xs text-mute">{paymentTarget.invoice_number} · {paymentTarget.customer_name}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-mute">Reste à payer : <b className="text-ink">{usd(remainingUsd)}</b></p>
              <div className="mt-3 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wide text-mute">
                  Montant
                  <div className="mt-1 flex gap-2">
                    <input type="number" inputMode="decimal" min={0.01} step={0.01} className="input flex-1"
                      value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} disabled={paymentBusy} autoFocus />
                    <select className="input !w-24" value={paymentCurrency} onChange={(e) => setPaymentCurrency(e.target.value as "USD" | "HTG")} disabled={paymentBusy}>
                      <option value="USD">USD</option>
                      <option value="HTG">HTG</option>
                    </select>
                  </div>
                </label>
                <label className="block text-xs font-bold uppercase tracking-wide text-mute">
                  Méthode
                  <select className="input mt-1" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} disabled={paymentBusy}>
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-bold uppercase tracking-wide text-mute">
                  Référence (optionnel)
                  <input type="text" className="input mt-1" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} disabled={paymentBusy} placeholder="No transaction, chèque…" />
                </label>
              </div>
              {paymentError && <p className="mt-3 text-xs font-semibold text-red-600">{paymentError}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button className="btn btn-ghost" onClick={() => setPaymentTarget(null)} disabled={paymentBusy}>Annuler</button>
                <button className="btn btn-brand" onClick={confirmPayment} disabled={paymentBusy || !paymentAmount}>
                  {paymentBusy ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
