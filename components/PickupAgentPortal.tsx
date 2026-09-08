"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote, CheckCircle2, ChevronDown, ClipboardCheck, FileDown, FileText,
  LogOut, PackageCheck, RefreshCw, Search, ShieldCheck, Truck, X
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ZonePackage = {
  id: string; tracking_number: string; tracking_manual: string; customer_code: string;
  quantity: number; content: string; created_date: string; received_at: string;
  status: string; invoice_id: string; invoice_number: string; invoice_payment_status: string;
};
type ZoneInvoice = {
  id: string; invoice_number: string; customer_code: string; package_count: number;
  total_usd: number; total_htg: number; payment_status: string;
  payment_paid_usd: number; payment_paid_htg: number; pdf_url: string; created_at: string;
};
type ZoneBon = {
  id: string; bon_number: string; destination: string; package_count: number;
  created_at: string; has_pdf: boolean; pdf_url: string;
};
type PortalData = {
  agent: { name: string; username: string }; zone: { name: string };
  packages: ZonePackage[]; invoices: ZoneInvoice[]; bons: ZoneBon[];
};
type Tab = "arrivals" | "ready" | "invoices" | "bons" | "delivered";

const DONE = "Livré";
const READY = new Set(["Disponible", "Facturé"]);
const fmtUsd = (value: number) => `$${Number(value || 0).toFixed(2)}`;
const fmtHtg = (value: number) => `${new Intl.NumberFormat("fr-HT", { maximumFractionDigits: 2 }).format(Number(value || 0))} HTG`;
const dateText = (value: string) => value ? new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
const quantityTotal = (items: ZonePackage[]) => items.reduce((total, item) => total + (Number(item.quantity) || 1), 0);

/** Interface mobile/tablette/laptop, volontairement limitée à la zone de l'agent. */
export default function PickupAgentPortal() {
  const router = useRouter();
  const [data, setData] = useState<PortalData | null>(null);
  const [tab, setTab] = useState<Tab>("arrivals");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState({ invoiceId: "", amount: "", currency: "HTG" as "USD" | "HTG" });
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) { router.replace("/point-retrait"); return; }
      const response = await fetch("/api/pickup-agent", { headers: { Authorization: `Bearer ${token}` } });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.reason || "Chargement impossible.");
      setData(json as PortalData);
    } catch (error) {
      setData(null);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Chargement impossible." });
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const incoming = useMemo(() => (data?.packages ?? []).filter((item) => !READY.has(item.status) && item.status !== DONE), [data]);
  const receivedMiami = useMemo(() => incoming.filter((item) => item.status === "Reçu à Miami"), [incoming]);
  const inTransit = useMemo(() => incoming.filter((item) => item.status !== "Reçu à Miami"), [incoming]);
  const ready = useMemo(() => (data?.packages ?? []).filter((item) => READY.has(item.status)), [data]);
  const delivered = useMemo(() => (data?.packages ?? []).filter((item) => item.status === DONE), [data]);
  const visible = tab === "arrivals" ? incoming : tab === "ready" ? ready : tab === "delivered" ? delivered : [];
  const filteredPackages = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return !needle ? visible : visible.filter((item) => [item.customer_code, item.tracking_number, item.tracking_manual, item.content, item.status].join(" ").toLowerCase().includes(needle));
  }, [visible, search]);
  const packageGroups = useMemo(() => groupPackages(filteredPackages), [filteredPackages]);
  const filteredInvoices = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return !needle ? (data?.invoices ?? []) : (data?.invoices ?? []).filter((item) => [item.invoice_number, item.customer_code, item.payment_status].join(" ").toLowerCase().includes(needle));
  }, [data?.invoices, search]);
  const filteredBons = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return !needle ? (data?.bons ?? []) : (data?.bons ?? []).filter((item) => [item.bon_number, item.destination].join(" ").toLowerCase().includes(needle));
  }, [data?.bons, search]);

  const call = async (body: Record<string, unknown>) => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) { router.replace("/point-retrait"); return null; }
    const response = await fetch("/api/pickup-agent", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body)
    });
    const json = await response.json();
    if (!response.ok || !json.ok) throw new Error(json.reason || "Opération impossible.");
    return json;
  };

  const release = async (parcel: ZonePackage) => {
    if (!confirm(`Konfime remis koli ${parcel.tracking_manual || parcel.tracking_number} pou ${parcel.customer_code}?`)) return;
    setReleasing(parcel.id); setMessage(null);
    try {
      await call({ action: "release", package_id: parcel.id });
      setMessage({ type: "ok", text: `Koli ${parcel.tracking_manual || parcel.tracking_number} make kòm remis.` });
      await load(); setTab("ready");
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "Remise impossible." }); }
    finally { setReleasing(null); }
  };

  const recordPayment = async () => {
    const amount = Number(paymentDraft.amount);
    if (!paymentDraft.invoiceId || !Number.isFinite(amount) || amount <= 0) {
      setMessage({ type: "error", text: "Antre yon montan ki valid." }); return;
    }
    setPaymentBusy(true); setMessage(null);
    try {
      const result = await call({ action: "record_payment", invoice_id: paymentDraft.invoiceId, amount, currency: paymentDraft.currency });
      setMessage({ type: "ok", text: `Peman anrejistre: ${result.payment_status}.` });
      setPaymentDraft({ invoiceId: "", amount: "", currency: "HTG" });
      await load(); setTab("ready");
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "Paiement impossible." }); }
    finally { setPaymentBusy(false); }
  };

  const logout = async () => { await supabase.auth.signOut(); router.replace("/point-retrait"); };
  const paidInvoices = (data?.invoices ?? []).filter((invoice) => invoice.payment_status === "Payé").length;

  return <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
    <header className="bg-gradient-to-r from-[#071b43] via-[#0d3270] to-[#154b91] text-white shadow-lg">
      <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20"><PackageCheck size={24} /></div><div className="min-w-0"><p className="text-lg font-black tracking-tight">STANDA</p><p className="text-[10px] font-semibold tracking-[0.18em] text-white/70">POINT DE RETRAIT</p></div></div>
        <button onClick={logout} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-white/90 hover:bg-white/10"><LogOut size={18} /><span className="hidden sm:inline">Déconnecter</span></button>
      </div>
    </header>

    <div className="mx-auto max-w-6xl px-4 py-5 pb-12 sm:px-6 sm:py-8">
      {loading && <div className="grid min-h-[45vh] place-items-center"><div className="text-center"><RefreshCw className="mx-auto mb-3 animate-spin text-[#0d3b7a]" size={30} /><p className="text-sm text-slate-500">Chargement des opérations…</p></div></div>}
      {!loading && !data && <section className="mx-auto max-w-xl rounded-3xl border border-red-100 bg-white p-7 text-center shadow-sm"><ShieldCheck className="mx-auto mb-3 text-red-500" size={36} /><h1 className="text-xl font-extrabold text-[#0a2b61]">Accès à vérifier</h1><p className="mt-2 text-sm text-slate-600">{message?.text || "Impossible de préparer votre espace."}</p><button className="btn mt-5" onClick={() => void load()}>Réessayer</button></section>}

      {!loading && data && <>
        <section className="mb-5 rounded-3xl border border-white/70 bg-white p-5 shadow-[0_10px_35px_rgba(17,54,110,0.08)] sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#e85e19]">Espace de remise sécurisé</p><h1 className="mt-1 text-2xl font-black tracking-tight text-[#09295e] sm:text-3xl">Bonjou, {data.agent.name}</h1><p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><Truck size={15} className="text-[#e85e19]" /> Point: <b className="text-slate-700">{data.zone.name}</b></p></div><button onClick={() => void load()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-[#103a78] hover:bg-slate-50"><RefreshCw size={17} />Actualiser</button></div></section>

        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5"><Stat icon={<PackageCheck size={20} />} label="Reçu à Miami" value={receivedMiami.length} tint="bg-cyan-50 text-cyan-700" /><Stat icon={<Truck size={20} />} label="En transit" value={inTransit.length} tint="bg-blue-50 text-[#0d3b7a]" /><Stat icon={<PackageCheck size={20} />} label="À remettre" value={ready.length} tint="bg-orange-50 text-[#e85e19]" /><Stat icon={<Banknote size={20} />} label="Factures payées" value={paidInvoices} tint="bg-emerald-50 text-emerald-700" /><Stat icon={<CheckCircle2 size={20} />} label="Colis remis" value={delivered.length} tint="bg-indigo-50 text-indigo-700" /></section>

        <section className="rounded-3xl border border-white bg-white p-4 shadow-[0_10px_35px_rgba(17,54,110,0.07)] sm:p-5">
          <div className="mb-4 flex flex-col gap-3"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-extrabold text-[#0a2b61]">Opérations Gonaïves</h2><p className="text-xs text-slate-500">Koli, fakti, peman ak bon de remise ki konsène zòn sa a.</p></div><label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 md:w-80"><Search size={17} className="text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Code, tracking oswa fakti" /></label></div>
            <nav className="flex gap-2 overflow-x-auto pb-1">{([
              ["arrivals", "Koli k ap vini", incoming.length], ["ready", "Pou remèt", ready.length], ["invoices", "Fakti", data.invoices.length], ["bons", "Bon de remise", data.bons.length], ["delivered", "Remis", delivered.length]
            ] as Array<[Tab, string, number]>).map(([id, label, count]) => <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition ${tab === id ? "bg-[#0b3270] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label} <span className={`ml-1 rounded-full px-1.5 py-0.5 text-xs ${tab === id ? "bg-white/20" : "bg-white"}`}>{count}</span></button>)}</nav></div>

          {message && <Notice message={message} close={() => setMessage(null)} />}
          {(tab === "arrivals" || tab === "ready" || tab === "delivered") && <PackagesView groups={packageGroups} tab={tab} expanded={expanded} onExpand={setExpanded} releasing={releasing} onRelease={release} />}
          {tab === "invoices" && <InvoicesView invoices={filteredInvoices} draft={paymentDraft} setDraft={setPaymentDraft} busy={paymentBusy} onPay={() => void recordPayment()} />}
          {tab === "bons" && <BonsView bons={filteredBons} />}
        </section>
      </>}
    </div>
  </div>;
}

function groupPackages(items: ZonePackage[]) {
  const map = new Map<string, ZonePackage[]>();
  for (const item of items) map.set(item.customer_code, [...(map.get(item.customer_code) ?? []), item]);
  return Array.from(map, ([customerCode, packages]) => ({ customerCode, packages }));
}

function PackagesView({ groups, tab, expanded, onExpand, releasing, onRelease }: { groups: ReturnType<typeof groupPackages>; tab: Tab; expanded: string | null; onExpand: (id: string | null) => void; releasing: string | null; onRelease: (item: ZonePackage) => void }) {
  if (!groups.length) return <Empty text={tab === "arrivals" ? "Pa gen koli k ap vini pou zòn sa a." : tab === "ready" ? "Pa gen koli pou remèt kounye a." : "Pa gen koli remis ki koresponn ak rechèch la."} />;
  return <div className="grid gap-4 lg:grid-cols-2">{groups.map((group) => {
    const open = expanded === group.customerCode;
    return <article key={group.customerCode} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><button className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50" onClick={() => onExpand(open ? null : group.customerCode)}><div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Code client</p><p className="mt-0.5 text-xl font-black tracking-tight text-[#0a2b61]">{group.customerCode}</p><p className="mt-1 text-sm font-semibold text-slate-600">{group.packages.length} colis · {quantityTotal(group.packages)} article{quantityTotal(group.packages) > 1 ? "s" : ""}</p></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#edf3ff] text-[#0c397a]"><ChevronDown size={20} className={open ? "rotate-180 transition-transform" : "transition-transform"} /></span></button>{open && <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 p-3">{group.packages.map((item) => <PackageCard key={item.id} item={item} ready={tab === "ready"} delivered={tab === "delivered"} releasing={releasing === item.id} onRelease={() => onRelease(item)} />)}</div>}</article>;
  })}</div>;
}

function PackageCard({ item, ready, delivered, releasing, onRelease }: { item: ZonePackage; ready: boolean; delivered: boolean; releasing: boolean; onRelease: () => void }) {
  const ref = item.tracking_manual || item.tracking_number;
  const canRelease = item.invoice_payment_status === "Payé";
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Tracking</p><p className="break-all text-sm font-extrabold text-[#0a2b61]">{ref}</p></div><StatusChip status={item.status} /></div>{item.content && <p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-slate-800">Marchandise:</span> {item.content}</p>}<div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500"><span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold">Qté: {item.quantity}</span>{item.received_at && <span className="rounded-lg bg-blue-50 px-2 py-1 text-blue-700">Reçu Miami: {dateText(item.received_at)}</span>}{item.invoice_number && <span className="rounded-lg bg-indigo-50 px-2 py-1 font-semibold text-indigo-700">{item.invoice_number} · {item.invoice_payment_status}</span>}</div>{ready && <button disabled={!canRelease || releasing} onClick={onRelease} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0b3270] px-3 text-sm font-bold text-white hover:bg-[#0f448f] disabled:cursor-not-allowed disabled:bg-slate-300"><CheckCircle2 size={18} />{releasing ? "Confirmation…" : canRelease ? "Confirmer la remise" : "Paiement complet requis"}</button>}{delivered && <p className="mt-3 flex items-center gap-2 text-sm font-bold text-emerald-700"><CheckCircle2 size={17} />Remis au client</p>}</div>;
}

function InvoicesView({ invoices, draft, setDraft, busy, onPay }: { invoices: ZoneInvoice[]; draft: { invoiceId: string; amount: string; currency: "USD" | "HTG" }; setDraft: (value: { invoiceId: string; amount: string; currency: "USD" | "HTG" }) => void; busy: boolean; onPay: () => void }) {
  if (!invoices.length) return <Empty text="Pa gen fakti ki koresponn ak rechèch la." />;
  return <div className="grid gap-4 lg:grid-cols-2">{invoices.map((invoice) => { const open = draft.invoiceId === invoice.id; const remainingUsd = Math.max(0, invoice.total_usd - invoice.payment_paid_usd); return <article key={invoice.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-black text-[#0a2b61]">{invoice.invoice_number}</p><p className="text-sm font-semibold text-slate-600">{invoice.customer_code} · {invoice.package_count} colis</p><p className="mt-1 text-xs text-slate-400">Créée le {dateText(invoice.created_at)}</p></div><PaymentChip status={invoice.payment_status} /></div><div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-sm"><span>Total</span><b className="text-right text-[#0a2b61]">{fmtUsd(invoice.total_usd)}</b><span>Équivalent</span><b className="text-right text-[#0a2b61]">{fmtHtg(invoice.total_htg)}</b><span>Reçu</span><b className="text-right text-emerald-700">{fmtUsd(invoice.payment_paid_usd)} · {fmtHtg(invoice.payment_paid_htg)}</b></div><div className="mt-3 flex flex-wrap gap-2">{invoice.pdf_url && <a href={invoice.pdf_url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-[#0b3270] hover:bg-slate-50"><FileText size={16} />Voir le PDF</a>}{invoice.payment_status !== "Payé" && <button onClick={() => setDraft(open ? { invoiceId: "", amount: "", currency: "HTG" } : { invoiceId: invoice.id, amount: "", currency: "HTG" })} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#e85e19] px-3 text-sm font-bold text-white hover:bg-[#ce4e0d]"><Banknote size={16} />Enregistrer paiement</button>}</div>{open && <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50 p-3"><p className="mb-2 text-sm font-bold text-[#9f390b]">Reste à payer: {fmtUsd(remainingUsd)}</p><div className="grid grid-cols-[1fr_90px] gap-2"><input value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} type="number" min="0.01" step="0.01" className="input" placeholder="Montant reçu" autoFocus /><select value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value as "USD" | "HTG" })} className="input"><option value="HTG">Gourdes</option><option value="USD">Dollars</option></select></div><button disabled={busy} onClick={onPay} className="mt-2 min-h-11 w-full rounded-xl bg-[#0b3270] text-sm font-bold text-white disabled:opacity-60">{busy ? "Enregistrement…" : "Confirmer le paiement"}</button></div>}</article>; })}</div>;
}

function BonsView({ bons }: { bons: ZoneBon[] }) {
  if (!bons.length) return <Empty text="Pa gen Bon de remise ki koresponn ak zòn oswa rechèch sa a." />;
  return <div className="grid gap-3 md:grid-cols-2">{bons.map((bon) => <article key={bon.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-[#0a2b61]">{bon.bon_number}</p><p className="mt-1 text-sm text-slate-600">{bon.destination || "Destination non précisée"} · {bon.package_count} colis</p><p className="mt-1 text-xs text-slate-400">{dateText(bon.created_at)}</p></div><FileDown className="text-[#e85e19]" size={21} /></div>{bon.has_pdf ? <a href={bon.pdf_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0b3270] px-3 text-sm font-bold text-white"><FileDown size={16} />Ouvrir le PDF</a> : <p className="mt-3 text-xs text-amber-700">PDF non archivé: ce Bon a été créé avant l&apos;archivage sécurisé.</p>}</article>)}</div>;
}

function Stat({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: number; tint: string }) { return <div className="rounded-2xl border border-white bg-white p-4 shadow-sm"><div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${tint}`}>{icon}</div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-0.5 text-2xl font-black text-[#09295e]">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="py-12 text-center"><CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={38} /><p className="font-bold text-[#0a2b61]">{text}</p></div>; }
function Notice({ message, close }: { message: { type: "ok" | "error"; text: string }; close: () => void }) { return <div className={`mb-4 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${message.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}><span>{message.text}</span><button onClick={close} aria-label="Fermer"><X size={17} /></button></div>; }
function StatusChip({ status }: { status: string }) { const tone = status === DONE ? "bg-emerald-100 text-emerald-700" : READY.has(status) ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"; return <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${tone}`}>{status}</span>; }
function PaymentChip({ status }: { status: string }) { const tone = status === "Payé" ? "bg-emerald-100 text-emerald-700" : status === "Payé partiel" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"; return <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${tone}`}>{status}</span>; }
