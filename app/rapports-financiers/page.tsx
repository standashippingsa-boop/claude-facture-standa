"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, BarChart3, CalendarDays, CheckCircle2, CircleDollarSign, Download, FileText, History, Landmark, RefreshCw, Scale, UsersRound, WalletCards, X } from "lucide-react";
import Loader from "@/components/Loader";
import { supabase } from "@/lib/supabase";
import { hasSignificantInvoiceBalance, invoicePayableAmounts, invoiceRemainingAmounts, parsePaymentAmount, paymentStatusFromAmounts } from "@/lib/invoice-payable";

type InvoiceRow = {
  id: string; invoice_number: string; customer_code: string; grand_total: number; total_usd: number; total_htg: number;
  exchange_rate_used: number; order_deposit: number; balance_due: number; has_pdf: boolean;
  payment_status: string; payment_paid_usd: number; payment_paid_htg: number; created_at: string;
};
type PaymentRow = {
  id: string; invoice_id: string; amount: number; currency: "USD" | "HTG"; amount_usd: number; amount_htg: number;
  applied_usd: number; applied_htg: number; overpayment_amount: number; payment_method: string;
  payment_reference: string; received_by_name: string; received_by_staff_id: string | null; recorded_by_role: string; created_at: string;
  settled_at?: string | null; settled_by?: string;
};
type ClientRow = { customer_code: string; fullname: string; surname: string; ville_id: string | null };
type CityRow = { id: string; name: string; active: boolean };
type AgentRow = { id: string; pickup_ville_id: string | null };
type ReportData = { invoices: InvoiceRow[]; payments: PaymentRow[]; clients: ClientRow[]; villes: CityRow[]; agents: AgentRow[]; settlement_ready: boolean };
type BalanceRow = { customerCode: string; customerName: string; invoiceCount: number; usd: number; htg: number; latestAt: string; oldestInvoiceId: string; oldestInvoiceNumber: string; oldestAt: string };
type PaymentDraft = { invoiceId: string; amount: string; currency: "USD" | "HTG"; method: string; reference: string };

const money = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100;
const usd = (value: unknown) => `$${money(value).toFixed(2)}`;
const htg = (value: unknown) => `${new Intl.NumberFormat("fr-HT", { maximumFractionDigits: 2 }).format(money(value))} HTG`;
const dateText = (value: string) => value ? new Date(value).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }) : "—";
const dateInput = (value: Date) => value.toISOString().slice(0, 10);
const PAYMENT_METHODS = ["Espèces", "MonCash", "NatCash", "Zelle", "Virement bancaire"];
const emptyPaymentDraft = (): PaymentDraft => ({ invoiceId: "", amount: "", currency: "HTG", method: "Espèces", reference: "" });

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
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(emptyPaymentDraft);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [showSettled, setShowSettled] = useState(false);
  const [settleConfirm, setSettleConfirm] = useState(false);
  const [settleBusy, setSettleBusy] = useState(false);
  const [settleNotice, setSettleNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);

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

  // Un paiement clôturé sort du rapport (il n'est jamais supprimé) : on le montre seulement sur demande.
  const payments = useMemo(() => (data?.payments ?? []).filter((payment) => {
    if (payment.settled_at && !showSettled) return false;
    const invoice = invoiceById.get(payment.invoice_id);
    if (!invoice || !customerMatchesCity(invoice.customer_code)) return false;
    const day = String(payment.created_at ?? "").slice(0, 10);
    return (!from || day >= from) && (!to || day <= to);
  }), [customerMatchesCity, data?.payments, from, invoiceById, showSettled, to]);

  // Paiements encaissés par les points de retrait de la ville choisie et pas encore clôturés,
  // quelle que soit la période affichée : c'est la caisse que les agents remettent.
  const cityName = cityById.get(villeId) ?? "";
  const settleCandidates = useMemo(() => {
    if (!villeId) return [];
    const agentCity = new Map((data?.agents ?? []).map((agent) => [agent.id, agent.pickup_ville_id]));
    return (data?.payments ?? []).filter((payment) => {
      if (payment.recorded_by_role !== "agent_retrait" || payment.settled_at) return false;
      const invoice = invoiceById.get(payment.invoice_id);
      const inCity = invoice ? customerByCode.get(invoice.customer_code)?.ville_id === villeId : false;
      return inCity || agentCity.get(payment.received_by_staff_id ?? "") === villeId;
    });
  }, [customerByCode, data?.agents, data?.payments, invoiceById, villeId]);
  const settleTotals = useMemo(() => settleCandidates.reduce((total, payment) => ({
    usd: total.usd + (payment.currency === "USD" ? money(payment.amount) : 0),
    htg: total.htg + (payment.currency === "HTG" ? money(payment.amount) : 0)
  }), { usd: 0, htg: 0 }), [settleCandidates]);

  const zoneInvoices = useMemo(() => (data?.invoices ?? []).filter((invoice) => customerMatchesCity(invoice.customer_code)), [customerMatchesCity, data?.invoices]);
  const receivedUsd = useMemo(() => payments.reduce((total, payment) => total + money(payment.amount_usd), 0), [payments]);
  const receivedHtg = useMemo(() => payments.reduce((total, payment) => total + money(payment.amount_htg), 0), [payments]);
  const paidInvoices = useMemo(() => zoneInvoices.filter((invoice) => paymentStatusFromAmounts(invoice) === "Payé" && invoice.has_pdf).length, [zoneInvoices]);

  const balances = useMemo(() => {
    const rows = new Map<string, BalanceRow>();
    for (const invoice of zoneInvoices) {
      if (!invoice.has_pdf) continue;
      const remaining = invoiceRemainingAmounts(invoice);
      if (!hasSignificantInvoiceBalance(invoice)) continue;
      const customer = customerByCode.get(invoice.customer_code);
      const current = rows.get(invoice.customer_code);
      const isOlder = !current || String(invoice.created_at ?? "") < String(current.oldestAt ?? "");
      rows.set(invoice.customer_code, {
        customerCode: invoice.customer_code,
        customerName: current?.customerName || [customer?.fullname, customer?.surname].filter(Boolean).join(" "),
        invoiceCount: (current?.invoiceCount ?? 0) + 1,
        usd: money((current?.usd ?? 0) + remaining.remainingUsd),
        htg: money((current?.htg ?? 0) + remaining.remainingHtg),
        latestAt: String(invoice.created_at ?? "") > String(current?.latestAt ?? "") ? invoice.created_at : current?.latestAt ?? invoice.created_at,
        oldestInvoiceId: isOlder ? invoice.id : current!.oldestInvoiceId,
        oldestInvoiceNumber: isOlder ? invoice.invoice_number : current!.oldestInvoiceNumber,
        oldestAt: isOlder ? invoice.created_at : current!.oldestAt
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

  const customerHistory = useMemo(() => {
    const rows = new Map<string, { code: string; name: string; city: string; invoiceCount: number; paidUsd: number; paidHtg: number; lastInvoiceAt: string; lastPaymentAt: string }>();
    for (const customer of data?.clients ?? []) {
      // Un profil en attente d'activation n'a pas encore de code client
      // (customer_code = null, cf. /api/register-client) — rien à montrer
      // ici tant qu'il n'a ni facture ni paiement, et code null ferait
      // planter le tri plus bas (.localeCompare sur null).
      if (!customer.customer_code) continue;
      if (!customerMatchesCity(customer.customer_code)) continue;
      rows.set(customer.customer_code, {
        code: customer.customer_code,
        name: [customer.fullname, customer.surname].filter(Boolean).join(" "),
        city: cityById.get(customer.ville_id ?? "") ?? "",
        invoiceCount: 0, paidUsd: 0, paidHtg: 0, lastInvoiceAt: "", lastPaymentAt: ""
      });
    }
    for (const invoice of zoneInvoices) {
      if (!invoice.has_pdf) continue;
      const current = rows.get(invoice.customer_code) ?? { code: invoice.customer_code, name: "", city: "", invoiceCount: 0, paidUsd: 0, paidHtg: 0, lastInvoiceAt: "", lastPaymentAt: "" };
      current.invoiceCount += 1;
      if (String(invoice.created_at) > current.lastInvoiceAt) current.lastInvoiceAt = invoice.created_at;
      rows.set(invoice.customer_code, current);
    }
    for (const payment of data?.payments ?? []) {
      const invoice = invoiceById.get(payment.invoice_id);
      if (!invoice || !customerMatchesCity(invoice.customer_code)) continue;
      const current = rows.get(invoice.customer_code) ?? { code: invoice.customer_code, name: "", city: "", invoiceCount: 0, paidUsd: 0, paidHtg: 0, lastInvoiceAt: "", lastPaymentAt: "" };
      current.paidUsd = money(current.paidUsd + money(payment.amount_usd));
      current.paidHtg = money(current.paidHtg + money(payment.amount_htg));
      if (String(payment.created_at) > current.lastPaymentAt) current.lastPaymentAt = payment.created_at;
      rows.set(invoice.customer_code, current);
    }
    return Array.from(rows.values()).sort((left, right) => {
      const leftDate = left.lastPaymentAt || left.lastInvoiceAt;
      const rightDate = right.lastPaymentAt || right.lastInvoiceAt;
      return String(rightDate).localeCompare(String(leftDate)) || left.code.localeCompare(right.code);
    });
  }, [cityById, customerMatchesCity, data?.clients, data?.payments, invoiceById, zoneInvoices]);

  const recordBalancePayment = async () => {
    const amount = parsePaymentAmount(paymentDraft.amount);
    if (!paymentDraft.invoiceId || amount === null || amount <= 0) {
      setPaymentError("Entrez un montant valide.");
      return;
    }
    setPaymentBusy(true);
    setPaymentError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch("/api/admin-invoice-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: sessionData.session?.access_token ?? "",
          invoice_id: paymentDraft.invoiceId,
          amount,
          currency: paymentDraft.currency,
          payment_method: paymentDraft.method,
          payment_reference: paymentDraft.reference
        })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.reason || "Paiement impossible.");
      setNotice(`Paiement enregistré : ${result.payment_status}. Les espaces administration, agence et client sont synchronisés.`);
      setPaymentDraft(emptyPaymentDraft());
      await load();
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Paiement impossible.");
    } finally {
      setPaymentBusy(false);
    }
  };

  const settleReport = async () => {
    if (!settleCandidates.length || settleBusy) return;
    setSettleBusy(true);
    setSettleNotice(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch("/api/admin-settle-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token ?? ""}` },
        body: JSON.stringify({ payment_ids: settleCandidates.map((payment) => payment.id), ville_name: cityName })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.reason || "Clôture impossible.");
      setSettleConfirm(false);
      setSettleNotice({ type: "ok", text: `Rapport de ${cityName} clôturé : ${result.settled} paiement(s), ${usd(result.total_usd)} et ${htg(result.total_htg)}. Les clients avec un solde restent dans la liste.` });
      await load();
    } catch (error) {
      setSettleNotice({ type: "error", text: error instanceof Error ? error.message : "Clôture impossible." });
    } finally {
      setSettleBusy(false);
    }
  };

  const exportPayments = () => {
    const lines: Array<Array<string | number>> = [["Date", "Reçu", "Facture", "Client", "Ville", "Montant", "Devise", "USD comptabilisé", "HTG comptabilisé", "Moyen", "Référence", "Reçu par", "Source", "Clôturé le"]];
    for (const payment of payments) {
      const invoice = invoiceById.get(payment.invoice_id);
      const customer = invoice ? customerByCode.get(invoice.customer_code) : undefined;
      lines.push([String(payment.created_at).slice(0, 10), payment.id, invoice?.invoice_number ?? "", invoice?.customer_code ?? "", cityById.get(customer?.ville_id ?? "") ?? "", payment.amount, payment.currency, payment.amount_usd, payment.amount_htg, payment.payment_method, payment.payment_reference, payment.received_by_name, payment.recorded_by_role, payment.settled_at ? String(payment.settled_at).slice(0, 10) : ""]);
    }
    const blob = new Blob(["\ufeff" + lines.map((line) => line.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `STANDA-encaissements-${from || "debut"}-${to || "aujourd-hui"}.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  return <div className="space-y-5 pb-10">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="h-page flex items-center gap-2"><BarChart3 size={23} /> Rapports financiers</h1><p className="mt-1 text-sm text-mute">Encaissements, soldes et reçus confirmés dans une seule vue.</p></div><div className="flex gap-2"><button type="button" onClick={() => window.location.reload()} className="btn btn-ghost inline-flex items-center gap-2"><RefreshCw size={16} /> Actualiser</button><button type="button" disabled={!payments.length} onClick={exportPayments} className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-50"><Download size={16} /> Exporter</button></div></div>
    <section className="card grid gap-3 p-4 md:grid-cols-4"><label><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Ville</span><select className="input mt-1" value={villeId} onChange={(event) => setVilleId(event.target.value)}><option value="">Toutes les villes</option>{(data?.villes ?? []).filter((city) => city.active).map((city) => <option value={city.id} key={city.id}>{city.name}</option>)}</select></label><label><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Du</span><input className="input mt-1" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label><label><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Au</span><input className="input mt-1" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label><label className="flex items-end gap-2 pb-2.5 text-sm font-semibold text-slate-600"><input type="checkbox" className="h-4 w-4" checked={showSettled} onChange={(event) => setShowSettled(event.target.checked)} />Inclure les paiements clôturés</label></section>
    {notice && <p role="alert" className="card border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{notice}</p>}
    {settleNotice && <p role={settleNotice.type === "error" ? "alert" : "status"} className={`card border px-4 py-3 text-sm font-semibold ${settleNotice.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>{settleNotice.text}</p>}
    {loading ? <div className="card py-16"><Loader inline size={56} /></div> : <>
      {data && !data.settlement_ready && <p className="card border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Clôture du rapport indisponible : exécutez supabase/20260920_report_settlement.sql dans Supabase (SQL Editor → Run), puis actualisez.</p>}
      {data?.settlement_ready && <SettlementPanel cityName={cityName} count={settleCandidates.length} totalUsd={settleTotals.usd} totalHtg={settleTotals.htg} confirming={settleConfirm} busy={settleBusy} onAsk={() => { setSettleNotice(null); setSettleConfirm(true); }} onCancel={() => setSettleConfirm(false)} onConfirm={() => void settleReport()} />}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<Banknote size={20} />} label="Encaissements de la période" value={usd(receivedUsd)} hint={htg(receivedHtg)} tone="bg-emerald-50 text-emerald-700" /><Metric icon={<WalletCards size={20} />} label="Transactions enregistrées" value={payments.length} hint="Chaque paiement conserve son reçu" tone="bg-blue-50 text-blue-700" /><Metric icon={<Landmark size={20} />} label="Factures réglées" value={paidInvoices} hint="Dans la ville sélectionnée" tone="bg-indigo-50 text-indigo-700" /><Metric icon={<UsersRound size={20} />} label="Soldes à recevoir" value={usd(totalBalanceUsd)} hint={`${htg(totalBalanceHtg)} · ${balances.length} client(s)`} tone="bg-amber-50 text-amber-700" /></section>
      <section className="grid gap-5 xl:grid-cols-2"><FinanceBreakdown title="Par moyen de paiement" rows={byMethod.map((row) => ({ label: row.method, sublabel: `${row.count} transaction${row.count > 1 ? "s" : ""}`, usd: row.usd, htg: row.htg }))} empty="Aucun encaissement dans cette période." /><FinanceBreakdown title="Par personne qui a encaissé" rows={byCollector.map((row) => ({ label: row.name, sublabel: `${row.source} · ${row.count} transaction${row.count > 1 ? "s" : ""}`, usd: row.usd, htg: row.htg }))} empty="Aucun encaissement dans cette période." /></section>
      <section className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4"><div><h2 className="h-sec flex items-center gap-2"><FileText size={19} /> Derniers paiements et reçus</h2><p className="mt-1 text-xs text-mute">Chaque reçu s&apos;ouvre dans le rapport et peut être imprimé directement.</p></div><span className="badge bg-slate-100 text-slate-600">{payments.length}</span></div><div className="max-h-[500px] overflow-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr>{["Date", "Facture", "Client", "Montant", "Moyen", "Reçu par", "Reçu"].map((title) => <th className="th" key={title}>{title}</th>)}</tr></thead><tbody>{payments.length ? payments.map((payment, index) => { const invoice = invoiceById.get(payment.invoice_id); const customer = invoice ? customerByCode.get(invoice.customer_code) : undefined; return <tr className={index % 2 ? "bg-mist" : ""} key={payment.id}><td className="td whitespace-nowrap">{dateText(payment.created_at)}</td><td className="td font-bold text-navy">{invoice?.invoice_number ?? "—"}</td><td className="td"><b>{invoice?.customer_code ?? "—"}</b>{customer && <span className="mt-0.5 block text-xs text-slate-500">{[customer.fullname, customer.surname].filter(Boolean).join(" ") || "—"}</span>}</td><td className="td text-right font-bold">{payment.currency === "USD" ? usd(payment.amount) : htg(payment.amount)}</td><td className="td">{payment.payment_method || "Espèces"}{payment.payment_reference && <span className="mt-0.5 block text-xs text-slate-500">{payment.payment_reference}</span>}</td><td className="td">{payment.received_by_name || "—"}<span className="mt-0.5 block text-xs text-slate-500">{payment.recorded_by_role === "admin" ? "Admin direct" : "Point de retrait"}</span>{payment.settled_at && <span className="mt-1 inline-block rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800">Clôturé le {dateText(payment.settled_at)}</span>}</td><td className="td"><Link className="inline-flex items-center gap-1 text-xs font-bold text-navy underline" href={`/rapports-financiers/recu/${payment.id}`}><FileText size={14} /> Reçu</Link></td></tr>; }) : <tr><td colSpan={7} className="py-10 text-center text-slate-400">Aucun paiement dans cette période.</td></tr>}</tbody></table></div></section>
      {paymentDraft.invoiceId && <AdminBalancePaymentPanel invoice={invoiceById.get(paymentDraft.invoiceId) ?? null} draft={paymentDraft} busy={paymentBusy} error={paymentError} onChange={(patch) => { setPaymentDraft((current) => ({ ...current, ...patch })); setPaymentError(""); }} onClose={() => { setPaymentDraft(emptyPaymentDraft()); setPaymentError(""); }} onSubmit={() => void recordBalancePayment()} />}
      <section className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4"><div><h2 className="h-sec flex items-center gap-2"><CalendarDays size={19} /> Clients avec un solde à régler</h2><p className="mt-1 text-xs text-mute">Seuls les soldes d&apos;au moins 50 HTG sont retenus. Les petites différences sont réglées automatiquement.</p></div><span className="badge bg-amber-100 text-amber-800">{balances.length} client{balances.length > 1 ? "s" : ""}</span></div><div className="max-h-[430px] overflow-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr>{["Client", "Ville", "Factures", "Solde USD", "Solde HTG", "Dernière facture", "Action"].map((title) => <th className="th" key={title}>{title}</th>)}</tr></thead><tbody>{balances.length ? balances.map((row, index) => { const customer = customerByCode.get(row.customerCode); return <tr key={row.customerCode} className={index % 2 ? "bg-mist" : ""}><td className="td"><b className="text-navy">{row.customerCode}</b>{row.customerName && <span className="mt-0.5 block text-xs text-slate-500">{row.customerName}</span>}</td><td className="td">{cityById.get(customer?.ville_id ?? "") ?? "—"}</td><td className="td">{row.invoiceCount}<span className="mt-0.5 block text-[11px] text-slate-500">À partir de {row.oldestInvoiceNumber}</span></td><td className="td text-right font-bold text-amber-800">{usd(row.usd)}</td><td className="td text-right font-bold text-amber-800">{htg(row.htg)}</td><td className="td whitespace-nowrap">{dateText(row.latestAt)}</td><td className="td"><button type="button" onClick={() => { setPaymentDraft({ ...emptyPaymentDraft(), invoiceId: row.oldestInvoiceId }); setPaymentError(""); }} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-bold text-navy underline"><CircleDollarSign size={14} /> Régler</button></td></tr>; }) : <tr><td colSpan={7} className="py-10 text-center text-slate-400">Aucun solde à recevoir pour cette sélection.</td></tr>}</tbody></table></div></section>
      <section className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4"><div><h2 className="h-sec flex items-center gap-2"><History size={19} /> Historique financier des clients</h2><p className="mt-1 text-xs text-mute">Toutes les factures et tous les paiements enregistrés, par client.</p></div><span className="badge bg-slate-100 text-slate-600">{customerHistory.length} client{customerHistory.length > 1 ? "s" : ""}</span></div><div className="max-h-[430px] overflow-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr>{["Client", "Ville", "Factures", "Total payé USD", "Total payé HTG", "Dernière activité"].map((title) => <th className="th" key={title}>{title}</th>)}</tr></thead><tbody>{customerHistory.length ? customerHistory.map((row, index) => <tr key={row.code} className={index % 2 ? "bg-mist" : ""}><td className="td"><b className="text-navy">{row.code}</b>{row.name && <span className="mt-0.5 block text-xs text-slate-500">{row.name}</span>}</td><td className="td">{row.city || "—"}</td><td className="td">{row.invoiceCount}</td><td className="td text-right font-bold">{usd(row.paidUsd)}</td><td className="td text-right font-bold">{htg(row.paidHtg)}</td><td className="td whitespace-nowrap">{dateText(row.lastPaymentAt || row.lastInvoiceAt)}</td></tr>) : <tr><td colSpan={6} className="py-10 text-center text-slate-400">Aucun historique pour cette sélection.</td></tr>}</tbody></table></div></section>
    </>}
  </div>;
}

/** Bouton « Clôturer le rapport » : à utiliser quand les agents ont remis l'argent des clients. */
function SettlementPanel({ cityName, count, totalUsd, totalHtg, confirming, busy, onAsk, onCancel, onConfirm }: {
  cityName: string; count: number; totalUsd: number; totalHtg: number; confirming: boolean; busy: boolean;
  onAsk: () => void; onCancel: () => void; onConfirm: () => void;
}) {
  if (!cityName) return <p className="card px-4 py-3 text-xs text-slate-500">Choisissez une ville pour clôturer le rapport de son point de retrait.</p>;
  return <section className="card border border-emerald-200 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="h-sec flex items-center gap-2"><Scale size={19} /> Clôture du rapport · {cityName}</h2><p className="mt-1 max-w-2xl text-xs text-mute">À faire quand les agents ont remis l&apos;argent des clients. Les paiements encaissés au point de retrait quittent le rapport (agent et administration) ; ils ne sont pas supprimés et leurs reçus restent ouverts. Les clients avec un solde restent dans la liste des soldes.</p></div>
      <div className="text-right"><p className="text-xs font-semibold text-slate-500">Caisse à clôturer</p><p className="text-lg font-black text-navy">{usd(totalUsd)} · {htg(totalHtg)}</p><p className="text-xs text-slate-500">{count} paiement{count > 1 ? "s" : ""}</p></div>
    </div>
    {confirming ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-bold text-amber-900">Confirmer la clôture de {count} paiement{count > 1 ? "s" : ""} ({usd(totalUsd)} et {htg(totalHtg)}) pour {cityName} ?</p><p className="mt-1 text-xs text-amber-800">Ils disparaissent du rapport de l&apos;agent et de ce rapport. Vous pourrez les revoir avec « Inclure les paiements clôturés ».</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={onConfirm} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-60"><CheckCircle2 size={17} />{busy ? "Clôture…" : "Oui, clôturer le rapport"}</button><button type="button" disabled={busy} onClick={onCancel} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700">Annuler</button></div></div>
      : <button type="button" disabled={!count} onClick={onAsk} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Scale size={17} />Clôturer le rapport</button>}
    {!count && <p className="mt-2 text-xs text-slate-500">Aucun paiement de point de retrait en attente de clôture pour cette ville.</p>}
  </section>;
}

function Metric({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: string | number; hint: string; tone: string }) {
  return <article className="card p-4"><div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${tone}`}>{icon}</div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-0.5 text-2xl font-black text-navy">{value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p></article>;
}

function FinanceBreakdown({ title, rows, empty }: { title: string; rows: Array<{ label: string; sublabel: string; usd: number; htg: number }>; empty: string }) {
  return <section className="card overflow-hidden"><div className="border-b border-line p-4"><h2 className="h-sec">{title}</h2></div><div className="divide-y divide-line">{rows.length ? rows.map((row) => <div className="flex items-center justify-between gap-3 p-4" key={row.label}><div><p className="font-bold text-navy">{row.label}</p><p className="mt-0.5 text-xs text-slate-500">{row.sublabel}</p></div><div className="text-right"><p className="font-black text-navy">{usd(row.usd)}</p><p className="text-xs text-slate-500">{htg(row.htg)}</p></div></div>) : <p className="p-6 text-center text-sm text-slate-400">{empty}</p>}</div></section>;
}

function AdminBalancePaymentPanel({ invoice, draft, busy, error, onChange, onClose, onSubmit }: {
  invoice: InvoiceRow | null;
  draft: PaymentDraft;
  busy: boolean;
  error: string;
  onChange: (patch: Partial<PaymentDraft>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!invoice) return null;
  const payable = invoicePayableAmounts(invoice);
  const remaining = invoiceRemainingAmounts(invoice);
  return <section className="card border border-blue-200 bg-blue-50/60 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Règlement direct par l&apos;administration</p><h2 className="mt-1 text-lg font-black text-navy">{invoice.invoice_number} · {invoice.customer_code}</h2><p className="mt-1 text-xs text-slate-600">Montant de référence : la facture envoyée au client.</p><p className="mt-2 text-sm font-semibold text-slate-700">Solde courant : <b>{usd(remaining.remainingUsd)}</b> · {htg(remaining.remainingHtg)}</p><p className="mt-1 text-xs text-slate-500">Les centimes sont facultatifs. Une différence de moins de 50 HTG est automatiquement considérée comme réglée.</p></div><button type="button" onClick={onClose} aria-label="Fermer le règlement" className="rounded-lg p-1 text-slate-500 hover:bg-white"><X size={18} /></button></div><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4"><input value={draft.amount} onChange={(event) => onChange({ amount: event.target.value })} type="text" inputMode="decimal" className="input" placeholder="Montant reçu (ex. 8 146)" autoFocus /><select value={draft.currency} onChange={(event) => onChange({ currency: event.target.value as "USD" | "HTG" })} className="input"><option value="HTG">Gourdes</option><option value="USD">Dollars américains</option></select><select value={draft.method} onChange={(event) => onChange({ method: event.target.value })} className="input">{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}</select><input value={draft.reference} onChange={(event) => onChange({ reference: event.target.value.slice(0, 120) })} className="input" placeholder="Référence (facultatif)" /></div>{error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}<div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" disabled={busy} onClick={onSubmit} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-bold text-white disabled:opacity-60"><CircleDollarSign size={17} />{busy ? "Enregistrement…" : "Confirmer le paiement"}</button><span className="text-xs text-slate-500">Facture : {usd(payable.payableUsd)} · {htg(payable.payableHtg)}</span></div></section>;
}
