"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CheckCircle2, ChevronDown, ClipboardCheck, FileDown, FileText, Home, LogOut, MoreHorizontal, PackageCheck, RefreshCw, Search, ShieldCheck, Truck, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { openSecureDocument } from "@/lib/secure-document";

type ZonePackage = {
  id: string; tracking_number: string; tracking_manual: string; customer_code: string; customer_name: string;
  customer_balance_usd: number; customer_balance_htg: number; balance_invoice_id: string; balance_invoice_number: string;
  quantity: number; content: string; created_date: string; received_at: string; delivered_at: string; status: string;
  invoice_id: string; invoice_number: string; invoice_payment_status: string; invoice_payment_details: string;
};
type ZoneInvoice = {
  id: string; invoice_number: string; customer_code: string; package_count: number; customer_name: string;
  customer_balance_usd: number; customer_balance_htg: number; amount_due_usd: number; amount_due_htg: number;
  amount_label: string; payment_status: string; payment_details: string; payment_paid_usd: number;
  payment_paid_htg: number; delivery_status: string; delivered_packages_count: number; has_pdf: boolean; created_at: string;
};
type ZoneBon = { id: string; bon_number: string; destination: string; package_count: number; created_at: string; has_pdf: boolean };
type PortalData = { agent: { name: string; username: string }; zone: { name: string }; packages: ZonePackage[]; invoices: ZoneInvoice[]; bons: ZoneBon[] };
type Tab = "home" | "dossiers" | "arrivals" | "ready" | "bons" | "history";
type ArrivalFilter = "all" | "miami" | "transit";
type PaymentMethod = "Espèces" | "MonCash" | "NatCash" | "Zelle" | "Virement bancaire";
type PaymentDraft = { invoiceId: string; amount: string; currency: "USD" | "HTG"; method: PaymentMethod; reference: string };
type ClientDossier = { customerCode: string; customerName: string; packages: ZonePackage[]; invoices: ZoneInvoice[] };
type DossierCounts = { active: ZonePackage[]; enRoute: number; available: number; latestActiveAt: number; latestActivityAt: number };
type PackageGroup = { customerCode: string; customerName: string; packages: ZonePackage[]; balanceUsd: number; balanceHtg: number; balanceInvoiceId: string; balanceInvoiceNumber: string };

const DONE = "Livré";
const READY_STATUSES = new Set(["Disponible", "Facturé"]);
const emptyPaymentDraft = (): PaymentDraft => ({ invoiceId: "", amount: "", currency: "HTG", method: "Espèces", reference: "" });
const fmtUsd = (value: number) => "$" + Number(value || 0).toFixed(2);
const fmtHtg = (value: number) => new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 2 }).format(Number(value || 0)) + " HTG";
const dateText = (value: string) => value ? new Date(value).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }) : "—";
const quantityTotal = (items: ZonePackage[]) => items.reduce((total, item) => total + (Number(item.quantity) || 1), 0);
const packageReference = (item: ZonePackage) => item.tracking_manual || item.tracking_number || "Colis sans numéro de suivi";
const isReadyForPickup = (item: ZonePackage) => READY_STATUSES.has(item.status) && Boolean(item.invoice_id);
const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

/**
 * Les compteurs d'un dossier viennent uniquement de lignes `packages` uniques
 * reçues de l'API de la zone. Une facture ou un historique ne gonfle jamais
 * les chiffres affichés ici.
 */
function dossierCounts(dossier: ClientDossier): DossierCounts {
  const active = dossier.packages.filter((item) => item.status !== DONE);
  const timestamp = (item: ZonePackage) => {
    const value = item.delivered_at || item.received_at || item.created_date;
    const parsed = value ? Date.parse(value) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const latest = (items: ZonePackage[]) => items.reduce((mostRecent, item) => Math.max(mostRecent, timestamp(item)), 0);
  const available = active.filter(isReadyForPickup).length;
  return {
    active,
    enRoute: active.length - available,
    available,
    latestActiveAt: latest(active),
    latestActivityAt: latest(dossier.packages)
  };
}

export default function PickupAgentPortal() {
  const router = useRouter();
  const [data, setData] = useState<PortalData | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [arrivalFilter, setArrivalFilter] = useState<ArrivalFilter>("all");
  const [search, setSearch] = useState("");
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [releasing, setReleasing] = useState(false);
  const [confirmedParcelIds, setConfirmedParcelIds] = useState<string[]>([]);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(emptyPaymentDraft);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) { router.replace("/point-retrait"); return; }
      const response = await fetch("/api/pickup-agent", { headers: { Authorization: "Bearer " + token } });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.reason || "Chargement impossible.");
      setData(json as PortalData);
    } catch (error) {
      if (!silent) {
        setData(null);
        setMessage({ type: "error", text: error instanceof Error ? error.message : "Chargement impossible." });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => void load(true);
    const timer = window.setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load]);

  const packages = data?.packages ?? [];
  const invoices = data?.invoices ?? [];
  const ready = useMemo(() => packages.filter(isReadyForPickup), [packages]);
  const delivered = useMemo(() => packages.filter((item) => item.status === DONE), [packages]);
  const incoming = useMemo(() => packages.filter((item) => item.status !== DONE && !isReadyForPickup(item)), [packages]);
  const receivedMiami = useMemo(() => incoming.filter((item) => item.status === "Reçu à Miami"), [incoming]);
  const inTransit = useMemo(() => incoming.filter((item) => item.status !== "Reçu à Miami"), [incoming]);
  const arrivals = useMemo(() => incoming.filter((item) => arrivalFilter === "all" || (arrivalFilter === "miami" ? item.status === "Reçu à Miami" : item.status !== "Reçu à Miami")), [incoming, arrivalFilter]);
  const dossiers = useMemo(() => groupClientDossiers(packages, invoices), [packages, invoices]);
  const needle = search.trim().toLowerCase();
  const matchingDossiers = useMemo(() => needle ? dossiers.filter((dossier) => dossierText(dossier).includes(needle)) : dossiers, [dossiers, needle]);
  const packageSource = tab === "arrivals" ? arrivals : tab === "ready" ? ready : tab === "history" ? delivered : [];
  const filteredPackages = useMemo(() => needle ? packageSource.filter((item) => packageText(item).includes(needle)) : packageSource, [packageSource, needle]);
  const groups = useMemo(() => groupPackages(filteredPackages), [filteredPackages]);
  const filteredBons = useMemo(() => needle ? (data?.bons ?? []).filter((bon) => (bon.bon_number + " " + bon.destination).toLowerCase().includes(needle)) : (data?.bons ?? []), [data?.bons, needle]);
  const deliveredInvoices = useMemo(() => invoices.filter((invoice) => invoice.delivery_status === "Livrée" && (!needle || (invoice.invoice_number + " " + invoice.customer_code + " " + invoice.customer_name).toLowerCase().includes(needle))), [invoices, needle]);

  const call = async (body: Record<string, unknown>) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) { router.replace("/point-retrait"); return null; }
    const response = await fetch("/api/pickup-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(body)
    });
    const json = await response.json();
    if (!response.ok || !json.ok) throw new Error(json.reason || "Opération impossible.");
    return json;
  };

  const openDossier = () => {
    const exact = dossiers.find((dossier) => dossier.customerCode.toLowerCase() === needle);
    const found = exact ?? matchingDossiers[0];
    if (!found) { setMessage({ type: "error", text: "Aucun dossier client ne correspond à cette recherche." }); return; }
    setTab("dossiers");
    setSearch(found.customerCode);
    setExpandedCustomer(found.customerCode);
    setSelectedInvoiceId(null);
    setMessage(null);
    window.setTimeout(() => document.getElementById("dossier-" + found.customerCode)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const togglePackageSelection = (parcel: ZonePackage) => {
    setSelectedPackageIds((current) => {
      const hasAnotherCustomer = current.some((id) => packages.find((item) => item.id === id)?.customer_code !== parcel.customer_code);
      if (hasAnotherCustomer) return [parcel.id];
      return current.includes(parcel.id) ? current.filter((id) => id !== parcel.id) : [...current, parcel.id];
    });
  };

  const selectPackagesForCustomer = (customerCode: string, parcelIds: string[]) => {
    setSelectedPackageIds((current) => {
      const selectedForCustomer = current.filter((id) => packages.find((item) => item.id === id)?.customer_code === customerCode);
      const allSelected = parcelIds.length > 0 && parcelIds.every((id) => selectedForCustomer.includes(id));
      return allSelected ? [] : parcelIds;
    });
  };

  const releaseSelectedPackages = async () => {
    if (releasing || !selectedPackageIds.length) return;
    setReleasing(true);
    setMessage(null);
    try {
      const result = await call({ action: "release_many", package_ids: selectedPackageIds });
      const confirmed = Array.isArray(result.package_ids) ? result.package_ids : selectedPackageIds;
      setConfirmedParcelIds(confirmed);
      setMessage({ type: "ok", text: confirmed.length + " colis remis et confirmés." });
      window.setTimeout(() => { setConfirmedParcelIds([]); setSelectedPackageIds([]); void load(); }, 1_200);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Remise impossible." });
    } finally {
      setReleasing(false);
    }
  };

  const recordPayment = async () => {
    const amount = Number(paymentDraft.amount);
    if (!paymentDraft.invoiceId || !Number.isFinite(amount) || amount <= 0) { setPaymentError("Entrez un montant valide."); return; }
    setPaymentBusy(true);
    setPaymentError(null);
    try {
      const result = await call({
        action: "record_payment", invoice_id: paymentDraft.invoiceId, amount,
        currency: paymentDraft.currency, payment_method: paymentDraft.method, payment_reference: paymentDraft.reference
      });
      const extra = Number(result.overpayment_amount || 0) > 0.009 ? " Arrondi accepté : " + Number(result.overpayment_amount).toFixed(2) + " " + result.currency + "." : "";
      setMessage({ type: "ok", text: "Paiement enregistré : " + result.payment_status + "." + extra });
      setPaymentDraft(emptyPaymentDraft());
      await load();
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Paiement impossible.");
    } finally {
      setPaymentBusy(false);
    }
  };

  const startPayment = (invoiceId: string) => {
    if (!invoiceId) return;
    setPaymentDraft({ ...emptyPaymentDraft(), invoiceId });
    setPaymentError(null);
    setSelectedInvoiceId(null);
    setMessage(null);
    window.setTimeout(() => document.getElementById("payment-panel")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  };

  const openDocument = async (kind: "invoice" | "bon-remise", id: string) => {
    try { await openSecureDocument(kind, id); }
    catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "PDF indisponible." }); }
  };

  const logout = async () => { await supabase.auth.signOut(); router.replace("/point-retrait"); };

  return <div className="min-h-screen bg-gradient-to-b from-sky-100 via-[#f5f7fb] to-white text-slate-900">
    <header className="bg-gradient-to-r from-[#071b43] via-[#0d3270] to-[#154b91] text-white shadow-lg">
      <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20"><PackageCheck size={24} /></div><div><p className="text-lg font-black tracking-tight">STANDA</p><p className="text-[10px] font-semibold tracking-[0.18em] text-white/70">POINT DE RETRAIT</p></div></div>
        <button type="button" onClick={logout} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-white/90 hover:bg-white/10"><LogOut size={18} /><span className="hidden sm:inline">Se déconnecter</span></button>
      </div>
    </header>

    <main className="mx-auto max-w-6xl px-4 py-5 pb-12 sm:px-6 sm:py-8">
      {loading && <div className="grid min-h-[45vh] place-items-center"><div className="text-center"><RefreshCw className="mx-auto mb-3 animate-spin text-[#0d3b7a]" size={30} /><p className="text-sm text-slate-500">Chargement des opérations…</p></div></div>}
      {!loading && !data && <section className="mx-auto max-w-xl rounded-3xl border border-red-100 bg-white p-7 text-center shadow-sm"><ShieldCheck className="mx-auto mb-3 text-red-500" size={36} /><h1 className="text-xl font-extrabold text-[#0a2b61]">Accès à vérifier</h1><p className="mt-2 text-sm text-slate-600">{message?.text || "Impossible de préparer votre espace."}</p><button type="button" className="btn mt-5" onClick={() => void load()}>Réessayer</button></section>}
      {!loading && data && <>
        <section className="mb-5 rounded-3xl border border-white/70 bg-white p-5 shadow-[0_10px_35px_rgba(17,54,110,0.08)] sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#e85e19]">Espace de remise sécurisé</p><h1 className="mt-1 text-2xl font-black tracking-tight text-[#09295e] sm:text-3xl">Bonjour, {data.agent.name}</h1><p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><Truck size={15} className="text-[#e85e19]" /> Point de retrait : <b className="text-slate-700">{data.zone.name}</b></p></div><button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-[#103a78] hover:bg-slate-50"><RefreshCw size={17} />Actualiser</button></div>
        </section>

        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
        <SideNavigation tab={tab} arrivalFilter={arrivalFilter} receivedMiami={receivedMiami.length} inTransit={inTransit.length} ready={ready.length} dossiers={dossiers.length} delivered={delivered.length} bons={data.bons.length} onHome={() => setTab("home")} onMiami={() => { setTab("arrivals"); setArrivalFilter("miami"); }} onTransit={() => { setTab("arrivals"); setArrivalFilter("transit"); }} onReady={() => setTab("ready")} onDossiers={() => setTab("dossiers")} onHistory={() => setTab("history")} onBons={() => setTab("bons")} />
        <div className="min-w-0 pb-20 lg:pb-0">
        {tab !== "home" && <section className="hidden">
          <Stat icon={<ClipboardCheck size={20} />} label="Dossiers clients" value={dossiers.length} tint="bg-emerald-50 text-emerald-700" active={tab === "dossiers"} onClick={() => setTab("dossiers")} />
          <Stat icon={<PackageCheck size={20} />} label="Reçus à Miami" value={receivedMiami.length} tint="bg-cyan-50 text-cyan-700" active={tab === "arrivals" && arrivalFilter === "miami"} onClick={() => { setTab("arrivals"); setArrivalFilter("miami"); }} />
          <Stat icon={<Truck size={20} />} label="En transit" value={inTransit.length} tint="bg-blue-50 text-[#0d3b7a]" active={tab === "arrivals" && arrivalFilter === "transit"} onClick={() => { setTab("arrivals"); setArrivalFilter("transit"); }} />
          <Stat icon={<PackageCheck size={20} />} label="Disponibles" value={ready.length} tint="bg-orange-50 text-[#e85e19]" active={tab === "ready"} onClick={() => setTab("ready")} />
          <Stat icon={<CheckCircle2 size={20} />} label="Historique" value={delivered.length} tint="bg-indigo-50 text-indigo-700" active={tab === "history"} onClick={() => setTab("history")} />
        </section>}

        <section className="rounded-3xl border border-white bg-white p-4 shadow-[0_10px_35px_rgba(17,54,110,0.07)] sm:p-5">
          {tab !== "home" && <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-extrabold text-[#0a2b61]">Opérations — {data.zone.name}</h2><p className="text-xs text-slate-500">Colis, factures, paiements et bons de remise liés à votre zone.</p></div><form onSubmit={(event) => { event.preventDefault(); openDossier(); }} className="flex min-h-11 gap-2 md:w-[27rem]"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3"><Search size={17} className="shrink-0 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Numéro de client, suivi ou facture" aria-label="Rechercher un dossier client" /></label><button type="submit" className="shrink-0 rounded-xl bg-[#0b3270] px-3 text-sm font-bold text-white hover:bg-[#0f448f]">Dossier</button></form></div>
            <p className="text-xs font-semibold text-emerald-700">Les statuts sont synchronisés automatiquement avec le système principal.</p>
            <nav className="hidden">{([
              ["dossiers", "Dossiers clients", dossiers.length],
              ["arrivals", "Colis à venir", incoming.length],
              ["ready", "Colis disponibles", ready.length],
              ["bons", "Bons de remise", data.bons.length],
              ["history", "Historique", delivered.length]
            ] as Array<[Tab, string, number]>).map(([id, label, count]) => <button key={id} type="button" onClick={() => { setTab(id); if (id === "arrivals") setArrivalFilter("all"); }} className={cn("whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition", tab === id ? "bg-[#0b3270] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>{label} <span className={cn("ml-1 rounded-full px-1.5 py-0.5 text-xs", tab === id ? "bg-white/20" : "bg-white")}>{count}</span></button>)}</nav>
          </div>}

          {message && <Notice message={message} close={() => setMessage(null)} />}
          {tab === "home" && <HomeDashboard agentName={data.agent.name} zoneName={data.zone.name} onOpenDossier={() => setTab("dossiers")} />}
          {tab === "dossiers" && <ClientDossiersView dossiers={matchingDossiers} expanded={expandedCustomer} onExpand={setExpandedCustomer} selectedPackageIds={selectedPackageIds} confirmedParcelIds={confirmedParcelIds} releasing={releasing} onToggleSelection={togglePackageSelection} onSelectCustomerPackages={selectPackagesForCustomer} onConfirmSelection={releaseSelectedPackages} onStartPayment={startPayment} onOpenInvoice={setSelectedInvoiceId} />}
          {tab === "arrivals" && <ArrivalFilters value={arrivalFilter} onChange={setArrivalFilter} allCount={incoming.length} miamiCount={receivedMiami.length} transitCount={inTransit.length} />}
          {(tab === "arrivals" || tab === "ready") && <PackagesView groups={groups} tab={tab} expanded={expandedCustomer} onExpand={setExpandedCustomer} selectedPackageIds={selectedPackageIds} confirmedParcelIds={confirmedParcelIds} releasing={releasing} onToggleSelection={togglePackageSelection} onSelectCustomerPackages={selectPackagesForCustomer} onConfirmSelection={releaseSelectedPackages} onStartPayment={startPayment} onOpenInvoice={setSelectedInvoiceId} />}
          {tab === "history" && <DeliveredPackagesView packages={filteredPackages} onOpenInvoice={setSelectedInvoiceId} />}
          {tab === "history" && <DeliveredInvoicesView invoices={deliveredInvoices} onOpenInvoice={setSelectedInvoiceId} />}
          {tab === "bons" && <BonsView bons={filteredBons} onOpenPdf={(id) => void openDocument("bon-remise", id)} />}
          {selectedInvoiceId && <InvoiceDetails invoice={invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null} packages={packages.filter((item) => item.invoice_id === selectedInvoiceId)} onClose={() => setSelectedInvoiceId(null)} />}
          {paymentDraft.invoiceId && <PaymentPanel invoice={invoices.find((invoice) => invoice.id === paymentDraft.invoiceId) ?? null} draft={paymentDraft} setDraft={setPaymentDraft} busy={paymentBusy} error={paymentError} onChange={() => setPaymentError(null)} onPay={() => void recordPayment()} onClose={() => { setPaymentDraft(emptyPaymentDraft()); setPaymentError(null); }} />}
        </section>
        </div>
        </div>
        <MobileNavigation tab={tab} arrivalFilter={arrivalFilter} moreOpen={mobileMoreOpen} onHome={() => { setTab("home"); setMobileMoreOpen(false); }} onMiami={() => { setTab("arrivals"); setArrivalFilter("miami"); setMobileMoreOpen(false); }} onTransit={() => { setTab("arrivals"); setArrivalFilter("transit"); setMobileMoreOpen(false); }} onReady={() => { setTab("ready"); setMobileMoreOpen(false); }} onToggleMore={() => setMobileMoreOpen((open) => !open)} onDossiers={() => { setTab("dossiers"); setMobileMoreOpen(false); }} onHistory={() => { setTab("history"); setMobileMoreOpen(false); }} onBons={() => { setTab("bons"); setMobileMoreOpen(false); }} />
      </>}
    </main>
  </div>;
}

function packageText(item: ZonePackage) {
  return [item.customer_code, item.customer_name, item.tracking_number, item.tracking_manual, item.content, item.status, item.invoice_number].join(" ").toLowerCase();
}

function dossierText(dossier: ClientDossier) {
  return [dossier.customerCode, dossier.customerName, ...dossier.packages.map(packageText), ...dossier.invoices.flatMap((invoice) => [invoice.invoice_number, invoice.payment_status, invoice.payment_details])].join(" ").toLowerCase();
}

function groupPackages(items: ZonePackage[]): PackageGroup[] {
  const byCustomer = new Map<string, ZonePackage[]>();
  for (const item of items) byCustomer.set(item.customer_code, [...(byCustomer.get(item.customer_code) ?? []), item]);
  return Array.from(byCustomer, ([customerCode, customerPackages]) => ({
    customerCode,
    packages: customerPackages,
    customerName: customerPackages[0]?.customer_name ?? "",
    balanceUsd: customerPackages[0]?.customer_balance_usd ?? 0,
    balanceHtg: customerPackages[0]?.customer_balance_htg ?? 0,
    balanceInvoiceId: customerPackages[0]?.balance_invoice_id ?? "",
    balanceInvoiceNumber: customerPackages[0]?.balance_invoice_number ?? ""
  })).sort((left, right) => (left.customerName + " " + left.customerCode).localeCompare(right.customerName + " " + right.customerCode, "fr-CA"));
}

function groupClientDossiers(packages: ZonePackage[], invoices: ZoneInvoice[]): ClientDossier[] {
  const byCustomer = new Map<string, ClientDossier>();
  const ensure = (customerCode: string, customerName: string) => {
    const existing = byCustomer.get(customerCode);
    if (existing) { if (!existing.customerName && customerName) existing.customerName = customerName; return existing; }
    const dossier = { customerCode, customerName, packages: [], invoices: [] };
    byCustomer.set(customerCode, dossier);
    return dossier;
  };
  for (const item of packages) ensure(item.customer_code, item.customer_name).packages.push(item);
  for (const invoice of invoices) ensure(invoice.customer_code, invoice.customer_name).invoices.push(invoice);
  return Array.from(byCustomer.values()).sort((left, right) => {
    const leftCounts = dossierCounts(left);
    const rightCounts = dossierCounts(right);
    // Priorité absolue : le nombre exact de colis encore actifs.
    // À égalité, le dossier avec l'activité la plus récente reste au-dessus.
    return rightCounts.active.length - leftCounts.active.length
      || rightCounts.latestActiveAt - leftCounts.latestActiveAt
      || rightCounts.latestActivityAt - leftCounts.latestActivityAt
      || (left.customerName + " " + left.customerCode).localeCompare(right.customerName + " " + right.customerCode, "fr-CA");
  });
}

function SideNavigation({ tab, arrivalFilter, receivedMiami, inTransit, ready, dossiers, delivered, bons, onHome, onMiami, onTransit, onReady, onDossiers, onHistory, onBons }: {
  tab: Tab; arrivalFilter: ArrivalFilter; receivedMiami: number; inTransit: number; ready: number; dossiers: number; delivered: number; bons: number;
  onHome: () => void; onMiami: () => void; onTransit: () => void; onReady: () => void; onDossiers: () => void; onHistory: () => void; onBons: () => void;
}) {
  const Item = ({ label, count, icon, active, onClick }: { label: string; count?: number; icon: ReactNode; active: boolean; onClick: () => void }) => <button type="button" onClick={onClick} className={cn("flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-bold transition", active ? "bg-[#0b3270] text-white shadow-md shadow-blue-900/15" : "text-slate-600 hover:bg-slate-100 hover:text-[#0b3270]")}><span className={cn("grid h-8 w-8 place-items-center rounded-xl", active ? "bg-white/15" : "bg-sky-50 text-[#0b4d9b]")}>{icon}</span><span className="min-w-0 flex-1">{label}</span>{typeof count === "number" && <span className={cn("rounded-full px-2 py-0.5 text-xs", active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>{count}</span>}</button>;
  return <aside className="sticky top-5 hidden h-fit rounded-3xl border border-white/80 bg-white/90 p-3 shadow-[0_14px_35px_rgba(25,74,145,0.08)] backdrop-blur lg:block">
    <p className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Navigation</p>
    <div className="space-y-1">
      <Item label="Accueil" icon={<Home size={18} />} active={tab === "home"} onClick={onHome} />
      <Item label="Reçu à Miami" count={receivedMiami} icon={<PackageCheck size={18} />} active={tab === "arrivals" && arrivalFilter === "miami"} onClick={onMiami} />
      <Item label="En transit" count={inTransit} icon={<Truck size={18} />} active={tab === "arrivals" && arrivalFilter === "transit"} onClick={onTransit} />
      <Item label="À remettre" count={ready} icon={<ClipboardCheck size={18} />} active={tab === "ready"} onClick={onReady} />
      <Item label="Dossiers clients" count={dossiers} icon={<Search size={18} />} active={tab === "dossiers"} onClick={onDossiers} />
      <Item label="Colis remis" count={delivered} icon={<CheckCircle2 size={18} />} active={tab === "history"} onClick={onHistory} />
    </div>
    <div className="mt-3 border-t border-slate-100 pt-3"><Item label="Bons de remise" count={bons} icon={<FileText size={18} />} active={tab === "bons"} onClick={onBons} /></div>
  </aside>;
}

function MobileNavigation({ tab, arrivalFilter, moreOpen, onHome, onMiami, onTransit, onReady, onToggleMore, onDossiers, onHistory, onBons }: {
  tab: Tab; arrivalFilter: ArrivalFilter; moreOpen: boolean;
  onHome: () => void; onMiami: () => void; onTransit: () => void; onReady: () => void; onToggleMore: () => void; onDossiers: () => void; onHistory: () => void; onBons: () => void;
}) {
  const NavButton = ({ label, icon, active, onClick }: { label: string; icon: ReactNode; active: boolean; onClick: () => void }) => <button type="button" onClick={onClick} className={cn("flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold transition", active ? "bg-[#0b3270] text-white shadow-md shadow-blue-900/20" : "text-slate-500 hover:bg-slate-100")}><span>{icon}</span><span>{label}</span></button>;
  return <nav className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl lg:hidden" aria-label="Navigation de l’espace de remise">
    {moreOpen && <div className="absolute bottom-[4.6rem] right-0 grid w-56 gap-1 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl"><button type="button" onClick={onDossiers} className="rounded-xl px-3 py-3 text-left text-sm font-bold text-slate-700 hover:bg-sky-50">Dossiers clients</button><button type="button" onClick={onHistory} className="rounded-xl px-3 py-3 text-left text-sm font-bold text-slate-700 hover:bg-sky-50">Colis remis</button><button type="button" onClick={onBons} className="rounded-xl px-3 py-3 text-left text-sm font-bold text-slate-700 hover:bg-sky-50">Bons de remise</button></div>}
    <div className="flex items-center gap-1 rounded-3xl border border-white bg-white/95 p-1.5 shadow-xl shadow-blue-950/15 backdrop-blur">
      <NavButton label="Accueil" icon={<Home size={19} />} active={tab === "home"} onClick={onHome} />
      <NavButton label="Miami" icon={<PackageCheck size={19} />} active={tab === "arrivals" && arrivalFilter === "miami"} onClick={onMiami} />
      <NavButton label="Transit" icon={<Truck size={19} />} active={tab === "arrivals" && arrivalFilter === "transit"} onClick={onTransit} />
      <NavButton label="À remettre" icon={<ClipboardCheck size={19} />} active={tab === "ready"} onClick={onReady} />
      <NavButton label="Plus" icon={<MoreHorizontal size={20} />} active={moreOpen || tab === "dossiers" || tab === "history" || tab === "bons"} onClick={onToggleMore} />
    </div>
  </nav>;
}

function HomeDashboard({ agentName, zoneName, onOpenDossier }: { agentName: string; zoneName: string; onOpenDossier: () => void }) {
  return <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b3270] via-[#1a5bc0] to-sky-400 p-6 text-white shadow-[0_20px_40px_rgba(20,76,160,0.23)] sm:p-8"><div className="max-w-xl"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25"><PackageCheck size={25} /></span><p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-sky-100">Point de retrait · {zoneName}</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Bonjour, {agentName}</h2><p className="mt-3 max-w-lg text-sm leading-6 text-white/85">Votre espace est prêt pour les remises. Recherchez un client, vérifiez son paiement, puis confirmez tous ses colis en une seule étape.</p><button type="button" onClick={onOpenDossier} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-[#0b3270] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><Search size={18} />Ouvrir un dossier client</button></div><div className="mt-8 grid gap-3 border-t border-white/20 pt-5 text-sm sm:grid-cols-2"><p className="rounded-2xl bg-white/10 p-3 font-semibold">Les colis livrés quittent les dossiers actifs et sont classés dans l’historique.</p><p className="rounded-2xl bg-white/10 p-3 font-semibold">Les statuts et les paiements sont synchronisés avec le système principal.</p></div></section>;
}

function BatchRemiseAction({ customerCode, available, selectedPackageIds, busy, onSelectAll, onConfirm }: { customerCode: string; available: ZonePackage[]; selectedPackageIds: string[]; busy: boolean; onSelectAll: () => void; onConfirm: () => void }) {
  const eligible = available.filter((item) => item.invoice_payment_status === "Payé" && item.customer_balance_usd <= 0.01);
  const chosen = eligible.filter((item) => selectedPackageIds.includes(item.id));
  if (!eligible.length) return <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Le paiement complet est requis avant de sélectionner les colis.</p>;
  return <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3"><p className="text-sm font-black text-emerald-900">Remise groupée · {customerCode}</p><p className="mt-1 text-xs text-emerald-800">Sélectionnez tous les colis remis au client, puis validez-les avec un seul bouton.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><button type="button" disabled={busy} onClick={onSelectAll} className="min-h-11 rounded-xl border border-emerald-200 bg-white px-3 text-sm font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60">{chosen.length === eligible.length ? "Retirer la sélection" : "Tout sélectionner"}</button><button type="button" disabled={busy || !chosen.length} onClick={onConfirm} className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">{busy ? "Confirmation…" : `Confirmer la remise (${chosen.length} colis)`}</button></div></section>;
}

function DeliveredPackagesView({ packages, onOpenInvoice }: { packages: ZonePackage[]; onOpenInvoice: (invoiceId: string) => void }) {
  if (!packages.length) return <Empty text="Aucun colis remis ne correspond à la recherche." />;
  const ordered = [...packages].sort((left, right) => String(right.delivered_at || right.created_date).localeCompare(String(left.delivered_at || left.created_date)));
  return <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-base font-black text-[#0a2b61]">Colis remis</h3><p className="mt-1 text-xs text-slate-600">Historique des colis confirmés au point de retrait.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">{packages.length}</span></div><div className="space-y-2">{ordered.map((item) => <article key={item.id} className="rounded-xl border border-emerald-100 bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Numéro de suivi</p><p className="break-all text-sm font-black text-[#0a2b61]">{packageReference(item)}</p></div><StatusChip status={DONE} /></div><div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4"><p className="rounded-lg bg-slate-50 px-2.5 py-2"><span className="block text-slate-400">Client</span><b className="text-slate-700">{item.customer_code}{item.customer_name ? " · " + item.customer_name : ""}</b></p><p className="rounded-lg bg-slate-50 px-2.5 py-2"><span className="block text-slate-400">Facture</span>{item.invoice_id ? <button type="button" onClick={() => onOpenInvoice(item.invoice_id)} className="font-bold text-indigo-700 hover:underline">{item.invoice_number || "Voir la facture"}</button> : <b className="text-slate-700">—</b>}</p><p className="rounded-lg bg-slate-50 px-2.5 py-2"><span className="block text-slate-400">Date de remise</span><b className="text-slate-700">{item.delivered_at ? dateText(item.delivered_at) : "Non archivée"}</b></p><p className="rounded-lg bg-slate-50 px-2.5 py-2"><span className="block text-slate-400">Quantité</span><b className="text-slate-700">{item.quantity} article{item.quantity > 1 ? "s" : ""}</b></p></div></article>)}</div></section>;
}

function PackagesView({ groups, tab, expanded, onExpand, selectedPackageIds, confirmedParcelIds, releasing, onToggleSelection, onSelectCustomerPackages, onConfirmSelection, onStartPayment, onOpenInvoice }: {
  groups: PackageGroup[]; tab: Tab; expanded: string | null; onExpand: (id: string | null) => void;
  selectedPackageIds: string[]; confirmedParcelIds: string[]; releasing: boolean; onToggleSelection: (item: ZonePackage) => void;
  onSelectCustomerPackages: (customerCode: string, parcelIds: string[]) => void; onConfirmSelection: () => void;
  onStartPayment: (invoiceId: string) => void; onOpenInvoice: (invoiceId: string) => void;
}) {
  const emptyText = tab === "arrivals" ? "Aucun colis à venir ne correspond à la recherche." : tab === "ready" ? "Aucun colis facturé n’est disponible à remettre." : "Aucun colis remis ne correspond à la recherche.";
  if (!groups.length) return <Empty text={emptyText} />;
  return <div className="grid gap-4 lg:grid-cols-2">{groups.map((group) => {
    const open = expanded === group.customerCode;
    const hasBalance = tab === "ready" && group.balanceUsd > 0.01;
    return <article key={group.customerCode} className={cn("overflow-hidden rounded-2xl border bg-white", hasBalance ? "border-amber-300" : "border-slate-200")}>
      <button type="button" onClick={() => onExpand(open ? null : group.customerCode)} className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50"><div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Code client</p><p className="mt-0.5 text-xl font-black tracking-tight text-[#0a2b61]">{group.customerCode} {group.customerName && <span className="ml-1 text-sm font-semibold text-slate-500">· {group.customerName}</span>}</p><p className="mt-1 text-sm font-semibold text-slate-600">{group.packages.length} colis · {quantityTotal(group.packages)} article{quantityTotal(group.packages) > 1 ? "s" : ""}</p></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#edf3ff] text-[#0c397a]"><ChevronDown size={20} className={open ? "rotate-180 transition-transform" : "transition-transform"} /></span></button>
      {open && <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 p-3">{hasBalance && <BalanceNotice balanceUsd={group.balanceUsd} balanceHtg={group.balanceHtg} invoiceNumber={group.balanceInvoiceNumber} onPay={group.balanceInvoiceId ? () => onStartPayment(group.balanceInvoiceId) : undefined} />}{group.packages.map((item) => <PackageCard key={item.id} item={item} ready={tab === "ready"} delivered={tab === "history"} selected={selectedPackageIds.includes(item.id)} confirmed={confirmedParcelIds.includes(item.id)} releasing={releasing} onToggleSelection={() => onToggleSelection(item)} onStartPayment={() => onStartPayment(item.invoice_id)} onOpenInvoice={() => { if (item.invoice_id) onOpenInvoice(item.invoice_id); }} />)}{tab === "ready" && !hasBalance && <BatchRemiseAction customerCode={group.customerCode} available={group.packages} selectedPackageIds={selectedPackageIds} busy={releasing} onSelectAll={() => onSelectCustomerPackages(group.customerCode, group.packages.filter((item) => item.invoice_payment_status === "Payé").map((item) => item.id))} onConfirm={onConfirmSelection} />}</div>}
    </article>;
  })}</div>;
}

function ClientDossiersView({ dossiers, expanded, onExpand, selectedPackageIds, confirmedParcelIds, releasing, onToggleSelection, onSelectCustomerPackages, onConfirmSelection, onStartPayment, onOpenInvoice }: {
  dossiers: ClientDossier[]; expanded: string | null; onExpand: (value: string | null) => void;
  selectedPackageIds: string[]; confirmedParcelIds: string[]; releasing: boolean; onToggleSelection: (item: ZonePackage) => void;
  onSelectCustomerPackages: (customerCode: string, parcelIds: string[]) => void; onConfirmSelection: () => void;
  onStartPayment: (invoiceId: string) => void; onOpenInvoice: (invoiceId: string) => void;
}) {
  if (!dossiers.length) return <Empty text="Aucun dossier client ne correspond à la recherche." />;
  return <div className="grid gap-4 lg:grid-cols-2">{dossiers.map((dossier) => {
    const open = expanded === dossier.customerCode;
    const counts = dossierCounts(dossier);
    const miami = counts.active.filter((item) => item.status === "Reçu à Miami");
    const available = counts.active.filter(isReadyForPickup);
    const transit = counts.active.filter((item) => item.status !== "Reçu à Miami" && !isReadyForPickup(item));
    const balanceSource = dossier.invoices[0] ?? dossier.packages[0];
    const balanceUsd = balanceSource?.customer_balance_usd ?? 0;
    const balanceHtg = balanceSource?.customer_balance_htg ?? 0;
    const balanceInvoice = dossier.invoices.find((invoice) => invoice.payment_status !== "Payé");
    return <article id={"dossier-" + dossier.customerCode} key={dossier.customerCode} className={cn("scroll-mt-6 overflow-hidden rounded-2xl border bg-white", balanceUsd > 0.01 ? "border-amber-300" : "border-slate-200")}>
      <button type="button" onClick={() => onExpand(open ? null : dossier.customerCode)} className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dossier client</p><h3 className="mt-0.5 truncate text-xl font-black text-[#0a2b61]">{dossier.customerCode}{dossier.customerName && <span className="ml-1 text-sm font-semibold text-slate-500">· {dossier.customerName}</span>}</h3><div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-lg bg-blue-50 px-2 py-1 text-blue-700">En route : {counts.enRoute}</span><span className="rounded-lg bg-orange-50 px-2 py-1 text-orange-700">Disponibles : {counts.available}</span></div></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#edf3ff] text-[#0c397a]"><ChevronDown size={20} className={open ? "rotate-180 transition-transform" : "transition-transform"} /></span></button>
      {open && <div className="space-y-4 border-t border-slate-100 bg-slate-50/70 p-3">
        {balanceUsd > 0.01 && <BalanceNotice balanceUsd={balanceUsd} balanceHtg={balanceHtg} invoiceNumber={balanceInvoice?.invoice_number ?? ""} onPay={balanceInvoice ? () => onStartPayment(balanceInvoice.id) : undefined} />}
        <DossierSection title="Colis reçus à Miami" subtitle="Colis arrivés à Miami et non encore facturés." packages={miami} />
        <DossierSection title="Colis en transit ou en traitement" subtitle="Colis sans facture client finalisée." packages={transit} />
        <DossierSection title="Colis disponibles et facturés" subtitle="Sélectionnez tous les colis que vous remettez, puis confirmez une seule fois." packages={available} tone="orange" renderPackage={(item) => <PackageCard item={item} ready delivered={false} selected={selectedPackageIds.includes(item.id)} confirmed={confirmedParcelIds.includes(item.id)} releasing={releasing} onToggleSelection={() => onToggleSelection(item)} onStartPayment={() => onStartPayment(item.invoice_id)} onOpenInvoice={() => { if (item.invoice_id) onOpenInvoice(item.invoice_id); }} />} />
        {available.length > 0 && balanceUsd <= 0.01 && <BatchRemiseAction customerCode={dossier.customerCode} available={available} selectedPackageIds={selectedPackageIds} busy={releasing} onSelectAll={() => onSelectCustomerPackages(dossier.customerCode, available.filter((item) => item.invoice_payment_status === "Payé").map((item) => item.id))} onConfirm={onConfirmSelection} />}
      </div>}
    </article>;
  })}</div>;
}

function BalanceNotice({ balanceUsd, balanceHtg, invoiceNumber, onPay }: { balanceUsd: number; balanceHtg: number; invoiceNumber: string; onPay?: () => void }) {
  return <section className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-amber-800">Solde client à régler</p><p className="mt-1 text-sm font-semibold text-slate-800">Le solde précédent doit être réglé avant toute nouvelle remise.</p><p className="mt-2 text-sm font-black text-amber-900">{fmtUsd(balanceUsd)} · {fmtHtg(balanceHtg)}{invoiceNumber ? " · " + invoiceNumber : ""}</p>{onPay && <button type="button" onClick={onPay} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-3 text-sm font-bold text-[#bd450b] hover:bg-orange-100"><Banknote size={18} />Enregistrer le paiement du solde</button>}</section>;
}

function DossierSection({ title, subtitle, packages, tone = "blue", renderPackage }: { title: string; subtitle: string; packages: ZonePackage[]; tone?: "blue" | "orange" | "emerald"; renderPackage?: (item: ZonePackage) => ReactNode }) {
  const tones = { blue: "border-blue-100 bg-blue-50/50", orange: "border-orange-100 bg-orange-50/50", emerald: "border-emerald-100 bg-emerald-50/50" };
  return <section className={cn("rounded-xl border p-3", tones[tone])}><div className="mb-2 flex items-start justify-between gap-3"><div><h4 className="text-sm font-black text-[#0a2b61]">{title}</h4><p className="mt-0.5 text-xs text-slate-500">{subtitle}</p></div><span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-600">{packages.length}</span></div>{packages.length ? <div className="space-y-2">{packages.map((item) => renderPackage ? <div key={item.id}>{renderPackage(item)}</div> : <ParcelRow key={item.id} item={item} />)}</div> : <p className="rounded-lg bg-white/80 px-3 py-2 text-sm text-slate-500">Aucun colis dans cette section.</p>}</section>;
}

function ParcelRow({ item }: { item: ZonePackage }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-2"><div className="min-w-0"><p className="break-all text-sm font-bold text-[#0a2b61]">{packageReference(item)}</p><p className="mt-0.5 text-xs text-slate-500">Quantité : {item.quantity}{item.content ? " · " + item.content : ""}</p></div><StatusChip status={item.status} /></div>;
}

function DossierInvoices({ invoices, packages, expandedInvoice, onExpandInvoice, onOpenPdf }: { invoices: ZoneInvoice[]; packages: ZonePackage[]; expandedInvoice: string | null; onExpandInvoice: (value: string | null) => void; onOpenPdf: (invoiceId: string) => void }) {
  return <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3"><div className="mb-2 flex items-start justify-between gap-3"><div><h4 className="text-sm font-black text-[#0a2b61]">Factures du client</h4><p className="mt-0.5 text-xs text-slate-500">Ouvrez un numéro de facture pour voir son montant et ses colis.</p></div><span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-600">{invoices.length}</span></div>{invoices.length ? <div className="space-y-2">{invoices.map((invoice) => {
    const open = expandedInvoice === invoice.id;
    const invoicePackages = packages.filter((item) => item.invoice_id === invoice.id);
    return <div key={invoice.id} className="overflow-hidden rounded-lg border border-indigo-100 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"><button type="button" onClick={() => onExpandInvoice(open ? null : invoice.id)} className="flex min-w-0 items-center gap-2 text-left"><ChevronDown size={16} className={cn("shrink-0 text-[#0b3270]", open && "rotate-180 transition-transform")} /><span><span className="block text-sm font-bold text-[#0a2b61]">{invoice.invoice_number}</span><span className="mt-0.5 block text-xs text-slate-500">{invoice.package_count} colis · {dateText(invoice.created_at)}</span></span></button><div className="flex flex-wrap items-center justify-end gap-2"><DeliveryChip status={invoice.delivery_status} /><PaymentChip status={invoice.payment_status} />{invoice.has_pdf && <button type="button" onClick={() => onOpenPdf(invoice.id)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-[#0b3270] hover:bg-slate-100" aria-label={"Ouvrir la facture " + invoice.invoice_number}><FileText size={16} /></button>}</div></div>{invoice.payment_details && <p className="border-t border-indigo-50 px-3 py-2 text-xs font-semibold text-emerald-700">{invoice.payment_details}</p>}{open && <InvoiceSummary invoice={invoice} packages={invoicePackages} />}</div>;
  })}</div> : <p className="rounded-lg bg-white/80 px-3 py-3 text-sm text-slate-500">Aucune facture finalisée pour ce client.</p>}</section>;
}

function PackageCard({ item, ready, delivered, selected, releasing, confirmed, onToggleSelection, onStartPayment, onOpenInvoice }: { item: ZonePackage; ready: boolean; delivered: boolean; selected: boolean; releasing: boolean; confirmed: boolean; onToggleSelection: () => void; onStartPayment: () => void; onOpenInvoice: () => void }) {
  const hasBalance = item.customer_balance_usd > 0.01;
  const canRelease = item.invoice_payment_status === "Payé" && !hasBalance;
  return <div className={cn("rounded-xl border bg-white p-3", selected ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200")}><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Numéro de suivi</p><p className="break-all text-sm font-extrabold text-[#0a2b61]">{packageReference(item)}</p></div><StatusChip status={item.status} /></div>{item.content && <p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-slate-800">Marchandise :</span> {item.content}</p>}<div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500"><span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold">Quantité : {item.quantity}</span>{item.received_at && <span className="rounded-lg bg-blue-50 px-2 py-1 text-blue-700">Reçu à Miami : {dateText(item.received_at)}</span>}{item.invoice_number && (item.invoice_id ? <button type="button" onClick={onOpenInvoice} className="rounded-lg bg-indigo-50 px-2 py-1 font-semibold text-indigo-700 transition hover:bg-indigo-100 hover:text-indigo-900" title="Voir le détail de cette facture">{item.invoice_number} · {item.invoice_payment_status}</button> : <span className="rounded-lg bg-indigo-50 px-2 py-1 font-semibold text-indigo-700">{item.invoice_number} · {item.invoice_payment_status}</span>)}</div>{item.invoice_payment_details && <p className="mt-2 text-xs font-bold text-emerald-700">{item.invoice_payment_details}</p>}{ready && !hasBalance && !canRelease && item.invoice_id && <button type="button" onClick={onStartPayment} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 text-sm font-bold text-[#bd450b] hover:bg-orange-100"><Banknote size={18} />Enregistrer un paiement</button>}{ready && hasBalance && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Le solde client doit être réglé avant la remise.</p>}{ready && !confirmed && <button type="button" disabled={!canRelease || releasing} onClick={onToggleSelection} className={cn("mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold disabled:cursor-not-allowed", selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-[#0b3270] bg-white text-[#0b3270] hover:bg-[#edf3ff]", (!canRelease || releasing) && "border-slate-200 bg-slate-100 text-slate-400")}><CheckCircle2 size={18} />{selected ? "Sélectionné pour la remise" : canRelease ? "Sélectionner pour la remise" : item.invoice_id ? "Paiement complet requis" : "Facture requise"}</button>}{confirmed && <div className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white"><CheckCircle2 size={18} />Remise confirmée</div>}{delivered && <p className="mt-3 flex items-center gap-2 text-sm font-bold text-emerald-700"><CheckCircle2 size={17} />Remis au client</p>}</div>;
}

function InvoiceSummary({ invoice, packages }: { invoice: ZoneInvoice; packages: ZonePackage[] }) {
  return <div className="border-t border-indigo-100 bg-white p-3"><div className="grid gap-2 text-sm sm:grid-cols-3"><div className="rounded-lg bg-blue-50 px-3 py-2"><p className="text-xs font-semibold text-slate-500">Montant de la facture</p><p className="mt-0.5 font-black text-[#0a2b61]">{fmtUsd(invoice.amount_due_usd)}</p></div><div className="rounded-lg bg-blue-50 px-3 py-2"><p className="text-xs font-semibold text-slate-500">Équivalent</p><p className="mt-0.5 font-black text-[#0a2b61]">{fmtHtg(invoice.amount_due_htg)}</p></div><div className="rounded-lg bg-emerald-50 px-3 py-2"><p className="text-xs font-semibold text-slate-500">Montant reçu</p><p className="mt-0.5 font-black text-emerald-700">{fmtUsd(invoice.payment_paid_usd)} · {fmtHtg(invoice.payment_paid_htg)}</p></div></div><div className="mt-3"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Colis dans cette facture · {packages.length}</p>{packages.length ? <div className="space-y-2">{packages.map((item) => <ParcelRow key={item.id} item={item} />)}</div> : <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">Aucun colis actif associé à cette facture.</p>}</div></div>;
}

function DeliveredInvoicesView({ invoices, onOpenInvoice }: { invoices: ZoneInvoice[]; onOpenInvoice: (invoiceId: string) => void }) {
  return <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-black text-[#0a2b61]">Factures livrées</h3><p className="mt-1 text-xs text-slate-600">Une facture est ajoutée ici lorsque tous ses colis ont été remis et confirmés.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">{invoices.length}</span></div>{invoices.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{invoices.map((invoice) => <button key={invoice.id} type="button" onClick={() => onOpenInvoice(invoice.id)} className="rounded-xl border border-emerald-100 bg-white p-3 text-left transition hover:border-emerald-300 hover:shadow-sm"><div className="flex items-center justify-between gap-2"><span className="font-black text-[#0a2b61]">{invoice.invoice_number}</span><DeliveryChip status={invoice.delivery_status} /></div><p className="mt-1 text-sm text-slate-600">{invoice.customer_code}{invoice.customer_name ? " · " + invoice.customer_name : ""}</p><p className="mt-2 text-xs font-semibold text-emerald-700">{invoice.delivered_packages_count}/{invoice.package_count} colis remis</p></button>)}</div> : <p className="mt-3 rounded-xl bg-white px-3 py-3 text-sm text-slate-500">Aucune facture n’est encore complètement livrée.</p>}</section>;
}

function InvoiceDetails({ invoice, packages, onClose }: { invoice: ZoneInvoice | null; packages: ZonePackage[]; onClose: () => void }) {
  if (!invoice) return null;
  return <section className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Détail de la facture</p><h3 className="mt-1 text-lg font-black text-[#0a2b61]">{invoice.invoice_number} · {invoice.customer_code}</h3><p className="mt-1 text-sm font-semibold text-slate-600">{invoice.customer_name || "Client STANDA"} · {invoice.payment_status}</p><div className="mt-1"><DeliveryChip status={invoice.delivery_status} /></div>{invoice.payment_details && <p className="mt-1 text-xs font-bold text-emerald-700">{invoice.payment_details}</p>}</div><button type="button" onClick={onClose} aria-label="Fermer le détail de la facture" className="rounded-lg p-1 text-slate-500 hover:bg-white"><X size={18} /></button></div><InvoiceSummary invoice={invoice} packages={packages} /></section>;
}

function PaymentPanel({ invoice, draft, setDraft, busy, error, onChange, onPay, onClose }: { invoice: ZoneInvoice | null; draft: PaymentDraft; setDraft: (value: PaymentDraft) => void; busy: boolean; error: string | null; onChange: () => void; onPay: () => void; onClose: () => void }) {
  if (!invoice) return null;
  const remainingUsd = Math.max(0, invoice.amount_due_usd - invoice.payment_paid_usd);
  const remainingHtg = Math.max(0, invoice.amount_due_htg - invoice.payment_paid_htg);
  return <section id="payment-panel" className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#bd450b]">Paiement avant remise</p><h3 className="mt-1 text-lg font-black text-[#0a2b61]">{invoice.invoice_number} · {invoice.customer_code}</h3><p className="mt-1 text-xs font-semibold text-slate-500">Le montant doit correspondre à la facture envoyée au client.</p><p className="mt-1 text-sm text-slate-600">Solde à payer : <b>{fmtUsd(remainingUsd)}</b> · {fmtHtg(remainingHtg)}</p></div><button type="button" onClick={onClose} aria-label="Fermer le paiement" className="rounded-lg p-1 text-slate-500 hover:bg-white"><X size={18} /></button></div><div className="mt-3"><PaymentFields draft={draft} setDraft={setDraft} onChange={onChange} /><InlinePaymentError error={error} /><button type="button" disabled={busy} onClick={onPay} className="mt-2 min-h-11 rounded-xl bg-[#e85e19] px-4 text-sm font-bold text-white hover:bg-[#ce4e0d] disabled:opacity-60">{busy ? "Enregistrement…" : "Confirmer le paiement"}</button></div></section>;
}

function PaymentFields({ draft, setDraft, onChange }: { draft: PaymentDraft; setDraft: (value: PaymentDraft) => void; onChange: () => void }) {
  return <div className="grid gap-2 sm:grid-cols-2"><input value={draft.amount} onChange={(event) => { setDraft({ ...draft, amount: event.target.value }); onChange(); }} type="number" min="0.01" step="0.01" className="input" placeholder="Montant reçu" autoFocus /><select value={draft.currency} onChange={(event) => { setDraft({ ...draft, currency: event.target.value as "USD" | "HTG" }); onChange(); }} className="input"><option value="HTG">Gourdes</option><option value="USD">Dollars américains</option></select><select value={draft.method} onChange={(event) => { setDraft({ ...draft, method: event.target.value as PaymentMethod }); onChange(); }} className="input"><option value="Espèces">Espèces</option><option value="MonCash">MonCash</option><option value="NatCash">NatCash</option><option value="Zelle">Zelle</option><option value="Virement bancaire">Virement bancaire</option></select><input value={draft.reference} onChange={(event) => { setDraft({ ...draft, reference: event.target.value.slice(0, 120) }); onChange(); }} className="input" placeholder="Référence (facultative)" /></div>;
}

function ArrivalFilters({ value, onChange, allCount, miamiCount, transitCount }: { value: ArrivalFilter; onChange: (value: ArrivalFilter) => void; allCount: number; miamiCount: number; transitCount: number }) {
  const options: Array<[ArrivalFilter, string, number]> = [["all", "Tous", allCount], ["miami", "Reçus à Miami", miamiCount], ["transit", "En transit ou en traitement", transitCount]];
  return <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-blue-100 bg-blue-50/50 p-3">{options.map(([id, label, count]) => <button key={id} type="button" onClick={() => onChange(id)} className={cn("min-h-10 rounded-xl px-3 text-sm font-bold transition", value === id ? "bg-[#0b3270] text-white" : "bg-white text-slate-600 hover:bg-slate-100")}>{label} <span className={cn("ml-1 rounded-full px-1.5 py-0.5 text-xs", value === id ? "bg-white/20" : "bg-slate-100")}>{count}</span></button>)}</div>;
}

function BonsView({ bons, onOpenPdf }: { bons: ZoneBon[]; onOpenPdf: (id: string) => void }) {
  if (!bons.length) return <Empty text="Aucun bon de remise ne correspond à cette recherche." />;
  return <div className="grid gap-3 md:grid-cols-2">{bons.map((bon) => <article key={bon.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-[#0a2b61]">{bon.bon_number}</p><p className="mt-1 text-sm text-slate-600">{bon.destination || "Destination non précisée"} · {bon.package_count} colis</p><p className="mt-1 text-xs text-slate-400">{dateText(bon.created_at)}</p></div><FileDown className="text-[#e85e19]" size={21} /></div>{bon.has_pdf ? <button type="button" onClick={() => onOpenPdf(bon.id)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0b3270] px-3 text-sm font-bold text-white"><FileDown size={16} />Ouvrir le PDF</button> : <p className="mt-3 text-xs text-amber-700">PDF non archivé : ce bon a été créé avant l’archivage sécurisé.</p>}</article>)}</div>;
}

function InlinePaymentError({ error }: { error: string | null }) {
  return error ? <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null;
}
function Stat({ icon, label, value, tint, onClick, active = false }: { icon: ReactNode; label: string; value: number; tint: string; onClick?: () => void; active?: boolean }) {
  return <button type="button" onClick={onClick} className={cn("rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md", active ? "border-[#0b3270] ring-2 ring-[#0b3270]/15" : "border-white")}><div className={cn("mb-3 grid h-10 w-10 place-items-center rounded-xl", tint)}>{icon}</div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-0.5 text-2xl font-black text-[#09295e]">{value}</p></button>;
}
function Empty({ text }: { text: string }) { return <div className="py-12 text-center"><CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={38} /><p className="font-bold text-[#0a2b61]">{text}</p></div>; }
function Notice({ message, close }: { message: { type: "ok" | "error"; text: string }; close: () => void }) { return <div className={cn("mb-4 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm", message.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700")}><span>{message.text}</span><button type="button" onClick={close} aria-label="Fermer le message"><X size={17} /></button></div>; }
function StatusChip({ status }: { status: string }) { const tone = status === DONE ? "bg-emerald-100 text-emerald-700" : READY_STATUSES.has(status) ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"; return <span className={cn("rounded-lg px-2.5 py-1 text-xs font-bold", tone)}>{status}</span>; }
function PaymentChip({ status }: { status: string }) { const tone = status === "Payé" ? "bg-emerald-100 text-emerald-700" : status === "Payé partiel" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"; return <span className={cn("rounded-lg px-2.5 py-1 text-xs font-bold", tone)}>{status}</span>; }
function DeliveryChip({ status }: { status: string }) { const delivered = status === "Livrée"; return <span className={cn("rounded-lg px-2.5 py-1 text-xs font-bold", delivered ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>{delivered ? "Livrée" : "À remettre"}</span>; }
