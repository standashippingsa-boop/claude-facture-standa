"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Banknote, Bell, BellRing, Check, CheckCircle2, ChevronDown, ClipboardCheck, FileDown, FileText, Home, LogOut, MoreHorizontal, PackageCheck, RefreshCw, Search, Settings, ShieldCheck, Truck, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getPushPermissionState, isPushSupported, subscribeStaffToPush } from "@/lib/push";
import { openSecureDocument } from "@/lib/secure-document";
import { packageProgressPriority, sortPackagesAvailableFirst } from "@/lib/utils";
import { parsePaymentAmount } from "@/lib/invoice-payable";
import Logo from "@/components/Logo";
import StaffNotifications from "@/components/StaffNotifications";

type ZonePackage = {
  id: string; tracking_number: string; tracking_manual: string; customer_code: string; customer_name: string;
  customer_balance_usd: number; customer_balance_htg: number; balance_invoice_id: string; balance_invoice_number: string;
  quantity: number; content: string; created_date: string; received_at: string; delivered_at: string; status: string;
  invoice_id: string; invoice_number: string; invoice_payment_status: string; invoice_payment_details: string;
  is_central_account: boolean;
  is_special: boolean; special_reason: string;
};
type InvoicePaymentLine = { method: string; amount: number; currency: string; created_at: string; by: string };
type ZoneInvoice = {
  id: string; invoice_number: string; customer_code: string; package_count: number; customer_name: string;
  customer_balance_usd: number; customer_balance_htg: number; grand_total_usd: number; deposit_usd: number; amount_due_usd: number; amount_due_htg: number;
  amount_label: string; payment_status: string; payment_details: string; payment_paid_usd: number;
  payment_paid_htg: number; exchange_rate: number; payments: InvoicePaymentLine[];
  delivery_status: string; delivered_packages_count: number; has_pdf: boolean; created_at: string; is_central_account: boolean;
};
type ZoneBon = {
  id: string; bon_number: string; destination: string; package_count: number; created_at: string;
  has_pdf: boolean; received_at: string; received_by: string;
};
type AgentPayment = { id: string; invoice_id: string; invoice_number: string; customer_code: string; customer_name: string; amount: number; currency: string; amount_usd: number; amount_htg: number; payment_method: string; payment_reference: string; created_at: string };
type CustomerBalanceReport = { customer_code: string; customer_name: string; balance_usd: number; balance_htg: number; invoice_id: string; invoice_number: string; invoice_count: number };
type PortalData = { agent: { id: string; name: string; username: string }; zone: { name: string }; packages: ZonePackage[]; invoices: ZoneInvoice[]; bons: ZoneBon[]; report: { agent_payments: AgentPayment[]; customer_balances: CustomerBalanceReport[] } };
type Tab = "home" | "dossiers" | "arrivals" | "ready" | "bons" | "history" | "reports" | "settings";
/** « À venir » : deux étapes seulement — arrivés en Haïti, ou encore en cours (Miami / transit). */
type ArrivalSection = "haiti" | "miami";
// Zelle est encaissé uniquement par l'administration (rapports financiers).
type PaymentMethod = "Espèces" | "MonCash" | "NatCash" | "Virement bancaire";
type PaymentDraft = { invoiceId: string; amount: string; currency: "USD" | "HTG"; method: PaymentMethod; reference: string };
type PushPermission = NotificationPermission | "unsupported" | "checking";
type ClientDossier = { customerCode: string; customerName: string; packages: ZonePackage[]; invoices: ZoneInvoice[] };
type DossierCounts = { active: ZonePackage[]; enRoute: number; available: number; latestActiveAt: number; latestActivityAt: number };
type PackageGroup = { customerCode: string; customerName: string; packages: ZonePackage[]; balanceUsd: number; balanceHtg: number; balanceInvoiceId: string; balanceInvoiceNumber: string; latestActivityAt: number; isCentralAccount: boolean };

const DONE = "Livré";
const READY_STATUSES = new Set(["Disponible", "Facturé"]);
const emptyPaymentDraft = (): PaymentDraft => ({ invoiceId: "", amount: "", currency: "HTG", method: "Espèces", reference: "" });
const fmtUsd = (value: number) => "$" + Number(value || 0).toFixed(2);
const fmtHtg = (value: number) => new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 2 }).format(Number(value || 0)) + " HTG";
const dateText = (value: string) => value ? new Date(value).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }) : "—";
const quantityTotal = (items: ZonePackage[]) => items.reduce((total, item) => total + (Number(item.quantity) || 1), 0);
const packageReference = (item: ZonePackage) => item.tracking_manual || item.tracking_number || "Colis sans numéro de suivi";
const isReadyForPickup = (item: ZonePackage) => READY_STATUSES.has(item.status) && Boolean(item.invoice_id);
/** Un colis se remet seulement quand sa facture est payée et que le client n'a aucun solde ouvert. */
const canReleaseParcel = (item: ZonePackage) => isReadyForPickup(item) && item.invoice_payment_status === "Payé" && item.customer_balance_usd <= 0.01;
const HAITI_STATUSES = new Set(["Arrivé en Haïti", "En route vers agence"]);
// Un colis « Disponible » sans facture est déjà en Haïti : il attend seulement sa facture.
const arrivalSectionOf = (item: ZonePackage): ArrivalSection => HAITI_STATUSES.has(item.status) || READY_STATUSES.has(item.status) ? "haiti" : "miami";
const dateTimeText = (value: string) => value ? new Date(value).toLocaleString("fr-CA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const invoiceRate = (invoice: ZoneInvoice) => invoice.exchange_rate > 0 ? invoice.exchange_rate : invoice.amount_due_htg / Math.max(invoice.amount_due_usd, 1);
const round2 = (value: number) => Math.round(value * 100) / 100;
const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");
const dateTimestamp = (value: string) => {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};
const packageActivityAt = (item: ZonePackage) => dateTimestamp(item.delivered_at || item.received_at || item.created_date);

/**
 * Les compteurs d'un dossier viennent uniquement de lignes `packages` uniques
 * reçues de l'API de la zone. Une facture ou un historique ne gonfle jamais
 * les chiffres affichés ici.
 */
function dossierCounts(dossier: ClientDossier): DossierCounts {
  const active = dossier.packages.filter((item) => item.status !== DONE);
  const latest = (items: ZonePackage[]) => items.reduce((mostRecent, item) => Math.max(mostRecent, packageActivityAt(item)), 0);
  const available = active.filter(isReadyForPickup).length;
  return {
    active,
    enRoute: active.length - available,
    available,
    latestActiveAt: latest(active),
    latestActivityAt: Math.max(latest(dossier.packages), ...dossier.invoices.map((invoice) => dateTimestamp(invoice.created_at)))
  };
}

export default function PickupAgentPortal() {
  const router = useRouter();
  const [data, setData] = useState<PortalData | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [arrivalSection, setArrivalSection] = useState<ArrivalSection | null>(null);
  const [search, setSearch] = useState("");
  const [focusedPackageId, setFocusedPackageId] = useState<string | null>(null);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [releasing, setReleasing] = useState(false);
  const [confirmedParcelIds, setConfirmedParcelIds] = useState<string[]>([]);
  const [selectedBonId, setSelectedBonId] = useState<string | null>(null);
  const [bonBusy, setBonBusy] = useState(false);
  const [bonConfirmedId, setBonConfirmedId] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(emptyPaymentDraft);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPushBanner, setShowPushBanner] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushPermission, setPushPermission] = useState<PushPermission>("checking");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) { router.replace("/point-retrait"); return; }
      const response = await fetch("/api/pickup-agent", { cache: "no-store", headers: { Authorization: "Bearer " + token } });
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
    const timer = window.setInterval(refresh, 5_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load]);

  /** Bannière d'accueil + état affiché dans Paramètres. */
  useEffect(() => {
    if (!data?.agent.id) return;
    let active = true;
    let dismissed = false;
    try { dismissed = window.localStorage.getItem("standa-agence:push-dismissed") === "1"; } catch { /* ignore */ }
    if (!isPushSupported()) { setPushPermission("unsupported"); return; }
    getPushPermissionState().then((state) => {
      if (!active) return;
      setPushPermission(state);
      if (!dismissed) setShowPushBanner(state === "default");
    }).catch(() => { if (active) setPushPermission("unsupported"); });
    return () => { active = false; };
  }, [data?.agent.id]);

  const dismissPushBanner = () => {
    setShowPushBanner(false);
    try { window.localStorage.setItem("standa-agence:push-dismissed", "1"); } catch { /* ignore */ }
  };

  const activatePush = async () => {
    if (!data?.agent.id || pushBusy) return;
    setPushBusy(true);
    try {
      const r = await subscribeStaffToPush(data.agent.id);
      if (r.ok) { setPushPermission("granted"); setMessage({ type: "ok", text: "Notifications activées sur cet appareil." }); dismissPushBanner(); }
      else if (r.reason === "denied") { setPushPermission("denied"); setMessage({ type: "error", text: "Notifications refusées — activez-les depuis les réglages de l'application si vous changez d'avis." }); dismissPushBanner(); }
      else setMessage({ type: "error", text: "Impossible d'activer les notifications pour le moment." });
    } finally { setPushBusy(false); }
  };
  const packages = data?.packages ?? [];
  const invoices = data?.invoices ?? [];
  const report = data?.report ?? { agent_payments: [] as AgentPayment[], customer_balances: [] as CustomerBalanceReport[] };
  const ready = useMemo(() => packages.filter(isReadyForPickup), [packages]);
  const delivered = useMemo(() => packages.filter((item) => item.status === DONE), [packages]);
  const incoming = useMemo(() => packages.filter((item) => item.status !== DONE && !isReadyForPickup(item)), [packages]);
  // Kont santral la sèvi pou operasyon STANDA, li pa yon kliyan nan zòn nan.
  // Koli li yo rete vizib nan lis operasyon yo, men yo pa antre nan Dossiers clients.
  // Yon kliyan ki pa gen okenn koli an wout ni disponib pa parèt: koli l ki
  // remèt yo deja nan Historique.
  const dossiers = useMemo(() => groupClientDossiers(
    packages.filter((item) => !item.is_central_account),
    invoices.filter((invoice) => !invoice.is_central_account)
  ).filter((dossier) => dossierCounts(dossier).active.length > 0), [packages, invoices]);
  const needle = search.trim().toLowerCase();
  const matchingDossiers = useMemo(() => needle ? dossiers.filter((dossier) => dossierText(dossier).includes(needle)) : dossiers, [dossiers, needle]);
  const packageSource = tab === "arrivals" ? incoming : tab === "ready" ? ready : tab === "history" ? delivered : [];
  const filteredPackages = useMemo(() => needle ? packageSource.filter((item) => packageText(item).includes(needle)) : packageSource, [packageSource, needle]);
  const groups = useMemo(() => groupPackages(filteredPackages), [filteredPackages]);
  const filteredBons = useMemo(() => needle ? (data?.bons ?? []).filter((bon) => (bon.bon_number + " " + bon.destination).toLowerCase().includes(needle)) : (data?.bons ?? []), [data?.bons, needle]);
  const deliveredInvoices = useMemo(() => invoices.filter((invoice) => invoice.delivery_status === "Livrée" && (!needle || (invoice.invoice_number + " " + invoice.customer_code + " " + invoice.customer_name).toLowerCase().includes(needle))), [invoices, needle]);
  const reportPayments = useMemo(() => needle ? report.agent_payments.filter((payment) => [payment.invoice_number, payment.customer_code, payment.customer_name, payment.payment_method, payment.payment_reference].join(" ").toLowerCase().includes(needle)) : report.agent_payments, [report.agent_payments, needle]);
  const reportBalances = useMemo(() => needle ? report.customer_balances.filter((balance) => [balance.customer_code, balance.customer_name, balance.invoice_number].join(" ").toLowerCase().includes(needle)) : report.customer_balances, [report.customer_balances, needle]);

  // Le rafraîchissement automatique peut rendre un colis choisi non remettable
  // (paiement annulé, colis déjà livré ailleurs) : on le retire de la sélection.
  useEffect(() => {
    const latest = data?.packages;
    if (!latest) return;
    setSelectedPackageIds((current) => {
      const valid = current.filter((id) => { const item = latest.find((parcel) => parcel.id === id); return item && canReleaseParcel(item); });
      return valid.length === current.length ? current : valid;
    });
  }, [data?.packages]);

  // Le client du colis choisi : la sélection ne porte jamais sur deux clients à la fois.
  const selectedCustomerCode = useMemo(() => packages.find((item) => item.id === (confirmedParcelIds[0] ?? selectedPackageIds[0]))?.customer_code ?? "", [packages, selectedPackageIds, confirmedParcelIds]);

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

  const openCentralOperation = (parcel: ZonePackage, query = parcel.customer_code) => {
    setTab(parcel.status === DONE ? "history" : isReadyForPickup(parcel) ? "ready" : "arrivals");
    setSearch(query);
    setFocusedPackageId(null);
    setExpandedCustomer(parcel.customer_code);
    setArrivalSection(arrivalSectionOf(parcel));
    setSelectedInvoiceId(null);
    setMessage(null);
    window.setTimeout(() => document.getElementById("package-group-" + parcel.customer_code)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  /** « À venir » : un seul client ouvert à la fois, et une seule étape ouverte chez ce client. */
  const toggleArrivalCustomer = (customerCode: string) => {
    setExpandedCustomer((current) => current === customerCode ? null : customerCode);
    setArrivalSection(null);
  };

  const openDossier = () => {
    const lastSixDigits = needle.replace(/\D/g, "");
    if (lastSixDigits.length === 6 && needle === lastSixDigits) {
      const matches = packages.filter((item) => [item.tracking_number, item.tracking_manual]
        .some((tracking) => String(tracking || "").replace(/\s+/g, "").endsWith(lastSixDigits)));
      if (matches.length > 1) {
        setMessage({ type: "error", text: "Plus d’un colis possède ces 6 derniers chiffres. Entrez le numéro de suivi complet pour éviter toute erreur." });
        return;
      }
      if (matches.length === 1) {
        const parcel = matches[0];
        if (parcel.is_central_account) { openCentralOperation(parcel, needle); return; }
        if (parcel.status === DONE) {
          setTab("history");
          setMessage({ type: "ok", text: "Ce colis a déjà été remis : il se trouve dans l’historique." });
          return;
        }
        const found = dossiers.find((dossier) => dossier.customerCode === parcel.customer_code);
        if (!found) { setMessage({ type: "error", text: "Le colis a été trouvé, mais son dossier client est indisponible." }); return; }
        setTab("dossiers");
        setSearch(found.customerCode);
        setFocusedPackageId(parcel.id);
        setExpandedCustomer(found.customerCode);
        setSelectedInvoiceId(null);
        setMessage(null);
        window.setTimeout(() => document.getElementById("dossier-" + found.customerCode)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
        return;
      }
      setMessage({ type: "error", text: "Aucun colis ne correspond à ces 6 derniers chiffres. Vérifiez le numéro ou utilisez le code client." });
      return;
    }
    const centralMatch = packages.find((item) => item.is_central_account && item.customer_code.toLowerCase() === needle);
    if (centralMatch) { openCentralOperation(centralMatch); return; }
    const exact = dossiers.find((dossier) => dossier.customerCode.toLowerCase() === needle);
    const found = exact ?? matchingDossiers[0];
    if (!found) {
      const knownCustomer = packages.some((item) => !item.is_central_account && item.customer_code.toLowerCase() === needle);
      setMessage({ type: "error", text: knownCustomer
        ? "Ce client n’a aucun colis en route ni disponible. Ses colis remis sont dans l’historique."
        : "Aucun dossier client ne correspond à cette recherche." });
      return;
    }
    setTab("dossiers");
    setSearch(found.customerCode);
    setFocusedPackageId(null);
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
      setMessage({ type: "ok", text: confirmed.length + " colis marqués « Livré » et ajoutés à l’historique." });
      window.setTimeout(() => { setConfirmedParcelIds([]); setSelectedPackageIds([]); void load(); }, 1_800);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Remise impossible." });
    } finally {
      setReleasing(false);
    }
  };

  const confirmBonRemise = async (bonId: string) => {
    if (bonBusy) return;
    setBonBusy(true);
    setMessage(null);
    try {
      const result = await call({ action: "confirm_bon_remise", bon_remise_id: bonId });
      setBonConfirmedId(bonId);
      const text = result.alreadyConfirmed
        ? "Ce bon a déjà été confirmé."
        : `${result.updated} colis rendus disponibles${result.alreadyReady ? ` (${result.alreadyReady} l'étaient déjà)` : ""}.`;
      setMessage({ type: "ok", text });
      window.setTimeout(() => { setBonConfirmedId(null); setSelectedBonId(null); void load(); }, 1_400);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Confirmation impossible." });
    } finally {
      setBonBusy(false);
    }
  };

  const recordPayment = async () => {
    const amount = parsePaymentAmount(paymentDraft.amount);
    if (!paymentDraft.invoiceId || amount === null || amount <= 0) { setPaymentError("Entrez un montant valide."); return; }
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
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:min-h-20 sm:gap-3 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3"><span className="sm:hidden"><Logo size={38} rounded="rounded-lg" tone="light" /></span><span className="hidden sm:inline"><Logo size={44} rounded="rounded-xl" tone="light" /></span><div><p className="text-base font-black tracking-tight sm:text-lg">STANDA</p><p className="text-[9px] font-semibold tracking-[0.16em] text-white/70 sm:text-[10px] sm:tracking-[0.18em]">POINT DE RETRAIT</p></div></div>
        <div className="flex items-center gap-1 sm:gap-2"><StaffNotifications variant="icon" /><button type="button" onClick={logout} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-white/90 hover:bg-white/10 sm:min-h-11 sm:px-3"><LogOut size={17} /><span className="hidden sm:inline">Se déconnecter</span></button></div>
      </div>
    </header>

    <main className="mx-auto max-w-6xl px-3 py-3 pb-20 sm:px-6 sm:py-8 sm:pb-12">
      {loading && <div className="grid min-h-[45vh] place-items-center"><div className="text-center"><RefreshCw className="mx-auto mb-3 animate-spin text-[#0d3b7a]" size={30} /><p className="text-sm text-slate-500">Chargement des opérations…</p></div></div>}
      {!loading && !data && <section className="mx-auto max-w-xl rounded-3xl border border-red-100 bg-white p-7 text-center shadow-sm"><ShieldCheck className="mx-auto mb-3 text-red-500" size={36} /><h1 className="text-xl font-extrabold text-[#0a2b61]">Accès à vérifier</h1><p className="mt-2 text-sm text-slate-600">{message?.text || "Impossible de préparer votre espace."}</p><button type="button" className="btn mt-5" onClick={() => void load()}>Réessayer</button></section>}
      {!loading && data && <>
        <div className="md:grid md:grid-cols-[190px_minmax(0,1fr)] md:gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
        <SideNavigation tab={tab} incoming={incoming.length} ready={ready.length} dossiers={dossiers.length} delivered={delivered.length} bons={data.bons.length} balanceCount={report.customer_balances.length} onHome={() => setTab("home")} onArrivals={() => { setTab("arrivals"); setArrivalSection(null); }} onReady={() => setTab("ready")} onDossiers={() => setTab("dossiers")} onHistory={() => setTab("history")} onBons={() => setTab("bons")} onReports={() => setTab("reports")} onSettings={() => setTab("settings")} />
        <div className={cn("min-w-0", selectedPackageIds.length ? "pb-44 md:pb-28" : "pb-20 md:pb-0")}>
        {tab !== "home" && <section className="hidden">
          <Stat icon={<ClipboardCheck size={20} />} label="Dossiers clients" value={dossiers.length} tint="bg-emerald-50 text-emerald-700" active={tab === "dossiers"} onClick={() => setTab("dossiers")} />
          <Stat icon={<PackageCheck size={20} />} label="Colis à venir" value={incoming.length} tint="bg-cyan-50 text-cyan-700" active={tab === "arrivals"} onClick={() => { setTab("arrivals"); setArrivalSection(null); }} />
          <Stat icon={<Banknote size={20} />} label="Rapport" value={report.customer_balances.length} tint="bg-blue-50 text-[#0d3b7a]" active={tab === "reports"} onClick={() => setTab("reports")} />
          <Stat icon={<PackageCheck size={20} />} label="Disponibles" value={ready.length} tint="bg-orange-50 text-[#e85e19]" active={tab === "ready"} onClick={() => setTab("ready")} />
          <Stat icon={<CheckCircle2 size={20} />} label="Historique" value={delivered.length} tint="bg-indigo-50 text-indigo-700" active={tab === "history"} onClick={() => setTab("history")} />
        </section>}

        <section className="rounded-2xl border border-white bg-white p-3 shadow-[0_10px_35px_rgba(17,54,110,0.07)] sm:rounded-3xl sm:p-5">
          {tab !== "home" && tab !== "settings" && <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-extrabold text-[#0a2b61]">{tab === "arrivals" ? "Colis à venir" : `Opérations — ${data.zone.name}`}</h2><p className="text-xs text-slate-500">{tab === "arrivals" ? "Touchez un code client : arrivés en Haïti, ou encore en cours." : "Colis, factures, paiements et bons de remise liés à votre zone."}</p></div><form onSubmit={(event) => { event.preventDefault(); openDossier(); }} className="flex min-h-11 gap-2 md:w-[27rem]"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3"><Search size={17} className="shrink-0 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setFocusedPackageId(null); }} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Numéro de client, suivi ou facture" aria-label="Rechercher un dossier client" /></label><button type="submit" className="shrink-0 rounded-xl bg-[#0b3270] px-3 text-sm font-bold text-white hover:bg-[#0f448f]">Dossier</button></form></div>
            <p className="text-xs font-semibold text-emerald-700">Les statuts sont synchronisés automatiquement avec le système principal.</p>
            <nav className="hidden">{([
              ["dossiers", "Dossiers clients", dossiers.length],
              ["arrivals", "Colis à venir", incoming.length],
              ["ready", "Colis disponibles", ready.length],
              ["bons", "Bons de remise", data.bons.length],
              ["history", "Historique", delivered.length]
            ] as Array<[Tab, string, number]>).map(([id, label, count]) => <button key={id} type="button" onClick={() => { setTab(id); if (id === "arrivals") setArrivalSection(null); }} className={cn("whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition", tab === id ? "bg-[#0b3270] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>{label} <span className={cn("ml-1 rounded-full px-1.5 py-0.5 text-xs", tab === id ? "bg-white/20" : "bg-white")}>{count}</span></button>)}</nav>
          </div>}

          {message && <Notice message={message} close={() => setMessage(null)} />}
          {showPushBanner && tab !== "settings" && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#0d3b7a]/15 bg-[#0d3b7a]/5 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0d3b7a]/10 text-[#0d3b7a]"><Bell size={16} /></span>
                <p className="text-[13px] font-semibold text-[#0a2b61]">Activer les notifications pour les nouveaux Bons de Remise ?</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={activatePush} disabled={pushBusy}
                  className="rounded-xl bg-[#0d3b7a] px-3.5 py-2 text-[13px] font-bold text-white hover:bg-[#0f448f] disabled:opacity-60">
                  {pushBusy ? "…" : "Activer"}
                </button>
                <button type="button" onClick={dismissPushBanner} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
            </div>
          )}
          {tab === "settings" && <AgentSettingsView agentName={data.agent.name} pushPermission={pushPermission} pushBusy={pushBusy} onActivate={() => void activatePush()} />}
          {tab === "home" && <HomeDashboard search={search} onSearchChange={(value) => { setSearch(value); setFocusedPackageId(null); }} onOpenDossier={openDossier}
            bons={data.bons} selectedBonId={selectedBonId} onSelectBon={setSelectedBonId}
            bonBusy={bonBusy} bonConfirmedId={bonConfirmedId} onConfirmBon={confirmBonRemise} />}
          {tab === "dossiers" && <ClientDossiersView dossiers={matchingDossiers} focusedPackageId={focusedPackageId} expanded={expandedCustomer} onExpand={setExpandedCustomer} selectedPackageIds={selectedPackageIds} confirmedParcelIds={confirmedParcelIds} releasing={releasing} onToggleSelection={togglePackageSelection} onSelectCustomerPackages={selectPackagesForCustomer} onStartPayment={startPayment} onOpenInvoice={setSelectedInvoiceId} />}
          {tab === "arrivals" && <ArrivalsView groups={groups} expanded={expandedCustomer} section={arrivalSection} onToggleCustomer={toggleArrivalCustomer} onSelectSection={(value) => setArrivalSection((current) => current === value ? null : value)} />}
          {tab === "ready" && <ReadyView groups={groups} expanded={expandedCustomer} onExpand={setExpandedCustomer} selectedPackageIds={selectedPackageIds} confirmedParcelIds={confirmedParcelIds} releasing={releasing} onToggleSelection={togglePackageSelection} onSelectCustomerPackages={selectPackagesForCustomer} onStartPayment={startPayment} onOpenInvoice={setSelectedInvoiceId} />}
          {tab === "history" && <RemiseHistoryView packages={filteredPackages} invoices={invoices} onOpenInvoice={setSelectedInvoiceId} />}
          {tab === "history" && <DeliveredInvoicesView invoices={deliveredInvoices} onOpenInvoice={setSelectedInvoiceId} />}
          {tab === "bons" && <BonsView bons={filteredBons} onOpenPdf={(id) => void openDocument("bon-remise", id)} />}
          {tab === "reports" && <ReportsView agentName={data.agent.name} payments={reportPayments} balances={reportBalances} onOpenInvoice={setSelectedInvoiceId} onOpenReceipt={(paymentId) => window.open(`/espace-remise/recu-paiement/${paymentId}`, "_blank", "noopener,noreferrer")} />}
          {selectedInvoiceId && <InvoiceDetails invoice={invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null} packages={packages.filter((item) => item.invoice_id === selectedInvoiceId)} onClose={() => setSelectedInvoiceId(null)} />}
          {paymentDraft.invoiceId && <PaymentPanel invoice={invoices.find((invoice) => invoice.id === paymentDraft.invoiceId) ?? null} draft={paymentDraft} setDraft={setPaymentDraft} busy={paymentBusy} error={paymentError} onChange={() => setPaymentError(null)} onPay={() => void recordPayment()} onClose={() => { setPaymentDraft(emptyPaymentDraft()); setPaymentError(null); }} />}
        </section>
        </div>
        </div>
        <MobileNavigation tab={tab} moreOpen={mobileMoreOpen} onHome={() => { setTab("home"); setMobileMoreOpen(false); }} onArrivals={() => { setTab("arrivals"); setArrivalSection(null); setMobileMoreOpen(false); }} onReports={() => { setTab("reports"); setMobileMoreOpen(false); }} onReady={() => { setTab("ready"); setMobileMoreOpen(false); }} onToggleMore={() => setMobileMoreOpen((open) => !open)} onDossiers={() => { setTab("dossiers"); setMobileMoreOpen(false); }} onHistory={() => { setTab("history"); setMobileMoreOpen(false); }} onBons={() => { setTab("bons"); setMobileMoreOpen(false); }} onSettings={() => { setTab("settings"); setMobileMoreOpen(false); }} />
        {selectedPackageIds.length > 0 && confirmedParcelIds.length === 0 && !mobileMoreOpen && <RemiseConfirmBar customerCode={selectedCustomerCode} count={selectedPackageIds.length} busy={releasing} onConfirm={() => void releaseSelectedPackages()} onClear={() => setSelectedPackageIds([])} />}
        {confirmedParcelIds.length > 0 && <RemiseSuccessOverlay customerCode={selectedCustomerCode} count={confirmedParcelIds.length} />}
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
  return Array.from(byCustomer, ([customerCode, customerPackages]) => {
    // La réponse de l'API est déjà récente d'abord, mais ce tri local garde
    // ce comportement fiable après une recherche, un filtre ou un rafraîchissement.
    const packages = sortPackagesAvailableFirst(customerPackages);
    return {
      customerCode,
      packages,
      customerName: packages[0]?.customer_name ?? "",
      balanceUsd: packages[0]?.customer_balance_usd ?? 0,
      balanceHtg: packages[0]?.customer_balance_htg ?? 0,
      balanceInvoiceId: packages[0]?.balance_invoice_id ?? "",
      balanceInvoiceNumber: packages[0]?.balance_invoice_number ?? "",
      latestActivityAt: Math.max(...customerPackages.map(packageActivityAt)),
      isCentralAccount: Boolean(packages[0]?.is_central_account)
    };
  }).sort((left, right) => right.latestActivityAt - left.latestActivityAt
    || right.packages.length - left.packages.length
    || (left.customerName + " " + left.customerCode).localeCompare(right.customerName + " " + right.customerCode, "fr-CA"));
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
    // Yon kliyan ki gen yon koli plis avanse (Disponible > Ayiti > Miami)
    // monte devan otomatikman. Sa re-evalye chak rafraîchisman API.
    const stage = (items: ZonePackage[]) => items.length
      ? Math.min(...items.map((item) => packageProgressPriority(item.status)))
      : Number.MAX_SAFE_INTEGER;
    return stage(leftCounts.active) - stage(rightCounts.active)
      || rightCounts.active.length - leftCounts.active.length
      || rightCounts.latestActiveAt - leftCounts.latestActiveAt
      || rightCounts.latestActivityAt - leftCounts.latestActivityAt
      || (left.customerName + " " + left.customerCode).localeCompare(right.customerName + " " + right.customerCode, "fr-CA");
  });
}

function SideNavigation({ tab, incoming, ready, dossiers, delivered, bons, balanceCount, onHome, onArrivals, onReady, onDossiers, onHistory, onBons, onReports, onSettings }: {
  tab: Tab; incoming: number; ready: number; dossiers: number; delivered: number; bons: number; balanceCount: number;
  onHome: () => void; onArrivals: () => void; onReady: () => void; onDossiers: () => void; onHistory: () => void; onBons: () => void; onReports: () => void; onSettings: () => void;
}) {
  const Item = ({ label, count, icon, active, onClick }: { label: string; count?: number; icon: ReactNode; active: boolean; onClick: () => void }) => <button type="button" onClick={onClick} className={cn("flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-bold transition", active ? "bg-[#0b3270] text-white shadow-md shadow-blue-900/15" : "text-slate-600 hover:bg-slate-100 hover:text-[#0b3270]")}><span className={cn("grid h-8 w-8 place-items-center rounded-xl", active ? "bg-white/15" : "bg-sky-50 text-[#0b4d9b]")}>{icon}</span><span className="min-w-0 flex-1">{label}</span>{typeof count === "number" && <span className={cn("rounded-full px-2 py-0.5 text-xs", active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>{count}</span>}</button>;
  return <aside className="sticky top-4 hidden h-fit rounded-2xl border border-white/80 bg-white/90 p-2 shadow-[0_14px_35px_rgba(25,74,145,0.08)] backdrop-blur md:block md:rounded-3xl md:p-3 md:top-5">
    <p className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Navigation</p>
    <div className="space-y-1">
      <Item label="Accueil" icon={<Home size={18} />} active={tab === "home"} onClick={onHome} />
      <Item label="Colis à venir" count={incoming} icon={<PackageCheck size={18} />} active={tab === "arrivals"} onClick={onArrivals} />
      <Item label="Rapport" count={balanceCount} icon={<Banknote size={18} />} active={tab === "reports"} onClick={onReports} />
      <Item label="À remettre" count={ready} icon={<ClipboardCheck size={18} />} active={tab === "ready"} onClick={onReady} />
      <Item label="Dossiers clients" count={dossiers} icon={<Search size={18} />} active={tab === "dossiers"} onClick={onDossiers} />
      <Item label="Colis remis" count={delivered} icon={<CheckCircle2 size={18} />} active={tab === "history"} onClick={onHistory} />
    </div>
    <div className="mt-3 border-t border-slate-100 pt-3 space-y-1"><Item label="Bons de remise" count={bons} icon={<FileText size={18} />} active={tab === "bons"} onClick={onBons} /><Item label="Paramètres" icon={<Settings size={18} />} active={tab === "settings"} onClick={onSettings} /></div>
  </aside>;
}

function MobileNavigation({ tab, moreOpen, onHome, onArrivals, onReports, onReady, onToggleMore, onDossiers, onHistory, onBons, onSettings }: {
  tab: Tab; moreOpen: boolean;
  onHome: () => void; onArrivals: () => void; onReports: () => void; onReady: () => void; onToggleMore: () => void; onDossiers: () => void; onHistory: () => void; onBons: () => void; onSettings: () => void;
}) {
  const NavButton = ({ label, icon, active, onClick }: { label: string; icon: ReactNode; active: boolean; onClick: () => void }) => <button type="button" onClick={onClick} className={cn("flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[9px] font-bold transition", active ? "bg-[#0b3270] text-white shadow-md shadow-blue-900/20" : "text-slate-500 hover:bg-slate-100")}><span>{icon}</span><span>{label}</span></button>;
  return <nav className="fixed inset-x-2 bottom-2 z-40 mx-auto max-w-xl md:hidden" aria-label="Navigation de l’espace de remise">
    {moreOpen && <div className="absolute bottom-[4.1rem] right-0 grid w-52 gap-1 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl"><button type="button" onClick={onDossiers} className="rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-sky-50">Dossiers clients</button><button type="button" onClick={onHistory} className="rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-sky-50">Colis remis</button><button type="button" onClick={onBons} className="rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-sky-50">Bons de remise</button><button type="button" onClick={onSettings} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-sky-50"><Settings size={16} />Paramètres</button></div>}
    <div className="flex items-center gap-1 rounded-2xl border border-white bg-white/95 p-1 shadow-xl shadow-blue-950/15 backdrop-blur">
      <NavButton label="Accueil" icon={<Home size={17} />} active={tab === "home"} onClick={onHome} />
      <NavButton label="À venir" icon={<PackageCheck size={17} />} active={tab === "arrivals"} onClick={onArrivals} />
      <NavButton label="Rapport" icon={<Banknote size={17} />} active={tab === "reports"} onClick={onReports} />
      <NavButton label="À remettre" icon={<ClipboardCheck size={17} />} active={tab === "ready"} onClick={onReady} />
      <NavButton label="Plus" icon={<MoreHorizontal size={18} />} active={moreOpen || tab === "dossiers" || tab === "history" || tab === "bons" || tab === "settings"} onClick={onToggleMore} />
    </div>
  </nav>;
}

/** Réglage permanent : la bannière d'accueil peut être fermée, pas ce bouton. */
function AgentSettingsView({ agentName, pushPermission, pushBusy, onActivate }: {
  agentName: string; pushPermission: PushPermission; pushBusy: boolean; onActivate: () => void;
}) {
  const state = {
    checking: {
      title: "Vérification des notifications…",
      description: "Nous vérifions les réglages de cet appareil.",
      tone: "border-slate-200 bg-slate-50 text-slate-700"
    },
    granted: {
      title: "Notifications activées",
      description: "Cet appareil recevra les nouveaux bons de remise et les mises à jour de paiement de votre agence.",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800"
    },
    default: {
      title: "Notifications non activées",
      description: "Activez-les pour être averti dès qu’un bon de remise ou un paiement vous concerne.",
      tone: "border-amber-200 bg-amber-50 text-amber-900"
    },
    denied: {
      title: "Notifications refusées",
      description: "Autorisez-les dans les réglages du navigateur ou de l’application, puis revenez ici pour les activer.",
      tone: "border-red-200 bg-red-50 text-red-800"
    },
    unsupported: {
      title: "Notifications indisponibles sur cet appareil",
      description: "Utilisez un navigateur récent ou l’application STANDA pour les activer.",
      tone: "border-slate-200 bg-slate-50 text-slate-700"
    }
  }[pushPermission];

  return <div className="mx-auto max-w-2xl space-y-4 py-1 sm:py-3">
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">Paramètres</p>
      <h2 className="mt-1 text-xl font-black tracking-tight text-[#0a2b61] sm:text-2xl">Préférences de {agentName}</h2>
      <p className="mt-1 text-sm text-slate-500">Gérez les alertes de cet appareil pour votre point de retrait.</p>
    </div>

    <section className="overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-[0_12px_30px_rgba(17,54,110,0.08)]">
      <div className="bg-gradient-to-r from-[#0b3270] to-[#1b62b8] px-5 py-5 text-white sm:px-6">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><BellRing size={22} /></span><div><h3 className="font-black">Notifications de l’agence</h3><p className="mt-0.5 text-xs leading-5 text-white/80">Bons de remise et paiements clients.</p></div></div>
      </div>
      <div className="p-4 sm:p-6">
        <div className={cn("rounded-2xl border p-4", state.tone)}>
          <div className="flex gap-3"><span className="mt-0.5 shrink-0">{pushPermission === "granted" ? <CheckCircle2 size={20} /> : <Bell size={20} />}</span><div><p className="text-sm font-black">{state.title}</p><p className="mt-1 text-sm leading-5 opacity-90">{state.description}</p></div></div>
        </div>
        {pushPermission === "default" && <button type="button" onClick={onActivate} disabled={pushBusy} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0b3270] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#0f448f] disabled:cursor-wait disabled:opacity-60 sm:w-auto"><BellRing size={18} />{pushBusy ? "Activation…" : "Activer les notifications"}</button>}
        {pushPermission === "granted" && <div className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-emerald-50 px-4 text-sm font-bold text-emerald-700"><CheckCircle2 size={18} />Notifications actives</div>}
        {pushPermission === "denied" && <p className="mt-4 text-xs leading-5 text-slate-500">Sur iPhone, ouvrez Réglages, puis les réglages du site ou de l’application STANDA. Sur Android ou ordinateur, ouvrez les autorisations de notifications du navigateur.</p>}
      </div>
    </section>

    <section className="rounded-3xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5"><p className="text-sm font-black text-[#0a2b61]">Ce que vous recevrez</p><p className="mt-1 text-sm leading-6 text-slate-600">Une alerte quand un bon de remise est créé pour votre zone, et quand un paiement est enregistré pour un client de votre agence. Les alertes restent liées seulement à ce compte et à cet appareil.</p></section>
  </div>;
}

function HomeDashboard({
  search, onSearchChange, onOpenDossier, bons, selectedBonId, onSelectBon, bonBusy, bonConfirmedId, onConfirmBon
}: {
  search: string; onSearchChange: (value: string) => void; onOpenDossier: () => void;
  bons: ZoneBon[]; selectedBonId: string | null; onSelectBon: (id: string | null) => void;
  bonBusy: boolean; bonConfirmedId: string | null; onConfirmBon: (id: string) => void;
}) {
  return <>
    <PendingBonsNotification bons={bons} selectedId={selectedBonId} onSelect={onSelectBon}
      busy={bonBusy} confirmedId={bonConfirmedId} onConfirm={onConfirmBon} />
    <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b3270] via-[#1a5bc0] to-sky-400 p-4 text-white shadow-[0_20px_40px_rgba(20,76,160,0.23)] sm:rounded-3xl sm:p-8"><div className="max-w-xl"><div className="flex items-center gap-3 sm:gap-4"><span className="sm:hidden"><Logo size={48} rounded="rounded-xl" tone="light" /></span><span className="hidden sm:inline"><Logo size={64} rounded="rounded-2xl" tone="light" /></span><div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-sky-100 sm:text-xs sm:tracking-[0.18em]">STANDA COMMERCIAL</p><h2 className="mt-1 text-xl font-black tracking-tight sm:text-3xl">Rechercher un dossier client</h2></div></div><p className="mt-4 max-w-lg text-sm leading-6 text-white/85 sm:mt-5">Entrez le code du client OU un numéro de tracking / Guía (les 6 derniers chiffres suffisent) pour ouvrir le dossier, vérifier le paiement et remettre les colis.</p><form onSubmit={(event) => { event.preventDefault(); onOpenDossier(); }} className="mt-5 flex flex-col gap-2 sm:mt-6 sm:flex-row"><label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 text-[#0b3270] shadow-sm sm:min-h-12 sm:rounded-2xl sm:px-4"><Search size={17} className="shrink-0 text-sky-600" /><input value={search} onChange={(event) => onSearchChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:font-medium placeholder:text-slate-400" placeholder="Code client ou tracking · ex. MC-3817 ou 481223" aria-label="Code client ou numéro de tracking" autoCapitalize="characters" /></label><button type="submit" disabled={!search.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#ff6b1a] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#e85e19] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-12 sm:rounded-2xl sm:px-5"><Search size={17} />Ouvrir le dossier</button></form></div></section>
  </>;
}

/**
 * Notifikasyon Bon de remise sou Akèy — Rony wè imedyatman ki Bon k ap tann
 * konfimasyon (ki poko "reçu"). Yon sèl klik pou seleksyone, yon sèl bouton
 * pou konfime: TOUT koli ki te nan Bon sa a vin "Disponible" — otomatikman
 * sou admin, kliyan AK isit la, paske se menm kolòn `packages.status` la.
 */
function PendingBonsNotification({
  bons, selectedId, onSelect, busy, confirmedId, onConfirm
}: {
  bons: ZoneBon[]; selectedId: string | null; onSelect: (id: string | null) => void;
  busy: boolean; confirmedId: string | null; onConfirm: (id: string) => void;
}) {
  const pending = bons.filter((bon) => !bon.received_at);
  if (!pending.length) return null;
  return <section className="mb-3 rounded-2xl border border-[#ffd9b8] bg-[#fff4ea] p-3 shadow-sm sm:mb-5 sm:rounded-3xl sm:p-5">
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e85e19] text-white"><Truck size={21} /></span>
      <div className="min-w-0">
        <p className="text-sm font-black text-[#7a3410]">{pending.length} bon{pending.length > 1 ? "s" : ""} de remise en route vers vous</p>
        <p className="text-xs text-[#a3652f]">Sélectionnez le bon que vous venez de recevoir, puis confirmez.</p>
      </div>
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {pending.map((bon) => {
        const selected = selectedId === bon.id;
        const justConfirmed = confirmedId === bon.id;
        return <button key={bon.id} type="button" onClick={() => onSelect(selected ? null : bon.id)} disabled={busy}
          className={cn("rounded-2xl border-2 bg-white px-4 py-3 text-left transition-all duration-200 ease-out",
            selected ? "scale-[1.02] border-[#e85e19] shadow-md" : "border-transparent hover:border-[#ffd9b8]")}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-black text-[#0a2b61]">{bon.bon_number}</span>
            {justConfirmed
              ? <CheckCircle2 className="text-emerald-500" size={20} />
              : selected && <span className="grid h-5 w-5 place-items-center rounded-full bg-[#e85e19] text-white"><Check size={12} strokeWidth={3} /></span>}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{bon.package_count} colis · {dateText(bon.created_at)}{selected ? " · cliquez pour désélectionner" : ""}</p>
        </button>;
      })}
    </div>
    {selectedId && <button type="button" onClick={() => onConfirm(selectedId)} disabled={busy}
      className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#e85e19] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#c94e13] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
      {busy ? <RefreshCw size={18} className="animate-spin" /> : <PackageCheck size={18} />}
      {busy ? "Mise à jour du système…" : "Rendre ces colis disponibles"}
    </button>}
  </section>;
}

/**
 * Barre fixe : le bouton « Confirmer la remise » reste toujours visible à
 * l'écran (au-dessus de la navigation), jamais enfoui tout en bas de la liste.
 */
function RemiseConfirmBar({ customerCode, count, busy, onConfirm, onClear }: { customerCode: string; count: number; busy: boolean; onConfirm: () => void; onClear: () => void }) {
  return <div role="region" aria-label="Confirmer la remise" className="fixed inset-x-2 bottom-[4.9rem] z-50 mx-auto max-w-xl md:bottom-5">
    <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white p-2 shadow-[0_12px_40px_rgba(6,78,59,0.28)] sm:gap-3 sm:p-2.5">
      <button type="button" onClick={onClear} disabled={busy} aria-label="Annuler la sélection" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X size={18} /></button>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-[#0a2b61]">{customerCode || "Client"}</p><p className="text-xs font-semibold text-emerald-700">{count} colis sélectionné{count > 1 ? "s" : ""}</p></div>
      <button type="button" onClick={onConfirm} disabled={busy} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-70">{busy ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}{busy ? "Confirmation…" : "Confirmer la remise"}</button>
    </div>
  </div>;
}

/** Grande coche verte animée, comme à la fin d'une commande : la remise est enregistrée. */
function RemiseSuccessOverlay({ customerCode, count }: { customerCode: string; count: number }) {
  return <div role="status" aria-live="polite" className="fixed inset-0 z-[60] grid place-items-center bg-white/85 px-6 backdrop-blur-sm">
    <div className="text-center">
      <div className="sd-pop mx-auto grid h-28 w-28 place-items-center rounded-full bg-emerald-500 shadow-[0_18px_50px_rgba(16,185,129,0.45)]">
        <svg viewBox="0 0 24 24" className="h-16 w-16" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path className="sd-check" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </div>
      <p className="mt-5 text-xl font-black text-[#0a2b61]">Remise confirmée</p>
      <p className="mt-1 text-sm font-semibold text-slate-600">{count} colis livré{count > 1 ? "s" : ""}{customerCode ? " · " + customerCode : ""}</p>
    </div>
  </div>;
}

/**
 * Liste de remise : une ligne par colis, toute la ligne se touche pour la
 * cocher. La confirmation se fait dans la barre fixe (RemiseConfirmBar).
 */
function ReadyChecklist({ packages, selectedPackageIds, locked, onToggleSelection, onSelectAll, onStartPayment, onOpenInvoice }: {
  packages: ZonePackage[]; selectedPackageIds: string[]; locked: boolean;
  onToggleSelection: (item: ZonePackage) => void; onSelectAll: (ids: string[]) => void;
  onStartPayment: (invoiceId: string) => void; onOpenInvoice: (invoiceId: string) => void;
}) {
  const eligible = packages.filter(canReleaseParcel);
  const allSelected = eligible.length > 0 && eligible.every((item) => selectedPackageIds.includes(item.id));
  // Une seule action de paiement par facture impayée, pas une par colis.
  const unpaidInvoices = Array.from(new Map(packages.filter((item) => item.invoice_id && item.invoice_payment_status !== "Payé").map((item) => [item.invoice_id, item.invoice_number] as const)).entries());
  return <section className="rounded-xl border border-orange-200 bg-orange-50/60 p-2.5 sm:p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h4 className="text-[13px] font-black text-[#0a2b61] sm:text-sm">À remettre · {packages.length} colis</h4><p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">Touchez les colis que vous remettez, puis confirmez avec le bouton vert.</p></div>
      {eligible.length > 1 && <button type="button" disabled={locked} onClick={() => onSelectAll(eligible.map((item) => item.id))} className="min-h-10 rounded-xl border border-emerald-300 bg-white px-3 text-xs font-black text-emerald-800 hover:bg-emerald-50 disabled:opacity-60">{allSelected ? "Tout désélectionner" : `Tout sélectionner (${eligible.length})`}</button>}
    </div>
    <div className="mt-2 space-y-1.5">{packages.map((item) => {
      const selectable = canReleaseParcel(item);
      const selected = selectedPackageIds.includes(item.id);
      const reason = item.customer_balance_usd > 0.01 ? "Solde client à régler" : item.invoice_payment_status !== "Payé" ? "Paiement complet requis" : "";
      return <div key={item.id} className={cn("overflow-hidden rounded-xl border bg-white", selected ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200")}>
        <button type="button" role="checkbox" aria-checked={selected} disabled={!selectable || locked} onClick={() => onToggleSelection(item)} className="flex min-h-14 w-full items-center gap-3 p-2.5 text-left disabled:cursor-not-allowed sm:p-3">
          <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2", selected ? "border-emerald-600 bg-emerald-600 text-white" : selectable ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-100")}>{selected && <Check size={16} strokeWidth={3} />}</span>
          <span className="min-w-0 flex-1">
            <span className={cn("block break-all text-[13px] font-extrabold sm:text-sm", selectable ? "text-[#0a2b61]" : "text-slate-500")}>{packageReference(item)}</span>
            <span className="mt-0.5 block text-[11px] text-slate-500 sm:text-xs">Qté {item.quantity}{item.content ? " · " + item.content : ""}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold"><span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-indigo-700">{item.invoice_number} · {item.invoice_payment_status}</span>{reason && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-amber-800">{reason}</span>}</span>
          </span>
          <StatusChip status={item.status} />
        </button>
        {(item.is_special || item.invoice_payment_details) && <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5">{item.invoice_payment_details && <p className="text-[11px] font-bold text-emerald-700 sm:text-xs">{item.invoice_payment_details}</p>}<SpecialPackageNotice item={item} /></div>}
      </div>;
    })}</div>
    {unpaidInvoices.map(([invoiceId, invoiceNumber]) => <div key={invoiceId} className="mt-2 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => onStartPayment(invoiceId)} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-orange-300 bg-white px-3 text-sm font-bold text-[#bd450b] hover:bg-orange-100"><Banknote size={18} />Enregistrer le paiement · {invoiceNumber}</button><button type="button" onClick={() => onOpenInvoice(invoiceId)} className="min-h-11 rounded-xl border border-indigo-200 bg-white px-3 text-sm font-bold text-indigo-700 hover:bg-indigo-50">Voir la facture</button></div>)}
  </section>;
}

/** Onglet « À remettre » : colis prêts, un client ouvert à la fois. */
function ReadyView({ groups, expanded, onExpand, selectedPackageIds, confirmedParcelIds, releasing, onToggleSelection, onSelectCustomerPackages, onStartPayment, onOpenInvoice }: {
  groups: PackageGroup[]; expanded: string | null; onExpand: (id: string | null) => void;
  selectedPackageIds: string[]; confirmedParcelIds: string[]; releasing: boolean; onToggleSelection: (item: ZonePackage) => void;
  onSelectCustomerPackages: (customerCode: string, parcelIds: string[]) => void;
  onStartPayment: (invoiceId: string) => void; onOpenInvoice: (invoiceId: string) => void;
}) {
  if (!groups.length) return <Empty text="Aucun colis facturé n’est disponible à remettre." />;
  return <div className="grid gap-3 lg:grid-cols-2">{groups.map((group) => {
    const open = expanded === group.customerCode;
    const hasBalance = group.balanceUsd > 0.01;
    return <article id={"package-group-" + group.customerCode} key={group.customerCode} className={cn("scroll-mt-6 overflow-hidden rounded-xl border bg-white sm:rounded-2xl", hasBalance ? "border-amber-300" : group.isCentralAccount ? "border-indigo-200" : "border-slate-200")}>
      <button type="button" aria-expanded={open} onClick={() => onExpand(open ? null : group.customerCode)} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-50 sm:p-4"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-[11px]">{group.isCentralAccount ? "Opérations centrales" : "Code client"}</p><p className="mt-0.5 text-lg font-black tracking-tight text-[#0a2b61] sm:text-xl">{group.isCentralAccount ? "Compte central STANDA" : <>{group.customerCode} {group.customerName && <span className="ml-1 text-xs font-semibold text-slate-500 sm:text-sm">· {group.customerName}</span>}</>}</p><p className="mt-1 text-xs font-semibold text-orange-700 sm:text-sm">{group.packages.length} colis à remettre · {quantityTotal(group.packages)} article{quantityTotal(group.packages) > 1 ? "s" : ""}</p></div><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#edf3ff] text-[#0c397a] sm:h-10 sm:w-10"><ChevronDown size={18} className={open ? "rotate-180 transition-transform" : "transition-transform"} /></span></button>
      {open && <div className="space-y-2 border-t border-slate-100 bg-slate-50/70 p-2.5 sm:space-y-3 sm:p-3">
        {hasBalance && <BalanceNotice balanceUsd={group.balanceUsd} balanceHtg={group.balanceHtg} invoiceNumber={group.balanceInvoiceNumber} onPay={group.balanceInvoiceId ? () => onStartPayment(group.balanceInvoiceId) : undefined} />}
        <ReadyChecklist packages={group.packages} selectedPackageIds={selectedPackageIds} locked={releasing || confirmedParcelIds.length > 0} onToggleSelection={onToggleSelection} onSelectAll={(ids) => onSelectCustomerPackages(group.customerCode, ids)} onStartPayment={onStartPayment} onOpenInvoice={onOpenInvoice} />
      </div>}
    </article>;
  })}</div>;
}

/**
 * « Colis à venir » : seulement le code client et le nombre de colis en route.
 * Un clic sur le code ouvre DEUX étapes (arrivés en Haïti / à Miami) ; une seule
 * étape s'ouvre à la fois, et ouvrir un autre client referme le précédent.
 */
function ArrivalsView({ groups, expanded, section, onToggleCustomer, onSelectSection }: {
  groups: PackageGroup[]; expanded: string | null; section: ArrivalSection | null;
  onToggleCustomer: (customerCode: string) => void; onSelectSection: (value: ArrivalSection) => void;
}) {
  if (!groups.length) return <Empty text="Aucun colis à venir ne correspond à la recherche." />;
  return <div className="grid gap-2 lg:grid-cols-2 lg:items-start">{groups.map((group) => {
    const open = expanded === group.customerCode;
    const haiti = group.packages.filter((item) => arrivalSectionOf(item) === "haiti");
    const miami = group.packages.filter((item) => arrivalSectionOf(item) === "miami");
    const shown = section === "haiti" ? haiti : section === "miami" ? miami : [];
    const options: Array<[ArrivalSection, string, ZonePackage[], string, string]> = [
      ["haiti", "Arrivés en Haïti", haiti, "border-violet-200 bg-violet-50 text-violet-800", "border-violet-600 bg-violet-600 text-white"],
      ["miami", "À Miami · en cours", miami, "border-sky-200 bg-sky-50 text-sky-800", "border-sky-600 bg-sky-600 text-white"]
    ];
    return <article id={"package-group-" + group.customerCode} key={group.customerCode} className="scroll-mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white sm:rounded-2xl">
      <button type="button" aria-expanded={open} onClick={() => onToggleCustomer(group.customerCode)} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-50 sm:p-4">
        <div className="min-w-0"><p className="truncate text-lg font-black tracking-tight text-[#0a2b61] sm:text-xl">{group.isCentralAccount ? "Compte central STANDA" : group.customerCode}{!group.isCentralAccount && group.customerName && <span className="ml-1 text-xs font-semibold text-slate-500 sm:text-sm">· {group.customerName}</span>}</p></div>
        <span className="flex shrink-0 items-center gap-2"><span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-black text-sky-800">{group.packages.length} en route</span><span className="grid h-8 w-8 place-items-center rounded-full bg-[#edf3ff] text-[#0c397a]"><ChevronDown size={17} className={open ? "rotate-180 transition-transform" : "transition-transform"} /></span></span>
      </button>
      {open && <div className="space-y-2 border-t border-slate-100 bg-slate-50/70 p-2.5 sm:p-3">
        <div className="grid grid-cols-2 gap-2">{options.map(([id, label, items, idle, active]) => <button key={id} type="button" aria-pressed={section === id} onClick={() => onSelectSection(id)} className={cn("flex min-h-14 flex-col items-start justify-center rounded-xl border-2 px-3 py-2 text-left transition", section === id ? active : idle)}><span className="text-xs font-black leading-tight sm:text-sm">{label}</span><span className="mt-0.5 text-lg font-black leading-none">{items.length}</span></button>)}</div>
        {section && (shown.length ? <div className="space-y-1.5">{shown.map((item) => <ParcelRow key={item.id} item={item} />)}</div> : <p className="rounded-lg bg-white px-3 py-2 text-sm text-slate-500">Aucun colis à cette étape.</p>)}
      </div>}
    </article>;
  })}</div>;
}

/**
 * Historique : chaque remise (mêmes colis livrés en même temps à un client)
 * avec le code client, la date et l'heure, le numéro de facture et comment
 * la facture a été payée. Les colis remis n'apparaissent plus ailleurs.
 */
function RemiseHistoryView({ packages, invoices, onOpenInvoice }: { packages: ZonePackage[]; invoices: ZoneInvoice[]; onOpenInvoice: (invoiceId: string) => void }) {
  const [visible, setVisible] = useState(40);
  const remises = useMemo(() => {
    const byRemise = new Map<string, { key: string; customerCode: string; customerName: string; deliveredAt: string; packages: ZonePackage[] }>();
    for (const item of packages) {
      const key = item.customer_code + "|" + (item.delivered_at || "sans-date");
      const current = byRemise.get(key) ?? { key, customerCode: item.customer_code, customerName: item.customer_name, deliveredAt: item.delivered_at, packages: [] };
      current.packages.push(item);
      byRemise.set(key, current);
    }
    return Array.from(byRemise.values()).sort((left, right) => dateTimestamp(right.deliveredAt) - dateTimestamp(left.deliveredAt));
  }, [packages]);
  const invoiceById = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices]);
  if (!remises.length) return <Empty text="Aucun colis remis ne correspond à la recherche." />;
  return <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 sm:p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div><h3 className="text-base font-black text-[#0a2b61]">Historique des remises</h3><p className="mt-1 text-xs text-slate-600">Tout colis remis au client est classé ici, avec sa facture et son paiement.</p></div>
      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">{packages.length} colis</span>
    </div>
    <div className="space-y-3">{remises.slice(0, visible).map((remise) => {
      const invoiceIds = Array.from(new Set(remise.packages.map((item) => item.invoice_id).filter(Boolean)));
      return <article key={remise.key} className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Code client</p><p className="text-lg font-black text-[#0a2b61]">{remise.customerCode}{remise.customerName && <span className="ml-1 text-xs font-semibold text-slate-500 sm:text-sm">· {remise.customerName}</span>}</p></div>
          <div className="text-right"><StatusChip status={DONE} /><p className="mt-1 text-xs font-semibold text-slate-600">{remise.deliveredAt ? "Remis le " + dateTimeText(remise.deliveredAt) : "Date de remise non archivée"}</p></div>
        </div>
        <div className="mt-3"><p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Colis remis · {remise.packages.length} · {quantityTotal(remise.packages)} article{quantityTotal(remise.packages) > 1 ? "s" : ""}</p>
          <div className="space-y-1">{remise.packages.map((item) => <div key={item.id} className="rounded-lg border-l-4 border-emerald-400 bg-emerald-50/50 px-2.5 py-1.5"><p className="break-all text-[13px] font-bold text-[#0a2b61]">{packageReference(item)}</p><p className="text-[11px] text-slate-500">Qté {item.quantity}{item.content ? " · " + item.content : ""}</p><SpecialPackageNotice item={item} compact /></div>)}</div>
        </div>
        <div className="mt-3 space-y-2">{invoiceIds.length ? invoiceIds.map((invoiceId) => {
          const invoice = invoiceById.get(invoiceId);
          const fallback = remise.packages.find((item) => item.invoice_id === invoiceId);
          if (!invoice) return <p key={invoiceId} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Facture {fallback?.invoice_number || "—"}</p>;
          return <div key={invoiceId} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-2.5 sm:p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={() => onOpenInvoice(invoice.id)} className="text-sm font-black text-indigo-700 hover:underline">Facture {invoice.invoice_number}</button><PaymentChip status={invoice.payment_status} /></div>
            <div className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
              <p className="rounded-lg bg-white px-2.5 py-1.5"><span className="block text-slate-400">Total de la facture</span><b className="text-slate-700">{fmtUsd(invoice.grand_total_usd)}</b></p>
              <p className="rounded-lg bg-white px-2.5 py-1.5"><span className="block text-slate-400">Montant payé</span><b className="text-emerald-700">{fmtUsd(invoice.payment_paid_usd)} · {fmtHtg(invoice.payment_paid_htg)}</b></p>
            </div>
            <div className="mt-2"><p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Comment la facture a été payée</p>
              {invoice.payments.length ? <ul className="space-y-1">{invoice.payments.map((payment, index) => <li key={index} className="flex flex-wrap items-center justify-between gap-x-3 rounded-lg bg-white px-2.5 py-1.5 text-xs"><span className="font-bold text-slate-700">{payment.method}</span><span className="font-black text-emerald-700">{payment.currency === "HTG" ? fmtHtg(payment.amount) : fmtUsd(payment.amount)}</span><span className="text-slate-500">{dateText(payment.created_at)} · {payment.by}</span></li>)}</ul> : <p className="rounded-lg bg-white px-2.5 py-1.5 text-xs text-slate-500">Aucun paiement enregistré sur cette facture.</p>}
            </div>
          </div>;
        }) : <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Aucune facture liée à ces colis.</p>}</div>
      </article>;
    })}</div>
    {remises.length > visible && <button type="button" onClick={() => setVisible((count) => count + 40)} className="mt-3 min-h-11 w-full rounded-xl border border-emerald-300 bg-white px-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50">Afficher plus de remises ({remises.length - visible} restantes)</button>}
  </section>;
}

/**
 * Dossier client : tout ce qui se remet est dans UNE liste à cocher ; le reste
 * (arrivés en Haïti, en cours) n'est qu'informatif. Les clients sans colis en
 * route ni disponible sont retirés par le parent, et les colis remis ne
 * s'affichent plus ici : ils vont à l'historique.
 */
function ClientDossiersView({ dossiers, focusedPackageId, expanded, onExpand, selectedPackageIds, confirmedParcelIds, releasing, onToggleSelection, onSelectCustomerPackages, onStartPayment, onOpenInvoice }: {
  dossiers: ClientDossier[]; focusedPackageId: string | null; expanded: string | null; onExpand: (value: string | null) => void;
  selectedPackageIds: string[]; confirmedParcelIds: string[]; releasing: boolean; onToggleSelection: (item: ZonePackage) => void;
  onSelectCustomerPackages: (customerCode: string, parcelIds: string[]) => void;
  onStartPayment: (invoiceId: string) => void; onOpenInvoice: (invoiceId: string) => void;
}) {
  if (!dossiers.length) return <Empty text="Aucun client n’a de colis en route ou disponible." />;
  return <div className="grid gap-3 lg:grid-cols-2 lg:items-start">{dossiers.map((dossier) => {
    const open = expanded === dossier.customerCode;
    const scopedPackages = focusedPackageId ? dossier.packages.filter((item) => item.id === focusedPackageId) : dossier.packages;
    const scopedDossier = focusedPackageId ? { ...dossier, packages: scopedPackages } : dossier;
    const counts = dossierCounts(scopedDossier);
    const available = sortPackagesAvailableFirst(counts.active.filter(isReadyForPickup));
    const waiting = counts.active.filter((item) => !isReadyForPickup(item));
    const haiti = sortPackagesAvailableFirst(waiting.filter((item) => arrivalSectionOf(item) === "haiti"));
    const miami = sortPackagesAvailableFirst(waiting.filter((item) => arrivalSectionOf(item) === "miami"));
    const balanceSource = dossier.invoices[0] ?? dossier.packages[0];
    const balanceUsd = balanceSource?.customer_balance_usd ?? 0;
    const balanceHtg = balanceSource?.customer_balance_htg ?? 0;
    const balanceInvoice = dossier.invoices.find((invoice) => invoice.payment_status !== "Payé");
    // Une facture entièrement livrée et payée est dans l'historique, pas ici.
    const openInvoices = (focusedPackageId ? dossier.invoices.filter((invoice) => scopedPackages.some((item) => item.invoice_id === invoice.id)) : dossier.invoices)
      .filter((invoice) => invoice.delivery_status !== "Livrée" || invoice.payment_status !== "Payé");
    return <article id={"dossier-" + dossier.customerCode} key={dossier.customerCode} className={cn("scroll-mt-6 overflow-hidden rounded-xl border bg-white sm:rounded-2xl", balanceUsd > 0.01 ? "border-amber-300" : "border-slate-200")}>
      <button type="button" aria-expanded={open} onClick={() => onExpand(open ? null : dossier.customerCode)} className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-50 sm:p-4"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-[11px]">Dossier client</p><h3 className="mt-0.5 truncate text-lg font-black text-[#0a2b61] sm:text-xl">{dossier.customerCode}{dossier.customerName && <span className="ml-1 text-xs font-semibold text-slate-500 sm:text-sm">· {dossier.customerName}</span>}</h3><div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold sm:mt-3 sm:gap-2 sm:text-xs">{available.length > 0 && <span className="rounded-lg bg-orange-100 px-2 py-1 text-orange-800">À remettre : {available.length}</span>}{haiti.length > 0 && <span className="rounded-lg bg-violet-100 px-2 py-1 text-violet-800">Arrivés en Haïti : {haiti.length}</span>}{miami.length > 0 && <span className="rounded-lg bg-sky-100 px-2 py-1 text-sky-800">En cours : {miami.length}</span>}</div></div><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#edf3ff] text-[#0c397a] sm:h-10 sm:w-10"><ChevronDown size={18} className={open ? "rotate-180 transition-transform" : "transition-transform"} /></span></button>
      {open && <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 p-2.5 sm:p-3">
        {focusedPackageId && <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900">Recherche précise : seul le colis correspondant aux 6 derniers chiffres est affiché.</p>}
        {balanceUsd > 0.01 && <BalanceNotice balanceUsd={balanceUsd} balanceHtg={balanceHtg} invoiceNumber={balanceInvoice?.invoice_number ?? ""} onPay={balanceInvoice ? () => onStartPayment(balanceInvoice.id) : undefined} />}
        {available.length > 0 && <ReadyChecklist packages={available} selectedPackageIds={selectedPackageIds} locked={releasing || confirmedParcelIds.length > 0} onToggleSelection={onToggleSelection} onSelectAll={(ids) => onSelectCustomerPackages(dossier.customerCode, ids)} onStartPayment={onStartPayment} onOpenInvoice={onOpenInvoice} />}
        {haiti.length > 0 && <DossierSection title="Arrivés en Haïti" subtitle="Pas encore disponibles au point de retrait." packages={haiti} tone="violet" />}
        {miami.length > 0 && <DossierSection title="En cours" subtitle="Encore à Miami ou en transit." packages={miami} tone="sky" />}
        {openInvoices.length > 0 && <DossierInvoices invoices={openInvoices} onOpenInvoice={onOpenInvoice} />}
      </div>}
    </article>;
  })}</div>;
}

function BalanceNotice({ balanceUsd, balanceHtg, invoiceNumber, onPay }: { balanceUsd: number; balanceHtg: number; invoiceNumber: string; onPay?: () => void }) {
  return <section className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-amber-800">Solde client à régler</p><p className="mt-1 text-sm font-semibold text-slate-800">Le solde précédent doit être réglé avant toute nouvelle remise.</p><p className="mt-2 text-sm font-black text-amber-900">{fmtUsd(balanceUsd)} · {fmtHtg(balanceHtg)}{invoiceNumber ? " · " + invoiceNumber : ""}</p>{onPay && <button type="button" onClick={onPay} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-3 text-sm font-bold text-[#bd450b] hover:bg-orange-100"><Banknote size={18} />Enregistrer le paiement du solde</button>}</section>;
}

function DossierSection({ title, subtitle, packages, tone = "blue", renderPackage }: { title: string; subtitle: string; packages: ZonePackage[]; tone?: "blue" | "orange" | "emerald" | "violet" | "sky"; renderPackage?: (item: ZonePackage) => ReactNode }) {
  const tones = { blue: "border-blue-100 bg-blue-50/50", orange: "border-orange-100 bg-orange-50/50", emerald: "border-emerald-100 bg-emerald-50/50", violet: "border-violet-200 bg-violet-50/60", sky: "border-sky-200 bg-sky-50/60" };
  return <section className={cn("rounded-xl border p-2.5 sm:p-3", tones[tone])}><div className="mb-2 flex items-start justify-between gap-3"><div><h4 className="text-[13px] font-black text-[#0a2b61] sm:text-sm">{title}</h4><p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">{subtitle}</p></div><span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-600 sm:text-xs">{packages.length}</span></div>{packages.length ? <div className="space-y-1.5 sm:space-y-2">{packages.map((item) => renderPackage ? <div key={item.id}>{renderPackage(item)}</div> : <ParcelRow key={item.id} item={item} />)}</div> : <p className="rounded-lg bg-white/80 px-3 py-2 text-sm text-slate-500">Aucun colis dans cette section.</p>}</section>;
}

function SpecialPackageNotice({ item, compact = false }: { item: ZonePackage; compact?: boolean }) {
  if (!item.is_special) return null;
  return <div className={cn("rounded-lg border border-amber-200 bg-amber-50 text-amber-900", compact ? "mt-1 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold" : "mt-2 p-2.5 text-xs") }>
    <span className="inline-flex items-center gap-1 font-black"><AlertTriangle size={compact ? 13 : 15} />Colis spécial</span>
    {!compact && item.special_reason && <p className="mt-1 leading-relaxed text-amber-800"><span className="font-bold">Note :</span> {item.special_reason}</p>}
  </div>;
}

function ParcelRow({ item }: { item: ZonePackage }) {
  return <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border-l-4 bg-white px-2.5 py-2 sm:px-3", statusTone(item.status).border)}><div className="min-w-0"><p className="break-all text-[13px] font-bold text-[#0a2b61] sm:text-sm">{packageReference(item)}</p><p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">Qté : {item.quantity}{item.content ? " · " + item.content : ""}</p><SpecialPackageNotice item={item} compact /></div><StatusChip status={item.status} /></div>;
}

function DossierInvoices({ invoices, onOpenInvoice }: { invoices: ZoneInvoice[]; onOpenInvoice: (invoiceId: string) => void }) {
  return <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3"><div className="mb-2 flex items-start justify-between gap-3"><div><h4 className="text-sm font-black text-[#0a2b61]">Factures du client</h4><p className="mt-0.5 text-xs text-slate-500">Cliquez sur un numéro pour voir le total et tous les colis de la facture.</p></div><span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-600">{invoices.length}</span></div>{invoices.length ? <div className="space-y-2">{invoices.map((invoice) => <button key={invoice.id} type="button" onClick={() => onOpenInvoice(invoice.id)} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-100 bg-white px-3 py-2 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40"><span className="min-w-0"><span className="block text-sm font-bold text-indigo-700 hover:underline">{invoice.invoice_number}</span><span className="mt-0.5 block text-xs text-slate-500">{invoice.package_count} colis · Total {fmtUsd(invoice.grand_total_usd)} · {dateText(invoice.created_at)}</span></span><span className="flex flex-wrap items-center justify-end gap-2"><DeliveryChip status={invoice.delivery_status} /><PaymentChip status={invoice.payment_status} /></span></button>)}</div> : <p className="rounded-lg bg-white/80 px-3 py-3 text-sm text-slate-500">Aucune facture finalisée pour ce client.</p>}</section>;
}

function InvoiceSummary({ invoice, packages }: { invoice: ZoneInvoice; packages: ZonePackage[] }) {
  return <div className="border-t border-indigo-100 bg-white p-3"><div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg bg-blue-50 px-3 py-2"><p className="text-xs font-semibold text-slate-500">Total de la facture</p><p className="mt-0.5 font-black text-[#0a2b61]">{fmtUsd(invoice.grand_total_usd)}</p></div>{invoice.deposit_usd > 0 && <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-xs font-semibold text-slate-500">Acompte</p><p className="mt-0.5 font-black text-slate-700">{fmtUsd(invoice.deposit_usd)}</p></div>}<div className="rounded-lg bg-orange-50 px-3 py-2"><p className="text-xs font-semibold text-slate-500">Solde à payer</p><p className="mt-0.5 font-black text-[#bd450b]">{fmtUsd(invoice.amount_due_usd)} · {fmtHtg(invoice.amount_due_htg)}</p></div><div className="rounded-lg bg-emerald-50 px-3 py-2"><p className="text-xs font-semibold text-slate-500">Montant reçu</p><p className="mt-0.5 font-black text-emerald-700">{fmtUsd(invoice.payment_paid_usd)} · {fmtHtg(invoice.payment_paid_htg)}</p></div></div><div className="mt-3"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Colis dans cette facture · {packages.length}</p>{packages.length ? <div className="space-y-2">{packages.map((item) => <ParcelRow key={item.id} item={item} />)}</div> : <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">Aucun colis associé à cette facture.</p>}</div></div>;
}

function DeliveredInvoicesView({ invoices, onOpenInvoice }: { invoices: ZoneInvoice[]; onOpenInvoice: (invoiceId: string) => void }) {
  return <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-black text-[#0a2b61]">Factures livrées</h3><p className="mt-1 text-xs text-slate-600">Une facture est ajoutée ici lorsque tous ses colis ont été remis et confirmés.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">{invoices.length}</span></div>{invoices.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{invoices.map((invoice) => <button key={invoice.id} type="button" onClick={() => onOpenInvoice(invoice.id)} className="rounded-xl border border-emerald-100 bg-white p-3 text-left transition hover:border-emerald-300 hover:shadow-sm"><div className="flex items-center justify-between gap-2"><span className="font-black text-[#0a2b61]">{invoice.invoice_number}</span><DeliveryChip status={invoice.delivery_status} /></div><p className="mt-1 text-sm text-slate-600">{invoice.customer_code}{invoice.customer_name ? " · " + invoice.customer_name : ""}</p><p className="mt-2 text-xs font-semibold text-emerald-700">{invoice.delivered_packages_count}/{invoice.package_count} colis remis</p></button>)}</div> : <p className="mt-3 rounded-xl bg-white px-3 py-3 text-sm text-slate-500">Aucune facture n’est encore complètement livrée.</p>}</section>;
}

function InvoiceDetails({ invoice, packages, onClose }: { invoice: ZoneInvoice | null; packages: ZonePackage[]; onClose: () => void }) {
  if (!invoice) return null;
  return <section className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Détail de la facture</p><h3 className="mt-1 text-lg font-black text-[#0a2b61]">{invoice.invoice_number}{invoice.is_central_account ? " · Compte central STANDA" : " · " + invoice.customer_code}</h3><p className="mt-1 text-sm font-semibold text-slate-600">{invoice.is_central_account ? "Opération centrale affectée à cette zone" : invoice.customer_name || "Client STANDA"} · {invoice.payment_status}</p><div className="mt-1"><DeliveryChip status={invoice.delivery_status} /></div>{invoice.payment_details && <p className="mt-1 text-xs font-bold text-emerald-700">{invoice.payment_details}</p>}</div><button type="button" onClick={onClose} aria-label="Fermer le détail de la facture" className="rounded-lg p-1 text-slate-500 hover:bg-white"><X size={18} /></button></div><InvoiceSummary invoice={invoice} packages={packages} /></section>;
}

function PaymentPanel({ invoice, draft, setDraft, busy, error, onChange, onPay, onClose }: { invoice: ZoneInvoice | null; draft: PaymentDraft; setDraft: (value: PaymentDraft) => void; busy: boolean; error: string | null; onChange: () => void; onPay: () => void; onClose: () => void }) {
  if (!invoice) return null;
  const remainingUsd = Math.max(0, invoice.amount_due_usd - invoice.payment_paid_usd);
  const remainingHtg = Math.max(0, invoice.amount_due_htg - invoice.payment_paid_htg);
  const rate = invoiceRate(invoice);
  const typed = parsePaymentAmount(draft.amount) ?? 0;
  const hasAmount = typed > 0;
  const converted = hasAmount ? (draft.currency === "HTG" ? typed / rate : typed * rate) : 0;
  const remainingAfter = Math.max(0, (draft.currency === "HTG" ? remainingHtg : remainingUsd) - (hasAmount ? typed : 0));
  const formatIn = (currency: "USD" | "HTG", value: number) => currency === "HTG" ? fmtHtg(value) : fmtUsd(value);
  const payAll = (currency: "USD" | "HTG") => { setDraft({ ...draft, currency, amount: String(round2(currency === "HTG" ? remainingHtg : remainingUsd)) }); onChange(); };
  const allSelected = (currency: "USD" | "HTG") => hasAmount && draft.currency === currency && Math.abs(typed - (currency === "HTG" ? remainingHtg : remainingUsd)) < 0.01;
  return <section id="payment-panel" className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#bd450b]">Paiement avant remise</p><h3 className="mt-1 text-lg font-black text-[#0a2b61]">{invoice.invoice_number} · {invoice.customer_code}</h3><p className="mt-1 text-xs font-semibold text-slate-500">Le montant doit correspondre à la facture envoyée au client.</p><p className="mt-1 text-sm text-slate-600">Solde à payer : <b>{fmtUsd(remainingUsd)}</b> · {fmtHtg(remainingHtg)}</p></div><button type="button" onClick={onClose} aria-label="Fermer le paiement" className="rounded-lg p-1 text-slate-500 hover:bg-white"><X size={18} /></button></div>
    {(remainingUsd > 0 || remainingHtg > 0) && <div className="mt-3"><p className="mb-1.5 text-xs font-bold text-slate-600">Le client donne tout le montant ? Touchez pour le remplir :</p><div className="grid gap-2 sm:grid-cols-2">{(["HTG", "USD"] as const).map((currency) => <button key={currency} type="button" onClick={() => payAll(currency)} className={cn("flex min-h-12 items-center justify-between gap-2 rounded-xl border-2 px-3 text-left text-sm font-black transition", allSelected(currency) ? "border-emerald-600 bg-emerald-600 text-white" : "border-orange-200 bg-white text-[#0a2b61] hover:border-orange-400")}><span className="text-xs font-bold opacity-80">Tout payer en {currency === "HTG" ? "gourdes" : "dollars"}</span><span>{formatIn(currency, currency === "HTG" ? remainingHtg : remainingUsd)}</span></button>)}</div></div>}
    <div className="mt-3"><PaymentFields draft={draft} setDraft={setDraft} onChange={onChange} />
      <p className="mt-2 text-[11px] font-semibold text-slate-500">Les centimes sont facultatifs : entrez simplement 8 146 si le client remet 8 146 gourdes.</p>
      <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900"><p className="font-bold">Convertisseur · 1 USD = {fmtHtg(rate)}</p>{hasAmount ? <p className="mt-1 text-sm font-black">{formatIn(draft.currency, typed)} ≈ {formatIn(draft.currency === "HTG" ? "USD" : "HTG", converted)}</p> : <p className="mt-1">Entrez le montant reçu pour voir l’équivalent en {draft.currency === "HTG" ? "dollars" : "gourdes"}.</p>}{hasAmount && <p className="mt-1 font-semibold">Reste après ce paiement : {formatIn(draft.currency, remainingAfter)}</p>}</div>
      <p className="mt-2 text-[11px] font-semibold text-slate-500">Zelle : le client paie l’administration, qui enregistre lui-même le paiement (il n’entre pas dans votre caisse).</p>
      <InlinePaymentError error={error} /><button type="button" disabled={busy} onClick={onPay} className="mt-2 min-h-11 rounded-xl bg-[#e85e19] px-4 text-sm font-bold text-white hover:bg-[#ce4e0d] disabled:opacity-60">{busy ? "Enregistrement…" : "Confirmer le paiement"}</button></div></section>;
}

function PaymentFields({ draft, setDraft, onChange }: { draft: PaymentDraft; setDraft: (value: PaymentDraft) => void; onChange: () => void }) {
  return <div className="grid gap-2 sm:grid-cols-2"><input value={draft.amount} onChange={(event) => { setDraft({ ...draft, amount: event.target.value }); onChange(); }} type="text" inputMode="decimal" className="input" placeholder="Montant reçu (ex. 8 146)" autoFocus /><select value={draft.currency} onChange={(event) => { setDraft({ ...draft, currency: event.target.value as "USD" | "HTG" }); onChange(); }} className="input"><option value="HTG">Gourdes</option><option value="USD">Dollars américains</option></select><select value={draft.method} onChange={(event) => { setDraft({ ...draft, method: event.target.value as PaymentMethod }); onChange(); }} className="input"><option value="Espèces">Espèces</option><option value="MonCash">MonCash</option><option value="NatCash">NatCash</option><option value="Virement bancaire">Virement bancaire</option></select><input value={draft.reference} onChange={(event) => { setDraft({ ...draft, reference: event.target.value.slice(0, 120) }); onChange(); }} className="input" placeholder="Référence (facultative)" /></div>;
}

function ReportsView({ agentName, payments, balances, onOpenInvoice, onOpenReceipt }: { agentName: string; payments: AgentPayment[]; balances: CustomerBalanceReport[]; onOpenInvoice: (invoiceId: string) => void; onOpenReceipt: (paymentId: string) => void }) {
  const totals = payments.reduce((value, payment) => ({
    usd: value.usd + (payment.currency === "USD" ? Number(payment.amount || 0) : 0),
    htg: value.htg + (payment.currency === "HTG" ? Number(payment.amount || 0) : 0)
  }), { usd: 0, htg: 0 });
  const paymentAmount = (payment: AgentPayment) => payment.currency === "HTG" ? fmtHtg(payment.amount) : fmtUsd(payment.amount);
  return <div className="space-y-4">
    <section className="rounded-2xl bg-gradient-to-br from-[#0b3270] to-[#1a5bc0] p-5 text-white shadow-lg shadow-blue-900/15"><p className="text-xs font-black uppercase tracking-[0.16em] text-sky-100">Rapport du point de retrait</p><h2 className="mt-1 text-2xl font-black">Caisse de {agentName}</h2><p className="mt-2 max-w-2xl text-sm text-white/85">Seulement les paiements enregistrés par ce point de retrait sont comptés ici. Les paiements marqués par l’administration (dont Zelle) restent visibles sur chaque facture, sans gonfler votre caisse. Quand vous avez remis l’argent à l’administration, elle clôture le rapport : la caisse repart à zéro et seuls les soldes clients restent.</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-white/12 p-3 ring-1 ring-white/15"><p className="text-xs font-semibold text-white/70">Reçu en dollars</p><p className="mt-1 text-xl font-black">{fmtUsd(totals.usd)}</p></div><div className="rounded-xl bg-white/12 p-3 ring-1 ring-white/15"><p className="text-xs font-semibold text-white/70">Reçu en gourdes</p><p className="mt-1 text-xl font-black">{fmtHtg(totals.htg)}</p></div><div className="rounded-xl bg-white/12 p-3 ring-1 ring-white/15"><p className="text-xs font-semibold text-white/70">Clients avec solde</p><p className="mt-1 text-xl font-black">{balances.length}</p></div></div></section>
    <section className="rounded-2xl border border-emerald-100 bg-emerald-50/45 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-black text-[#0a2b61]">Paiements reçus</h3><p className="mt-1 text-xs text-slate-600">Chaque ligne correspond à un paiement que vous avez confirmé au point de retrait.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">{payments.length}</span></div>{payments.length ? <div className="mt-3 space-y-2">{payments.map((payment) => <article key={payment.id} className="rounded-xl border border-emerald-100 bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-black text-[#0a2b61]">{payment.customer_code}{payment.customer_name ? " · " + payment.customer_name : ""}</p><button type="button" onClick={() => onOpenInvoice(payment.invoice_id)} className="mt-1 text-xs font-bold text-indigo-700 hover:underline">{payment.invoice_number}</button></div><p className="rounded-lg bg-emerald-100 px-2.5 py-1 text-sm font-black text-emerald-800">{paymentAmount(payment)}</p></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-600">{payment.payment_method || "Méthode non précisée"} · {dateText(payment.created_at)}{payment.payment_reference ? " · Réf. " + payment.payment_reference : ""}</p><button type="button" onClick={() => onOpenReceipt(payment.id)} className="text-xs font-black text-[#0b3270] underline">Voir le reçu</button></div></article>)}</div> : <p className="mt-3 rounded-xl bg-white px-3 py-3 text-sm text-slate-500">Aucun paiement n’a encore été enregistré par ce point de retrait.</p>}</section>
    <section className="rounded-2xl border border-amber-200 bg-amber-50/55 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-black text-[#0a2b61]">Clients avec un solde à régler</h3><p className="mt-1 text-xs text-slate-600">Le solde doit être réglé avant une nouvelle remise. Cliquez sur la facture pour voir les colis concernés.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-amber-700">{balances.length}</span></div>{balances.length ? <div className="mt-3 grid gap-2 md:grid-cols-2">{balances.map((balance) => <button key={balance.customer_code} type="button" onClick={() => onOpenInvoice(balance.invoice_id)} className="rounded-xl border border-amber-100 bg-white p-3 text-left transition hover:border-amber-300 hover:shadow-sm"><div className="flex items-start justify-between gap-2"><p className="text-sm font-black text-[#0a2b61]">{balance.customer_code}{balance.customer_name ? " · " + balance.customer_name : ""}</p><span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">{balance.invoice_count} facture{balance.invoice_count > 1 ? "s" : ""}</span></div><p className="mt-2 text-sm font-black text-amber-900">{fmtUsd(balance.balance_usd)} · {fmtHtg(balance.balance_htg)}</p><p className="mt-1 text-xs font-bold text-indigo-700">{balance.invoice_number}</p></button>)}</div> : <p className="mt-3 rounded-xl bg-white px-3 py-3 text-sm text-slate-500">Aucun client de cette zone n’a de solde en attente.</p>}</section>
  </div>;
}

function BonsView({ bons, onOpenPdf }: { bons: ZoneBon[]; onOpenPdf: (id: string) => void }) {
  if (!bons.length) return <Empty text="Aucun bon de remise ne correspond à cette recherche." />;
  return <div className="grid gap-3 md:grid-cols-2">{bons.map((bon) => <article key={bon.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><p className="font-black text-[#0a2b61]">{bon.bon_number}</p>{bon.received_at ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><CheckCircle2 size={11} />Reçu</span> : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">En route</span>}</div><p className="mt-1 text-sm text-slate-600">{bon.destination || "Destination non précisée"} · {bon.package_count} colis</p><p className="mt-1 text-xs text-slate-400">{dateText(bon.created_at)}{bon.received_by ? ` · reçu par ${bon.received_by}` : ""}</p></div><FileDown className="text-[#e85e19]" size={21} /></div>{bon.has_pdf ? <button type="button" onClick={() => onOpenPdf(bon.id)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0b3270] px-3 text-sm font-bold text-white"><FileDown size={16} />Ouvrir le PDF</button> : <p className="mt-3 text-xs text-amber-700">PDF non archivé : ce bon a été créé avant l’archivage sécurisé.</p>}</article>)}</div>;
}

function InlinePaymentError({ error }: { error: string | null }) {
  return error ? <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null;
}
function Stat({ icon, label, value, tint, onClick, active = false }: { icon: ReactNode; label: string; value: number; tint: string; onClick?: () => void; active?: boolean }) {
  return <button type="button" onClick={onClick} className={cn("rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md", active ? "border-[#0b3270] ring-2 ring-[#0b3270]/15" : "border-white")}><div className={cn("mb-3 grid h-10 w-10 place-items-center rounded-xl", tint)}>{icon}</div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-0.5 text-2xl font-black text-[#09295e]">{value}</p></button>;
}
function Empty({ text }: { text: string }) { return <div className="py-12 text-center"><CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={38} /><p className="font-bold text-[#0a2b61]">{text}</p></div>; }
function Notice({ message, close }: { message: { type: "ok" | "error"; text: string }; close: () => void }) { return <div className={cn("mb-4 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm", message.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700")}><span>{message.text}</span><button type="button" onClick={close} aria-label="Fermer le message"><X size={17} /></button></div>; }
/**
 * Une couleur par étape, partout pareil : orange = disponible à remettre,
 * violet = arrivé en Haïti, bleu ciel = en cours (Miami / transit), vert = remis.
 */
function statusTone(status: string) {
  if (status === DONE) return { chip: "bg-emerald-100 text-emerald-700", border: "border-emerald-400" };
  if (READY_STATUSES.has(status)) return { chip: "bg-orange-100 text-orange-700", border: "border-orange-400" };
  if (HAITI_STATUSES.has(status)) return { chip: "bg-violet-100 text-violet-700", border: "border-violet-400" };
  return { chip: "bg-sky-100 text-sky-700", border: "border-sky-400" };
}
function StatusChip({ status }: { status: string }) { return <span className={cn("rounded-lg px-2 py-1 text-[11px] font-bold sm:px-2.5 sm:text-xs", statusTone(status).chip)}>{status}</span>; }
function PaymentChip({ status }: { status: string }) { const tone = status === "Payé" ? "bg-emerald-100 text-emerald-700" : status === "Payé partiel" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"; return <span className={cn("rounded-lg px-2.5 py-1 text-xs font-bold", tone)}>{status}</span>; }
function DeliveryChip({ status }: { status: string }) { const delivered = status === "Livrée"; return <span className={cn("rounded-lg px-2.5 py-1 text-xs font-bold", delivered ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>{delivered ? "Livrée" : "À remettre"}</span>; }
