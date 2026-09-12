"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, BarChart3, CalendarDays, Download, FileText, Landmark, RefreshCw, UsersRound, WalletCards } from "lucide-react";
import Loader from "@/components/Loader";
import { supabase } from "@/lib/supabase";
import { invoiceRemainingAmounts, paymentStatusFromAmounts } from "@/lib/invoice-payable";

type InvoiceRow = {
  id: string; invoice_number: string; customer_code: string; grand_total: number; total_usd: number; total_htg: number;
  exchange_rate_used: number; order_deposit: number; balance_due: number; has_pdf: boolean;
  payment_status: string; payment_paid_usd: number; payment_paid_htg: number; created_at: string;
};
type PaymentRow = {
  id: string; invoice_id: string; amount: number; currency: "USD" | "HTG"; amount_usd: number; amount_htg: number;
  applied_usd: number; applied_htg: number; overpayment_amount: number; payment_method: string;
  payment_reference: string; received_by_name: string; recorded_by_role: string; created_at: string;
};
type ClientRow = { customer_code: string; fullname: string; surname: string; ville_id: string | null };
type CityRow = { id: string; name: string; active: boolean };
type ReportData = { invoices: InvoiceRow[]; payments: PaymentRow[]; clients: ClientRow[]; villes: CityRow[] };
type BalanceRow = { customerCode: string; customerName: string; invoiceCount: number; usd: number; htg: number; latestAt: string };

const money = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100;
const usd = (value: unknown) => `$${money(value).toFixed(2)}`;
const htg = (value: unknown) => `${new Intl.NumberFormat("fr-HT", { maximumFractionDigits: 2 }).format(money(value))} HTG`;
const dateText = (value: string) => value ? new Date(value).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }) : "—";
const dateInput = (value: Date) => value.toISOString().slice(0, 10);
const PAYMENT_METHODS = ["Espèces", "MonCash", "NatCash", "Zelle", "Virement bancaire"];

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

/** Rapport financier central : encaissements, soldes et reçus vérifiables. */
export default function RapportsFinanciersPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [villeId, setVilleId] = useState("");
  const [from, setFrom] = useState(() => dateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(() => dateInput(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token ?? "";
      const response = await fetch("/api/admin-financial-report", { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.reason || "Chargement impossible.");
      setData(result as ReportData);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Rapport financier indisponible.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const customerByCode = useMemo(() => new Map((data?.clients ?? []).map((client) => [client.customer_code, client])), [data?.clients]);
  const invoiceById = useMemo(() => new Map((data?.invoices ?? []).map((invoice) => [invoice.id, invoice])), [data?.invoices]);
  const cityById = useMemo(() => new Map((data?.villes ?? []).map((city) => [city.id, city.name])), [data?.villes]);
  const customerMatchesCity = useCallback((customerCode: string) => !villeId || customerByCode.get(customerCode)?.ville_id === villeId, [customerByCode, villeId]);

  const payments = useMemo(() => (data?.payments ?? []).filter((payment) => {
    const invoice = invoiceById.get(payment.invoice_id);
    if (!invoice || !customerMatchesCity(invoice.customer_code)) return false;
    const day = String(payment.created_at ?? "").slice(0, 10);
    return (!from || day >= from) && (!to || day <= to);
  }), [customerMatchesCity, data?.payments, from, invoiceById, to]);

  const zoneInvoices = useMemo(() => (data?.invoices ?? []).filter((invoice) => customerMatchesCity(invoice.customer_code)), [customerMatchesCity, data?.invoices]);
  const receivedUsd = useMemo(() => payments.reduce((total, payment) => total + money(payment.amount_usd), 0), [payments]);
  const receivedHtg = useMemo(() => payments.reduce((total, payment) => total + money(payment.amount_htg), 0), [payments]);
  const paidInvoices = useMemo(() => zoneInvoices.filter((invoice) => paymentStatusFromAmounts(invoice) === "Payé" && invoice.has_pdf).length, [zoneInvoices]);

  const balances = useMemo(() => {
    const rows = new Map<string, BalanceRow>();
    for (const invoice of zoneInvoices) {
      if (!invoice.has_pdf) continue;
      const remaining = invoiceRemainingAmounts(invoice);
      if (remaining.remainingUsd <= 0.009 && remaining.remainingHtg <= 0.009) continue;
      const customer = customerByCode.get(invoice.customer_code);
      const current = rows.get(invoice.customer_code);
      rows.set(invoice.customer_code, {
        customerCode: invoice.customer_code,
        customerName: current?.customerName || [customer?.fullname, customer?.surname].filter(Boolean).join(" "),
        invoiceCount: (current?.invoiceCount ?? 0) + 1,
        usd: money((current?.usd ?? 0) + remaining.remainingUsd),
        htg: money((current?.htg ?? 0) + remaining.remainingHtg),
        latestAt: String(invoice.created_at ?? "") > String(current?.latestAt ?? "") ? invoice.created_at : current?.latestAt ?? invoice.created_at
      });
    }
    return Array.from(rows.values()).sort((left, right) => right.usd - left.usd || right.htg - left.htg || left.customerCode.localeCompare(right.customerCode));
  }, [customerByCode, zoneInvoices]);

  const totalBalanceUsd = useMemo(() => balances.reduce((total, row) => total + row.usd, 0), [balances]);
  const totalBalanceHtg = useMemo(() => balances.reduce((total, row) => total + row.htg, 0), [balances]);
  const byMethod = useMemo(() => PAYMENT_METHODS.map((method) => {
    const rows = payments.filter((payment) => payment.payment_method === method);
    return { method, count: rows.length, usd: rows.reduce((total, row) => total + money(row.amount_usd), 0), htg: rows.reduce((total, row) => total + money(row.amount_htg), 0) };
  }).filter((row) => row.count), [payments]);
  const byCollector = useMemo(() => {
    const rows = new Map<string, { name: string; source: string; count: number; usd: number; htg: number }>();
    for (const payment of payments) {
      const name = payment.received_by_name || "Non précisé";
      const key = `${name}::${payment.recorded_by_role || ""}`;
      const current = rows.get(key) ?? { name, source: payment.recorded_by_role === "admin" ? "Administrateur" : "Point de retrait", count: 0, usd: 0, htg: 0 };
      current.count += 1; current.usd = money(current.usd + money(payment.amount_usd)); current.htg = money(current.htg + money(payment.amount_htg));
      rows.set(key, current);
    }
    return Array.from(rows.values()).sort((left, right) => right.usd - left.usd || right.htg - left.htg || left.name.localeCompare(right.name));
  }, [payments]);

  const exportPayments = () => {
    const lines: Array<Array<string | number>> = [["Date", "Reçu", "Facture", "Client", "Ville", "Montant", "Devise", "USD comptabilisé", "HTG comptabilisé", "Moyen", "Référence", "Reçu par", "Source"]];
    for (const payment of payments) {
      const invoice = invoiceById.get(payment.invoice_id);
      const customer = invoice ? customerByCode.get(invoice.customer_code) : undefined;
      lines.push([String(payment.created_at).slice(0, 10), payment.id, invoice?.invoice_number ?? "", invoice?.customer_code ?? "", cityById.get(customer?.ville_id ?? "") ?? "", payment.amount, payment.currency, payment.amount_usd, payment.amount_htg, payment.payment_method, payment.payment_reference, payment.received_by_name, payment.recorded_by_role]);
    }
    const blob = new Blob(["\ufeff" + lines.map((line) => line.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `STANDA-encaissements-${from || "debut"}-${to || "aujourd-hui"}.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  return <div className="space-y-5 pb-10">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="h-page flex items-center gap-2"><BarChart3 size={23} /> Rapports financiers</h1><p className="mt-1 text-sm text-mute">Encaissements, soldes et reçus confirmés dans une seule vue.</p></div><div className="flex gap-2"><button type="button" onClick={() => void load()} className="btn btn-ghost inline-flex items-center gap-2"><RefreshCw size={16} /> Actualiser</button><button type="button" disabled={!payments.length} onClick={exportPayments} className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-50"><Download size={16} /> Exporter</button></div></div>
    <section className="card grid gap-3 p-4 md:grid-cols-3"><label><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Ville</span><select className="input mt-1" value={villeId} onChange={(event) => setVilleId(event.target.value)}><option value="">Toutes les villes</option>{(data?.villes ?? []).filter((city) => city.active).map((city) => <option value={city.id} key={city.id}>{city.name}</option>)}</select></label><label><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Du</span><input className="input mt-1" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label><label><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Au</span><input className="input mt-1" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label></section>
    {notice && <p role="alert" className="card border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{notice}</p>}
    {loading ? <div className="card py-16"><Loader inline size={56} /></div> : <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<Banknote size={20} />} label="Encaissements de la période" value={usd(receivedUsd)} hint={htg(receivedHtg)} tone="bg-emerald-50 text-emerald-700" /><Metric icon={<WalletCards size={20} />} label="Transactions enregistrées" value={payments.length} hint="Chaque paiement conserve son reçu" tone="bg-blue-50 text-blue-700" /><Metric icon={<Landmark size={20} />} label="Factures réglées" value={paidInvoices} hint="Dans la ville sélectionnée" tone="bg-indigo-50 text-indigo-700" /><Metric icon={<UsersRound size={20} />} label="Soldes à recevoir" value={usd(totalBalanceUsd)} hint={`${htg(totalBalanceHtg)} · ${balances.length} client(s)`} tone="bg-amber-50 text-amber-700" /></section>
      <section className="grid gap-5 xl:grid-cols-2"><FinanceBreakdown title="Par moyen de paiement" rows={byMethod.map((row) => ({ label: row.method, sublabel: `${row.count} transaction${row.count > 1 ? "s" : ""}`, usd: row.usd, htg: row.htg }))} empty="Aucun encaissement dans cette période." /><FinanceBreakdown title="Par personne qui a encaissé" rows={byCollector.map((row) => ({ label: row.name, sublabel: `${row.source} · ${row.count} transaction${row.count > 1 ? "s" : ""}`, usd: row.usd, htg: row.htg }))} empty="Aucun encaissement dans cette période." /></section>
      <section className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4"><div><h2 className="h-sec flex items-center gap-2"><FileText size={19} /> Derniers paiements et reçus</h2><p className="mt-1 text-xs text-mute">Un reçu imprimable est disponible pour chaque paiement confirmé.</p></div><span className="badge bg-slate-100 text-slate-600">{payments.length}</span></div><div className="max-h-[500px] overflow-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr>{["Date", "Facture", "Client", "Montant", "Moyen", "Reçu par", "Reçu"].map((title) => <th className="th" key={title}>{title}</th>)}</tr></thead><tbody>{payments.length ? payments.map((payment, index) => { const invoice = invoiceById.get(payment.invoice_id); const customer = invoice ? customerByCode.get(invoice.customer_code) : undefined; return <tr className={index % 2 ? "bg-mist" : ""} key={payment.id}><td className="td whitespace-nowrap">{dateText(payment.created_at)}</td><td className="td font-bold text-navy">{invoice?.invoice_number ?? "—"}</td><td className="td"><b>{invoice?.customer_code ?? "—"}</b>{customer && <span className="mt-0.5 block text-xs text-slate-500">{[customer.fullname, customer.surname].filter(Boolean).join(" ") || "—"}</span>}</td><td className="td text-right font-bold">{payment.currency === "USD" ? usd(payment.amount) : htg(payment.amount)}</td><td className="td">{payment.payment_method || "Espèces"}{payment.payment_reference && <span className="mt-0.5 block text-xs text-slate-500">{payment.payment_reference}</span>}</td><td className="td">{payment.received_by_name || "—"}<span className="mt-0.5 block text-xs text-slate-500">{payment.recorded_by_role === "admin" ? "Admin direct" : "Point de retrait"}</span></td><td className="td"><Link className="inline-flex items-center gap-1 text-xs font-bold text-navy underline" href={`/recu-paiement/${payment.id}`} target="_blank"><FileText size={14} /> Reçu</Link></td></tr>; }) : <tr><td colSpan={7} className="py-10 text-center text-slate-400">Aucun paiement dans cette période.</td></tr>}</tbody></table></div></section>
      <section className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4"><div><h2 className="h-sec flex items-center gap-2"><CalendarDays size={19} /> Clients avec un solde à régler</h2><p className="mt-1 text-xs text-mute">Les montants reprennent les factures envoyées au client, pas une estimation.</p></div><span className="badge bg-amber-100 text-amber-800">{balances.length} client{balances.length > 1 ? "s" : ""}</span></div><div className="max-h-[430px] overflow-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr>{["Client", "Ville", "Factures", "Solde USD", "Solde HTG", "Dernière facture"].map((title) => <th className="th" key={title}>{title}</th>)}</tr></thead><tbody>{balances.length ? balances.map((row, index) => { const customer = customerByCode.get(row.customerCode); return <tr key={row.customerCode} className={index % 2 ? "bg-mist" : ""}><td className="td"><b className="text-navy">{row.customerCode}</b>{row.customerName && <span className="mt-0.5 block text-xs text-slate-500">{row.customerName}</span>}</td><td className="td">{cityById.get(customer?.ville_id ?? "") ?? "—"}</td><td className="td">{row.invoiceCount}</td><td className="td text-right font-bold text-amber-800">{usd(row.usd)}</td><td className="td text-right font-bold text-amber-800">{htg(row.htg)}</td><td className="td whitespace-nowrap">{dateText(row.latestAt)}</td></tr>; }) : <tr><td colSpan={6} className="py-10 text-center text-slate-400">Aucun solde à recevoir pour cette sélection.</td></tr>}</tbody></table></div></section>
    </>}
  </div>;
}

function Metric({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: string | number; hint: string; tone: string }) {
  return <article className="card p-4"><div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${tone}`}>{icon}</div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-0.5 text-2xl font-black text-navy">{value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p></article>;
}

function FinanceBreakdown({ title, rows, empty }: { title: string; rows: Array<{ label: string; sublabel: string; usd: number; htg: number }>; empty: string }) {
  return <section className="card overflow-hidden"><div className="border-b border-line p-4"><h2 className="h-sec">{title}</h2></div><div className="divide-y divide-line">{rows.length ? rows.map((row) => <div className="flex items-center justify-between gap-3 p-4" key={row.label}><div><p className="font-bold text-navy">{row.label}</p><p className="mt-0.5 text-xs text-slate-500">{row.sublabel}</p></div><div className="text-right"><p className="font-black text-navy">{usd(row.usd)}</p><p className="text-xs text-slate-500">{htg(row.htg)}</p></div></div>) : <p className="p-6 text-center text-sm text-slate-400">{empty}</p>}</div></section>;
}
