"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, CircleDollarSign, ClipboardList, PackageCheck, RefreshCw, Truck, X } from "lucide-react";
import { getClients, getInvoices, getPackages, getVilles } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { Client, Invoice, Pkg, Ville } from "@/lib/types";
import { dateFr } from "@/lib/utils";
import { invoicePayableAmounts, invoiceRemainingAmounts, paymentStatusFromAmounts } from "@/lib/invoice-payable";

type PaymentMethod = "Espèces" | "MonCash" | "NatCash" | "Zelle" | "Virement bancaire";
type PaymentRow = { invoice_id: string; amount: number; currency: string; amount_usd: number; amount_htg: number; applied_usd: number; applied_htg: number; overpayment_amount: number; payment_method: PaymentMethod; payment_reference: string; received_by_name: string; recorded_by_role: string; created_at: string };
type PaymentDraft = { invoiceId: string; amount: string; currency: "USD" | "HTG"; method: PaymentMethod; reference: string };
type CustomerBalanceRow = { customerCode: string; customerName: string; invoiceCount: number; oldestInvoiceId: string; oldestInvoiceNumber: string; usd: number; htg: number };
const emptyPaymentDraft = (): PaymentDraft => ({ invoiceId: "", amount: "", currency: "HTG", method: "Espèces", reference: "" });
const usd = (n: number) => `$${Number(n || 0).toFixed(2)}`;
const htg = (n: number) => `${new Intl.NumberFormat("fr-HT", { maximumFractionDigits: 2 }).format(Number(n || 0))} HTG`;

/** Tableau de contrôle réservé à l'administrateur de chaque point de retrait. */
export default function PointsRetraitPage() {
  const [villes, setVilles] = useState<Ville[]>([]);
  const [villeId, setVilleId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(emptyPaymentDraft);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true); setNotice("");
    try {
      const [cityRows, clientRows, packageRows, invoiceRows] = await Promise.all([getVilles(), getClients(), getPackages(undefined, true), getInvoices()]);
      setVilles(cityRows); setClients(clientRows); setPackages(packageRows); setInvoices(invoiceRows);
      if (!villeId) {
        const gonaives = cityRows.find((city) => city.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("gonaives"));
        setVilleId(gonaives?.id ?? cityRows.find((city) => city.active)?.id ?? "");
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Chargement impossible."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const zoneCodes = useMemo(() => new Set(clients.filter((client) => client.ville_id === villeId).map((client) => client.customer_code).filter(Boolean)), [clients, villeId]);
  const zoneInvoices = useMemo(() => invoices.filter((invoice) => zoneCodes.has(invoice.customer_code)), [invoices, zoneCodes]);
  const zonePackages = useMemo(() => packages.filter((item) => zoneCodes.has(item.customer_code)), [packages, zoneCodes]);
  const selectedVille = villes.find((city) => city.id === villeId);
  const balanceCustomers = useMemo(() => {
    const clientByCode = new Map(clients.map((client) => [client.customer_code, client]));
    const rows = new Map<string, CustomerBalanceRow & { oldestCreated: string }>();
    for (const invoice of zoneInvoices) {
      // Yon balans antre nan kontwòl la sèlman lè PDF fakti kliyan an deja pare.
      if (!invoice.has_pdf && !invoice.pdf_path && !invoice.pdf_url) continue;
      const { remainingUsd, remainingHtg } = invoiceRemainingAmounts(invoice);
      if (remainingUsd <= 0.01) continue;
      const current = rows.get(invoice.customer_code);
      const client = clientByCode.get(invoice.customer_code);
      const customerName = [client?.fullname, client?.surname].filter(Boolean).join(" ");
      const older = !current || String(invoice.created_at) < current.oldestCreated;
      rows.set(invoice.customer_code, {
        customerCode: invoice.customer_code, customerName: current?.customerName || customerName,
        invoiceCount: (current?.invoiceCount ?? 0) + 1,
        oldestInvoiceId: older ? invoice.id : current.oldestInvoiceId,
        oldestInvoiceNumber: older ? invoice.invoice_number : current.oldestInvoiceNumber,
        oldestCreated: older ? String(invoice.created_at) : current.oldestCreated,
        usd: Number(((current?.usd ?? 0) + remainingUsd).toFixed(2)),
        htg: Number(((current?.htg ?? 0) + remainingHtg).toFixed(2))
      });
    }
    return Array.from(rows.values()).sort((a, b) => b.usd - a.usd || a.customerCode.localeCompare(b.customerCode));
  }, [clients, zoneInvoices]);

  useEffect(() => {
    if (!zoneInvoices.length) { setPayments([]); return; }
    let cancelled = false;
    supabase.from("invoice_payments").select("invoice_id, amount, currency, amount_usd, amount_htg, applied_usd, applied_htg, overpayment_amount, payment_method, payment_reference, received_by_name, recorded_by_role, created_at")
      .in("invoice_id", zoneInvoices.map((invoice) => invoice.id))
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setNotice(error.message);
        else setPayments((data ?? []) as PaymentRow[]);
      });
    return () => { cancelled = true; };
  }, [zoneInvoices]);

  const delivered = zonePackages.filter((item) => item.status === "Livré");
  const remaining = zonePackages.filter((item) => item.status !== "Livré");
  const paid = zoneInvoices.filter((invoice) => paymentStatusFromAmounts(invoice) === "Payé");
  const partial = zoneInvoices.filter((invoice) => paymentStatusFromAmounts(invoice) === "Payé partiel");
  const paymentLabelByInvoice = useMemo(() => {
    const byInvoice = new Map<string, PaymentRow[]>();
    for (const payment of payments) byInvoice.set(payment.invoice_id, [...(byInvoice.get(payment.invoice_id) ?? []), payment]);
    return new Map(Array.from(byInvoice, ([invoiceId, rows]) => {
      const methods = Array.from(new Set(rows.map((row) => row.payment_method).filter(Boolean)));
      const roles = new Set(rows.map((row) => row.recorded_by_role));
      const source = roles.size === 1 && roles.has("admin") ? " · Administrateur" : roles.size === 1 && roles.has("agent_retrait") ? " · Point de retrait" : roles.size > 1 ? " · Paiements multiples" : "";
      return [invoiceId, methods.length ? "Paiement par " + methods.join(", ") + source : ""];
    }));
  }, [payments]);
  const receivedUsd = payments.reduce((sum, payment) => sum + Number(payment.amount_usd || 0), 0);
  const receivedHtg = payments.reduce((sum, payment) => sum + Number(payment.amount_htg || 0), 0);

  const recordDirectPayment = async () => {
    const amount = Number(paymentDraft.amount);
    if (!paymentDraft.invoiceId || !Number.isFinite(amount) || amount <= 0) { setPaymentError("Entrez un montant valide."); return; }
    setPaymentBusy(true); setPaymentError("");
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/admin-invoice-payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: data.session?.access_token ?? "", invoice_id: paymentDraft.invoiceId, amount, currency: paymentDraft.currency, payment_method: paymentDraft.method, payment_reference: paymentDraft.reference }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.reason || "Paiement impossible.");
      const extra = Number(result.overpayment_amount || 0) > 0.009 ? ` Arrondi accepté: ${Number(result.overpayment_amount).toFixed(2)} ${result.currency}.` : "";
      setNotice(`Paiement direct administrateur enregistré: ${result.payment_status}.${extra}`);
      setPaymentDraft(emptyPaymentDraft());
      await load();
    } catch (error) { setPaymentError(error instanceof Error ? error.message : "Paiement impossible."); }
    finally { setPaymentBusy(false); }
  };

  return <div className="space-y-5 pb-10">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="h-page flex items-center gap-2"><Truck size={22} /> Points de retrait</h1><p className="mt-0.5 text-sm text-mute">Contrôle des paiements, colis remis et colis restants par zone.</p></div><button onClick={() => void load()} className="btn btn-ghost inline-flex items-center gap-2"><RefreshCw size={16} />Actualiser</button></div>
    <section className="card p-4"><label className="block max-w-md"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Point / ville</span><select value={villeId} onChange={(event) => setVilleId(event.target.value)} className="input mt-1"><option value="">Choisir une ville</option>{villes.filter((city) => city.active).map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label></section>
    {notice && <p className="card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{notice}</p>}
    {loading ? <div className="card p-10 text-center text-sm text-slate-500">Chargement…</div> : !villeId ? <div className="card p-10 text-center text-sm text-slate-500">Choisissez un point de retrait.</div> : <>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<Banknote size={20} />} label="Factures entièrement payées" value={paid.length} hint={`${partial.length} paiement(s) partiel(s)`} tint="bg-emerald-50 text-emerald-700" /><Metric icon={<CheckCircle2 size={20} />} label="Colis remis" value={delivered.length} hint={`${zoneCodes.size} client(s) dans ${selectedVille?.name ?? "la zone"}`} tint="bg-indigo-50 text-indigo-700" /><Metric icon={<PackageCheck size={20} />} label="Colis restant à remettre" value={remaining.length} hint="En route, disponible ou facturé" tint="bg-orange-50 text-orange-700" /><Metric icon={<ClipboardList size={20} />} label="Paiements reçus" value={usd(receivedUsd)} hint={htg(receivedHtg)} tint="bg-blue-50 text-blue-700" /></section>
      <section className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4"><div><h2 className="h-sec flex items-center gap-2"><CircleDollarSign size={20} /> Clients avec un solde</h2><p className="mt-1 text-xs text-mute">Ces soldes bloquent la remise de tout nouveau colis jusqu&apos;au règlement complet.</p></div><span className="badge bg-amber-100 text-amber-800">{balanceCustomers.length} client{balanceCustomers.length > 1 ? "s" : ""}</span></div><div className="max-h-[330px] overflow-auto"><table className="w-full text-sm"><thead><tr>{["Client", "Factures impayées", "Solde à régler", "Action"].map((title) => <th className="th" key={title}>{title}</th>)}</tr></thead><tbody>{balanceCustomers.length ? balanceCustomers.map((row, index) => <tr key={row.customerCode} className={index % 2 ? "bg-mist" : ""}><td className="td"><b className="text-navy">{row.customerCode}</b>{row.customerName && <span className="mt-0.5 block text-xs text-slate-500">{row.customerName}</span>}</td><td className="td">{row.invoiceCount} facture{row.invoiceCount > 1 ? "s" : ""}<span className="mt-0.5 block text-xs text-slate-500">À partir de {row.oldestInvoiceNumber}</span></td><td className="td text-right font-bold text-amber-800">{usd(row.usd)}<span className="mt-0.5 block text-xs font-normal text-slate-500">{htg(row.htg)}</span></td><td className="td"><button type="button" onClick={() => { setPaymentDraft({ ...emptyPaymentDraft(), invoiceId: row.oldestInvoiceId }); setPaymentError(""); }} className="whitespace-nowrap text-xs font-bold text-navy underline">Régler la facture</button></td></tr>) : <tr><td className="py-8 text-center text-slate-400" colSpan={4}>Aucun solde impayé dans cette zone.</td></tr>}</tbody></table></div></section>
      {paymentDraft.invoiceId && <AdminPaymentPanel invoice={zoneInvoices.find((invoice) => invoice.id === paymentDraft.invoiceId) ?? null} draft={paymentDraft} setDraft={setPaymentDraft} busy={paymentBusy} error={paymentError} onChange={() => setPaymentError("")} onClose={() => { setPaymentDraft(emptyPaymentDraft()); setPaymentError(""); }} onSubmit={() => void recordDirectPayment()} />}
      <section className="grid gap-5 xl:grid-cols-2"><div className="card overflow-hidden"><div className="border-b border-line p-4"><h2 className="h-sec">Factures {selectedVille?.name}</h2><p className="mt-1 text-xs text-mute">Le montant à encaisser est toujours celui indiqué sur la facture envoyée au client.</p></div><div className="max-h-[430px] overflow-auto"><table className="w-full text-sm"><thead><tr>{["Facture", "Client", "À encaisser", "État", "Action"].map((title) => <th className="th" key={title}>{title}</th>)}</tr></thead><tbody>{zoneInvoices.length ? zoneInvoices.map((invoice, index) => { const amounts = invoicePayableAmounts(invoice); const status = paymentStatusFromAmounts(invoice); const issued = Boolean(invoice.has_pdf || invoice.pdf_path || invoice.pdf_url); const paymentLabel = paymentLabelByInvoice.get(invoice.id); const paymentText = status === "Payé" ? paymentLabel?.replace("Paiement par", "Payé par") : paymentLabel; return <tr key={invoice.id} className={index % 2 ? "bg-mist" : ""}><td className="td font-bold text-navy">{invoice.invoice_number}<span className="mt-0.5 block text-[11px] font-normal text-slate-400">{dateFr(invoice.created_at)}</span></td><td className="td">{invoice.customer_code}</td><td className="td text-right">{issued ? <>{usd(amounts.payableUsd)}<span className="mt-0.5 block text-[11px] text-slate-500">{htg(amounts.payableHtg)}</span></> : <span className="text-xs text-slate-400">PDF à générer</span>}</td><td className="td"><PaymentStatus status={status} />{paymentText && <span className="mt-1 block text-[11px] font-semibold text-emerald-700">{paymentText}</span>}</td><td className="td">{!issued ? <span className="text-xs text-slate-400">Facture client requise</span> : status !== "Payé" && <button type="button" onClick={() => { setPaymentDraft({ ...emptyPaymentDraft(), invoiceId: invoice.id }); setPaymentError(""); }} className="whitespace-nowrap text-xs font-bold text-navy underline">Paiement direct</button>}</td></tr>; }) : <tr><td className="py-8 text-center text-slate-400" colSpan={5}>Aucune facture.</td></tr>}</tbody></table></div></div>
        <div className="card overflow-hidden"><div className="border-b border-line p-4"><h2 className="h-sec">Derniers paiements reçus</h2><p className="mt-1 text-xs text-mute">Méthode, montant, éventuel arrondi, personne et date restent enregistrés.</p></div><div className="max-h-[430px] overflow-auto"><table className="w-full text-sm"><thead><tr>{["Date", "Facture", "Montant", "Méthode", "Reçu par"].map((title) => <th className="th" key={title}>{title}</th>)}</tr></thead><tbody>{payments.length ? payments.map((payment, index) => { const invoice = zoneInvoices.find((row) => row.id === payment.invoice_id); return <tr key={`${payment.invoice_id}-${payment.created_at}-${index}`} className={index % 2 ? "bg-mist" : ""}><td className="td whitespace-nowrap">{dateFr(payment.created_at)}</td><td className="td font-semibold text-navy">{invoice?.invoice_number ?? "—"}</td><td className="td text-right">{payment.currency === "USD" ? usd(payment.amount) : htg(payment.amount)}{Number(payment.overpayment_amount || 0) > 0.009 && <span className="mt-0.5 block text-[11px] text-amber-700">Arrondi: {payment.currency === "USD" ? usd(payment.overpayment_amount) : htg(payment.overpayment_amount)}</span>}</td><td className="td">{payment.payment_method || "Espèces"}{payment.payment_reference && <span className="mt-0.5 block text-[11px] text-slate-500">{payment.payment_reference}</span>}</td><td className="td">{payment.received_by_name || "—"}<span className="mt-0.5 block text-[11px] text-slate-500">{payment.recorded_by_role === "admin" ? "Admin direct" : "Point de retrait"}</span></td></tr>; }) : <tr><td className="py-8 text-center text-slate-400" colSpan={5}>Aucun paiement enregistré.</td></tr>}</tbody></table></div></div></section>
      <section className="card overflow-hidden"><div className="border-b border-line p-4"><h2 className="h-sec">Colis remis et restant à remettre</h2><p className="mt-1 text-xs text-mute">Vue complète de la zone: les colis livrés sont séparés de ceux qui attendent encore.</p></div><div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0"><PackageList title="Restant à remettre" items={remaining} tone="text-orange-700" /><PackageList title="Déjà remis" items={delivered} tone="text-emerald-700" /></div></section>
    </>}
  </div>;
}

function Metric({ icon, label, value, hint, tint }: { icon: React.ReactNode; label: string; value: string | number; hint: string; tint: string }) { return <div className="card p-4"><div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${tint}`}>{icon}</div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-0.5 text-2xl font-black text-navy">{value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p></div>; }
function AdminPaymentPanel({ invoice, draft, setDraft, busy, error, onChange, onClose, onSubmit }: { invoice: Invoice | null; draft: PaymentDraft; setDraft: (draft: PaymentDraft) => void; busy: boolean; error: string; onChange: () => void; onClose: () => void; onSubmit: () => void }) {
  if (!invoice) return null;
  const { remainingUsd, remainingHtg } = invoiceRemainingAmounts(invoice);
  return <section className="card border border-blue-200 bg-blue-50/50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Paiement reçu directement par administrateur</p><h2 className="mt-1 text-lg font-black text-navy">{invoice.invoice_number} · {invoice.customer_code}</h2><p className="mt-1 text-xs font-semibold text-slate-500">Montant identique à la facture envoyée au client</p><p className="mt-1 text-sm text-slate-600">Solde: <b>{usd(remainingUsd)}</b> · {htg(remainingHtg)}</p></div><button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-1 text-slate-500 hover:bg-white"><X size={18} /></button></div><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4"><input value={draft.amount} onChange={(event) => { setDraft({ ...draft, amount: event.target.value }); onChange(); }} type="number" min="0.01" step="0.01" className="input" placeholder="Montant reçu" autoFocus /><select value={draft.currency} onChange={(event) => { setDraft({ ...draft, currency: event.target.value as "USD" | "HTG" }); onChange(); }} className="input"><option value="HTG">Gourdes</option><option value="USD">Dollars</option></select><select value={draft.method} onChange={(event) => { setDraft({ ...draft, method: event.target.value as PaymentMethod }); onChange(); }} className="input"><option value="Espèces">Espèces</option><option value="MonCash">MonCash</option><option value="NatCash">NatCash</option><option value="Zelle">Zelle</option><option value="Virement bancaire">Virement bancaire</option></select><input value={draft.reference} onChange={(event) => { setDraft({ ...draft, reference: event.target.value.slice(0, 120) }); onChange(); }} className="input" placeholder="Référence (facultatif)" /></div>{error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}<button type="button" disabled={busy} onClick={onSubmit} className="mt-3 min-h-11 rounded-xl bg-navy px-4 text-sm font-bold text-white disabled:opacity-60">{busy ? "Enregistrement…" : "Confirmer le paiement"}</button></section>;
}
function PaymentStatus({ status }: { status: string }) { const style = status === "Payé" ? "bg-emerald-100 text-emerald-700" : status === "Payé partiel" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"; return <span className={`badge ${style}`}>{status}</span>; }
function PackageList({ title, items, tone }: { title: string; items: Pkg[]; tone: string }) { return <div className="p-4"><div className="mb-3 flex items-center justify-between"><h3 className={`text-sm font-bold ${tone}`}>{title}</h3><span className="badge bg-slate-100 text-slate-600">{items.length}</span></div><div className="max-h-80 space-y-2 overflow-auto">{items.length ? items.map((item) => <div key={item.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm"><div className="flex justify-between gap-3"><b className="text-navy">{item.customer_code}</b><span className="text-xs font-semibold text-slate-500">{item.status}</span></div><p className="mt-0.5 break-all text-xs text-slate-500">{item.tracking_manual || item.tracking_number} · Qté {item.quantity}</p></div>) : <p className="py-6 text-center text-sm text-slate-400">Aucun colis.</p>}</div></div>; }
