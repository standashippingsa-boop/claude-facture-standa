"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, ClipboardList, PackageCheck, RefreshCw, Truck } from "lucide-react";
import { getClients, getInvoices, getPackages, getVilles } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { Client, Invoice, Pkg, Ville } from "@/lib/types";
import { dateFr } from "@/lib/utils";

type PaymentRow = { invoice_id: string; amount: number; currency: string; amount_usd: number; amount_htg: number; received_by_name: string; created_at: string };
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

  useEffect(() => {
    if (!zoneInvoices.length) { setPayments([]); return; }
    let cancelled = false;
    supabase.from("invoice_payments").select("invoice_id, amount, currency, amount_usd, amount_htg, received_by_name, created_at")
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
  const paid = zoneInvoices.filter((invoice) => invoice.payment_status === "Payé");
  const partial = zoneInvoices.filter((invoice) => invoice.payment_status === "Payé partiel");
  const receivedUsd = payments.reduce((sum, payment) => sum + Number(payment.amount_usd || 0), 0);
  const receivedHtg = payments.reduce((sum, payment) => sum + Number(payment.amount_htg || 0), 0);

  return <div className="space-y-5 pb-10">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="h-page flex items-center gap-2"><Truck size={22} /> Points de retrait</h1><p className="mt-0.5 text-sm text-mute">Contrôle des paiements, colis remis et colis restants par zone.</p></div><button onClick={() => void load()} className="btn btn-ghost inline-flex items-center gap-2"><RefreshCw size={16} />Actualiser</button></div>
    <section className="card p-4"><label className="block max-w-md"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Point / ville</span><select value={villeId} onChange={(event) => setVilleId(event.target.value)} className="input mt-1"><option value="">Choisir une ville</option>{villes.filter((city) => city.active).map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label></section>
    {notice && <p className="card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{notice}</p>}
    {loading ? <div className="card p-10 text-center text-sm text-slate-500">Chargement…</div> : !villeId ? <div className="card p-10 text-center text-sm text-slate-500">Choisissez un point de retrait.</div> : <>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<Banknote size={20} />} label="Factures entièrement payées" value={paid.length} hint={`${partial.length} paiement(s) partiel(s)`} tint="bg-emerald-50 text-emerald-700" /><Metric icon={<CheckCircle2 size={20} />} label="Colis remis" value={delivered.length} hint={`${zoneCodes.size} client(s) dans ${selectedVille?.name ?? "la zone"}`} tint="bg-indigo-50 text-indigo-700" /><Metric icon={<PackageCheck size={20} />} label="Colis restant à remettre" value={remaining.length} hint="En route, disponible ou facturé" tint="bg-orange-50 text-orange-700" /><Metric icon={<ClipboardList size={20} />} label="Paiements reçus" value={usd(receivedUsd)} hint={htg(receivedHtg)} tint="bg-blue-50 text-blue-700" /></section>
      <section className="grid gap-5 xl:grid-cols-2"><div className="card overflow-hidden"><div className="border-b border-line p-4"><h2 className="h-sec">Factures {selectedVille?.name}</h2><p className="mt-1 text-xs text-mute">État de paiement confirmé par le point de retrait.</p></div><div className="max-h-[430px] overflow-auto"><table className="w-full text-sm"><thead><tr>{["Facture", "Client", "Total", "État"].map((title) => <th className="th" key={title}>{title}</th>)}</tr></thead><tbody>{zoneInvoices.length ? zoneInvoices.map((invoice, index) => <tr key={invoice.id} className={index % 2 ? "bg-mist" : ""}><td className="td font-bold text-navy">{invoice.invoice_number}<span className="mt-0.5 block text-[11px] font-normal text-slate-400">{dateFr(invoice.created_at)}</span></td><td className="td">{invoice.customer_code}</td><td className="td text-right">{usd(invoice.total_usd)}</td><td className="td"><PaymentStatus status={invoice.payment_status ?? "Non payé"} /></td></tr>) : <tr><td className="py-8 text-center text-slate-400" colSpan={4}>Aucune facture.</td></tr>}</tbody></table></div></div>
        <div className="card overflow-hidden"><div className="border-b border-line p-4"><h2 className="h-sec">Derniers paiements reçus</h2><p className="mt-1 text-xs text-mute">Chaque ligne conserve l&apos;agent, la devise et la date.</p></div><div className="max-h-[430px] overflow-auto"><table className="w-full text-sm"><thead><tr>{["Date", "Facture", "Montant", "Reçu par"].map((title) => <th className="th" key={title}>{title}</th>)}</tr></thead><tbody>{payments.length ? payments.map((payment, index) => { const invoice = zoneInvoices.find((row) => row.id === payment.invoice_id); return <tr key={`${payment.invoice_id}-${payment.created_at}-${index}`} className={index % 2 ? "bg-mist" : ""}><td className="td whitespace-nowrap">{dateFr(payment.created_at)}</td><td className="td font-semibold text-navy">{invoice?.invoice_number ?? "—"}</td><td className="td text-right">{payment.currency === "USD" ? usd(payment.amount) : htg(payment.amount)}</td><td className="td">{payment.received_by_name || "—"}</td></tr>; }) : <tr><td className="py-8 text-center text-slate-400" colSpan={4}>Aucun paiement enregistré.</td></tr>}</tbody></table></div></div></section>
      <section className="card overflow-hidden"><div className="border-b border-line p-4"><h2 className="h-sec">Colis remis et restant à remettre</h2><p className="mt-1 text-xs text-mute">Vue complète de la zone: les colis livrés sont séparés de ceux qui attendent encore.</p></div><div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0"><PackageList title="Restant à remettre" items={remaining} tone="text-orange-700" /><PackageList title="Déjà remis" items={delivered} tone="text-emerald-700" /></div></section>
    </>}
  </div>;
}

function Metric({ icon, label, value, hint, tint }: { icon: React.ReactNode; label: string; value: string | number; hint: string; tint: string }) { return <div className="card p-4"><div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${tint}`}>{icon}</div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-0.5 text-2xl font-black text-navy">{value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p></div>; }
function PaymentStatus({ status }: { status: string }) { const style = status === "Payé" ? "bg-emerald-100 text-emerald-700" : status === "Payé partiel" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"; return <span className={`badge ${style}`}>{status}</span>; }
function PackageList({ title, items, tone }: { title: string; items: Pkg[]; tone: string }) { return <div className="p-4"><div className="mb-3 flex items-center justify-between"><h3 className={`text-sm font-bold ${tone}`}>{title}</h3><span className="badge bg-slate-100 text-slate-600">{items.length}</span></div><div className="max-h-80 space-y-2 overflow-auto">{items.length ? items.map((item) => <div key={item.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm"><div className="flex justify-between gap-3"><b className="text-navy">{item.customer_code}</b><span className="text-xs font-semibold text-slate-500">{item.status}</span></div><p className="mt-0.5 break-all text-xs text-slate-500">{item.tracking_manual || item.tracking_number} · Qté {item.quantity}</p></div>) : <p className="py-6 text-center text-sm text-slate-400">Aucun colis.</p>}</div></div>; }
