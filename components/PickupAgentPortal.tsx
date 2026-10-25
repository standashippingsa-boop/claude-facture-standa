"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Banknote, Bell, BellRing, Check, CheckCircle2, ChevronRight, ClipboardCheck, FileDown, FileText, Home, LogOut, MoreHorizontal, PackageCheck, Printer, RefreshCw, Search, Settings, Truck, Users, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { autoEnablePush, getPushPermissionState, isPushSupported, reportPushFailure, subscribeStaffToPush } from "@/lib/push";
import { openSecureDocument } from "@/lib/secure-document";
import { packageProgressPriority, sortPackagesAvailableFirst } from "@/lib/utils";
import Loader, { Spinner } from "@/components/Loader";
import { RemiseTicketOverlay } from "@/components/RemiseTicketPage";
import ClientPaymentForm, { PaymentModal, type ClientPaymentSubmit } from "@/components/ClientPaymentForm";
import { invoiceStatusLines } from "@/lib/payment-allocation";
import { notify, useNoticeToast } from "@/lib/notify";
import type { PaymentInvoice } from "@/lib/payment-allocation";
import Logo from "@/components/Logo";
import StaffNotifications from "@/components/StaffNotifications";

import { MessageScreen } from "@/components/Toaster";
import PwaInstallButton from "@/components/PwaInstallButton";
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
type PaymentTarget = { customerCode: string; invoiceIds?: string[] };
type PushPermission = NotificationPermission | "unsupported" | "checking";
type ClientDossier = { customerCode: string; customerName: string; packages: ZonePackage[]; invoices: ZoneInvoice[] };
type DossierCounts = { active: ZonePackage[]; enRoute: number; available: number; latestActiveAt: number; latestActivityAt: number };
type PackageGroup = { customerCode: string; customerName: string; packages: ZonePackage[]; balanceUsd: number; balanceHtg: number; balanceInvoiceId: string; balanceInvoiceNumber: string; latestActivityAt: number; isCentralAccount: boolean };

const DONE = "Livré";
const READY_STATUSES = new Set(["Disponible", "Facturé"]);
const fmtUsd = (value: number) => "$" + Number(value || 0).toFixed(2);
const fmtHtg = (value: number) => new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 2 }).format(Number(value || 0)) + " HTG";
const dateText = (value: string) => value ? new Date(value).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }) : "·";
const quantityTotal = (items: ZonePackage[]) => items.reduce((total, item) => total + (Number(item.quantity) || 1), 0);
const packageReference = (item: ZonePackage) => item.tracking_manual || item.tracking_number || "Colis sans numéro de suivi";
const isReadyForPickup = (item: ZonePackage) => READY_STATUSES.has(item.status) && Boolean(item.invoice_id);
/** Un colis se remet seulement quand sa facture est payée et que le client n'a aucun solde ouvert. */
const canReleaseParcel = (item: ZonePackage) => isReadyForPickup(item) && item.invoice_payment_status === "Payé" && item.customer_balance_usd <= 0.01;
const HAITI_STATUSES = new Set(["Arrivé en Haïti", "En route vers agence"]);
// Un colis « Disponible » sans facture est déjà en Haïti : il attend seulement sa facture.
const arrivalSectionOf = (item: ZonePackage): ArrivalSection => HAITI_STATUSES.has(item.status) || READY_STATUSES.has(item.status) ? "haiti" : "miami";
const dateTimeText = (value: string) => value ? new Date(value).toLocaleString("fr-CA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "·";
/** Facture de zone -> format du calcul de répartition (montant = solde de la facture envoyée au client). */
const toPaymentInvoice = (invoice: ZoneInvoice): PaymentInvoice => ({
  id: invoice.id, invoice_number: invoice.invoice_number, customer_code: invoice.customer_code,
  grand_total: invoice.amount_due_usd, total_usd: invoice.amount_due_usd, total_htg: invoice.amount_due_htg,
  exchange_rate_used: invoice.exchange_rate, order_deposit: 0, balance_due: invoice.amount_due_usd, has_pdf: invoice.has_pdf,
  payment_paid_usd: invoice.payment_paid_usd, payment_paid_htg: invoice.payment_paid_htg, created_at: invoice.created_at
});
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
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  // Ticket de remise affiché à l'écran (aperçu + impression) et proposition de
  // remise juste après un paiement qui rend les colis du client remettables.
  const [ticketPackageId, setTicketPackageId] = useState<string | null>(null);
  const [remiseOffer, setRemiseOffer] = useState<{ customerCode: string; packageIds: string[]; paymentText: string } | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [loadError, setLoadError] = useState("");
  useNoticeToast(message, setMessage);
  const [loading, setLoading] = useState(true);
  const [showPushBanner, setShowPushBanner] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushPermission, setPushPermission] = useState<PushPermission>("checking");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) { router.replace("/point-retrait"); return null; }
      const response = await fetch("/api/pickup-agent", { cache: "no-store", headers: { Authorization: "Bearer " + token } });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.reason || "Chargement impossible.");
      setData(json as PortalData);
      setLoadError("");
      return json as PortalData;
    } catch (error) {
      if (!silent) {
        setData(null);
        setLoadError(error instanceof Error ? error.message : "Chargement impossible.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
    return null;
  }, [router]);

  useEffect(() => { void load(); }, [load]);
  // Mise à jour automatique : toutes les 20 s quand l'app est à l'écran, jamais
  // deux chargements en même temps (sur un réseau lent, ils s'empilaient et
  // l'écran se figeait).
  const refreshingRef = useRef(false);
  useEffect(() => {
    const refresh = async () => {
      if (refreshingRef.current || document.visibilityState !== "visible") return;
      refreshingRef.current = true;
      try { await load(true); } finally { refreshingRef.current = false; }
    };
    const timer = window.setInterval(() => void refresh(), 20_000);
    const onVisible = () => void refresh();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);

  /** Bannière d'accueil + état affiché dans Paramètres. */
  useEffect(() => {
    if (!data?.agent.id) return;
    let active = true;
    let dismissed = false;
    try { dismissed = window.localStorage.getItem("standa-agence:push-dismissed") === "1"; } catch { /* ignore */ }
    if (!isPushSupported()) { setPushPermission("unsupported"); return; }
    const agentId = data.agent.id;
    // Menm jan ak app kliyan an: fenèt sistèm nan parèt dirèkteman, epi yon
    // aparèy ki deja otorize re-anrejistre an silans.
    void autoEnablePush(() => subscribeStaffToPush(agentId)).then(async (state) => {
      if (!active) return;
      setPushPermission(await getPushPermissionState());
      if (state === "prompt-needed" && !dismissed) setShowPushBanner(true);
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
      else if (r.reason === "denied") { setPushPermission("denied"); setMessage({ type: "error", text: "Notifications refusées · activez les notifications depuis les réglages de l'application si vous changez d'avis." }); dismissPushBanner(); }
      else { setMessage({ type: "error", text: "Impossible d'activer les notifications pour le moment." }); void reportPushFailure(r.reason ?? "inconnu"); }
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
        setMessage({ type: "error", text: "Plus d’un colis possède ces 6 derniers chiffres. Encodez le numéro de suivi complet pour éviter toute erreur." });
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

  const releasePackages = async (packageIds: string[]) => {
    if (releasing || !packageIds.length) return;
    setReleasing(true);
    setMessage(null);
    try {
      const result = await call({ action: "release_many", package_ids: packageIds });
      if (!result) return;
      const confirmed: string[] = Array.isArray(result.package_ids) ? result.package_ids : packageIds;
      setSelectedPackageIds(confirmed);
      setConfirmedParcelIds(confirmed);
      // Chaque remise produit son ticket : il s'ouvre ici même, avec l'aperçu et le bouton Imprimer.
      window.setTimeout(() => {
        setConfirmedParcelIds([]); setSelectedPackageIds([]);
        if (confirmed[0]) setTicketPackageId(confirmed[0]);
        void load(true);
      }, 1_200);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Remise impossible." });
    } finally {
      setReleasing(false);
    }
  };
  const releaseSelectedPackages = () => releasePackages(selectedPackageIds);

  const confirmBonRemise = async (bonId: string) => {
    if (bonBusy) return;
    setBonBusy(true);
    setMessage(null);
    try {
      const result = await call({ action: "confirm_bon_remise", bon_remise_id: bonId });
      setBonConfirmedId(bonId);
      const text = result.alreadyConfirmed
        ? "Ce bon a déjà été confirmé."
        : `${result.updated} colis rendus disponibles${result.alreadyReady ? ` · ${result.alreadyReady} l'étaient déjà` : ""}.`;
      setMessage({ type: "ok", text });
      window.setTimeout(() => { setBonConfirmedId(null); setSelectedBonId(null); void load(); }, 1_400);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Confirmation impossible." });
    } finally {
      setBonBusy(false);
    }
  };

  const hostHasCustomer = (customerCode: string) => tab === "dossiers"
    ? matchingDossiers.some((dossier) => dossier.customerCode === customerCode)
    : tab === "ready" ? groups.some((group) => group.customerCode === customerCode) : false;
  // Paiement et détail de facture s'ouvrent DANS la carte du client quand elle est
  // ouverte à l'écran ; sinon (rapport, historique) dans une fenêtre au-dessus.
  const inlineCustomer = (tab === "dossiers" || tab === "ready") && expandedCustomer && hostHasCustomer(expandedCustomer) ? expandedCustomer : null;
  const selectedInvoice = selectedInvoiceId ? invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null : null;
  void inlineCustomer;
  const invoiceInline = false;
  const paymentInline = false;
  const paymentInvoicesFor = (customerCode: string) => invoices
    .filter((invoice) => invoice.customer_code === customerCode && invoice.has_pdf && invoice.payment_status !== "Payé")
    .map(toPaymentInvoice);

  const recordPayment = async (payload: ClientPaymentSubmit) => {
    setPaymentBusy(true);
    setPaymentError(null);
    try {
      const result = await call({
        action: "record_payment", invoice_ids: payload.invoiceIds,
        lines: payload.lines.map((line) => ({ amount: line.amount, currency: line.currency, payment_method: line.method, payment_reference: line.reference }))
      });
      if (!result) return;
      const lines = (result.payments ?? []) as Array<{ invoice_number: string; payment_status: string }>;
      const paymentText = `${payload.summary}\n${invoiceStatusLines(lines)}`;
      const customerCode = paymentTarget?.customerCode ?? "";
      // Operasyon fini: tounen sou paj anvan an (dosye kliyan an), pa rete sou fòm nan.
      window.history.back();
      const fresh = await load(true);
      const releasable = (fresh?.packages ?? []).filter((item) => item.customer_code === customerCode && canReleaseParcel(item)).map((item) => item.id);
      if (releasable.length) setRemiseOffer({ customerCode, packageIds: releasable, paymentText });
      else notify.success(paymentText, { title: `Paiement enregistré · ${customerCode}` });
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Paiement impossible.", { title: "Paiement non enregistré" });
    } finally {
      setPaymentBusy(false);
    }
  };

  const startPayment = (customerCode: string, invoiceIds?: string[]) => {
    if (!customerCode) return;
    setPaymentTarget({ customerCode, invoiceIds });
    setPaymentError(null);
    setSelectedInvoiceId(null);
    if ((tab === "dossiers" || tab === "ready") && hostHasCustomer(customerCode)) setExpandedCustomer(customerCode);
    else if (dossiers.some((dossier) => dossier.customerCode === customerCode)) {
      // Depuis le rapport : on entre dans le dossier du client pour encaisser.
      setTab("dossiers"); setSearch(customerCode); setFocusedPackageId(null); setExpandedCustomer(customerCode);
    }
    window.setTimeout(() => document.getElementById("payment-inline-" + customerCode)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const openInvoice = (invoiceId: string) => {
    setPaymentTarget(null);
    setSelectedInvoiceId(invoiceId);
    window.setTimeout(() => document.getElementById("invoice-inline-" + invoiceId)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
  };

  const renderPayment = (customerCode: string) => paymentInline && paymentTarget?.customerCode === customerCode
    ? <div id={"payment-inline-" + customerCode} className="scroll-mt-24"><ClientPaymentForm key={customerCode + (paymentTarget.invoiceIds ?? []).join()} title="Paiement avant remise" customerCode={customerCode} customerName={dossiers.find((dossier) => dossier.customerCode === customerCode)?.customerName} invoices={paymentInvoicesFor(customerCode)} initialSelected={paymentTarget.invoiceIds} busy={paymentBusy} error={paymentError} onSubmit={(payload) => void recordPayment(payload)} onClose={() => { setPaymentTarget(null); setPaymentError(null); }} /></div>
    : null;
  const renderInvoice = (customerCode: string) => invoiceInline && selectedInvoice && selectedInvoice.customer_code === customerCode
    ? <div id={"invoice-inline-" + selectedInvoice.id} className="scroll-mt-24"><InvoiceDetails invoice={selectedInvoice} packages={packages.filter((item) => item.invoice_id === selectedInvoice.id)} onClose={() => setSelectedInvoiceId(null)} onPay={selectedInvoice.payment_status !== "Payé" && selectedInvoice.has_pdf ? () => startPayment(selectedInvoice.customer_code, [selectedInvoice.id]) : undefined} /></div>
    : null;

  const openDocument = async (kind: "invoice" | "bon-remise", id: string) => {
    try { await openSecureDocument(kind, id); }
    catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "PDF indisponible." }); }
  };

  // ── NAVIGASYON PA PAJ ─────────────────────────────────────────────────
  // Chak aksyon ki louvri yon bagay (dosye, fakti, peman, tikè, onglè) se yon
  // PAJ: li antre nan istorik navigatè a. Bouton « Retour » ak gès retou
  // telefòn nan tounen sou paj anvan an, pa soti nan app la.
  type NavSnapshot = { tab: Tab; expandedCustomer: string | null; selectedInvoiceId: string | null; paymentTarget: PaymentTarget | null; arrivalSection: ArrivalSection | null; ticketPackageId: string | null };
  const snapshot: NavSnapshot = { tab, expandedCustomer, selectedInvoiceId, paymentTarget, arrivalSection, ticketPackageId };
  const snapshotKey = JSON.stringify(snapshot);
  const lastKeyRef = useRef<string | null>(null);
  const restoringRef = useRef(false);
  const applySnapshot = (next: NavSnapshot) => {
    restoringRef.current = true;
    setTab(next.tab); setExpandedCustomer(next.expandedCustomer); setSelectedInvoiceId(next.selectedInvoiceId);
    setPaymentTarget(next.paymentTarget); setArrivalSection(next.arrivalSection); setTicketPackageId(next.ticketPackageId);
    setPaymentError(null); setMobileMoreOpen(false);
  };
  const applySnapshotRef = useRef(applySnapshot);
  applySnapshotRef.current = applySnapshot;
  useEffect(() => {
    if (lastKeyRef.current === null) { lastKeyRef.current = snapshotKey; return; }
    if (lastKeyRef.current === snapshotKey) return;
    lastKeyRef.current = snapshotKey;
    if (restoringRef.current) { restoringRef.current = false; }
    else { try { window.history.pushState({ ...(window.history.state ?? {}), standaAgentNav: snapshot }, "", window.location.href); } catch { /* noop */ } }
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotKey]);
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const saved = event.state && typeof event.state === "object" ? (event.state as { standaAgentNav?: NavSnapshot }).standaAgentNav : undefined;
      applySnapshotRef.current(saved ?? { tab: "home", expandedCustomer: null, selectedInvoiceId: null, paymentTarget: null, arrivalSection: null, ticketPackageId: null });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  /** Meni an: chak onglè louvri sou LIS li, pa sou paj yon kliyan ki te louvri anvan. */
  const goTab = (next: Tab) => { setTab(next); setExpandedCustomer(null); setSelectedInvoiceId(null); setPaymentTarget(null); setArrivalSection(null); setFocusedPackageId(null); };
  const goBack = () => { if (!paymentBusy) window.history.back(); };
  // Changer de page referme toujours le menu « Plus ».
  useEffect(() => { setMobileMoreOpen(false); }, [tab, expandedCustomer, paymentTarget, selectedInvoiceId]);

  const subPage: "payment" | "invoice" | null = paymentTarget ? "payment" : selectedInvoice ? "invoice" : null;
  // Yon dosye kliyan ouvè = yon paj pou kliyan sa a sèlman.
  const dossierPage = expandedCustomer ? dossiers.filter((dossier) => dossier.customerCode === expandedCustomer) : [];
  const groupPage = expandedCustomer ? groups.filter((group) => group.customerCode === expandedCustomer) : [];
  const shownDossiers = dossierPage.length ? dossierPage : matchingDossiers;
  const shownGroups = groupPage.length ? groupPage : groups;
  const onCustomerPage = (tab === "dossiers" && dossierPage.length > 0) || ((tab === "ready" || tab === "arrivals") && groupPage.length > 0)
    || (tab === "history" && !!expandedCustomer && filteredPackages.some((item) => item.customer_code === expandedCustomer));
  const TAB_TITLES: Record<Tab, string> = { home: "Accueil", dossiers: "Dossiers clients", arrivals: "Colis à venir", ready: "À remettre", bons: "Bons de remise", history: "Colis remis", reports: "Rapport", settings: "Paramètres" };
  const pageTitle = subPage === "payment" ? `Paiement · ${paymentTarget?.customerCode ?? ""}`
    : subPage === "invoice" ? `Facture ${selectedInvoice?.invoice_number ?? ""}`
    : onCustomerPage && tab === "arrivals" && arrivalSection ? `${expandedCustomer} · ${arrivalSection === "haiti" ? "Arrivés en Haïti" : "À Miami · en cours"}`
    : onCustomerPage ? `Client ${expandedCustomer}`
    : TAB_TITLES[tab];

  const logout = async () => { await supabase.auth.signOut(); router.replace("/point-retrait"); };

  const firstName = (data?.agent.name ?? "").trim().split(/\s+/)[0] || "Agent";
  const showBack = Boolean(data) && (tab !== "home" || Boolean(subPage));
  const cash = cashTotals(report.agent_payments);
  const pendingBonCount = (data?.bons ?? []).filter((bon) => !bon.received_at).length;

  return <>
    <div className="agent-app min-h-screen bg-[#f2f4f8] text-slate-900">
      {/* ── Ba anlè : tit paj la + Retour, tankou yon app bank ── */}
      <header className="sticky top-0 z-30 bg-[#0b2a5b] text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-6">
          {showBack
            ? <button type="button" onClick={goBack} disabled={paymentBusy} aria-label="Retour" className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition hover:bg-white/10 disabled:opacity-40"><ArrowLeft size={20} /></button>
            : <Logo size={32} rounded="rounded-lg" tone="light" />}
          <div className="min-w-0 flex-1">
            {showBack
              ? <p className="truncate text-[15px] font-semibold">{pageTitle}</p>
              : <><p className="truncate text-[15px] font-semibold leading-tight">{data ? `Bonjour, ${firstName}` : "STANDA"}</p><p className="truncate text-[11px] text-white/65">{data ? `Point de retrait · ${data.zone.name}` : "Point de retrait"}</p></>}
          </div>
          <PwaInstallButton appName="STANDA Retrait" />
          <StaffNotifications variant="icon" />
          <button type="button" onClick={logout} aria-label="Se déconnecter" title="Se déconnecter" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/85 transition hover:bg-white/10"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 pb-28 pt-4 sm:px-6 md:pb-10">
        {loading && <div className="grid min-h-[45vh] place-items-center"><Loader inline size={64} /></div>}
        {!loading && !data && <MessageScreen tone="error" title="Accès à vérifier" text={loadError || "Impossible de préparer votre espace."} actionLabel="Réessayer" onAction={() => void load()} />}
        {!loading && data && <>
          <div className="md:grid md:grid-cols-[200px_minmax(0,1fr)] md:gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <SideNavigation tab={tab} incoming={incoming.length} ready={ready.length} dossiers={dossiers.length} delivered={delivered.length} bons={data.bons.length} balanceCount={report.customer_balances.length} onHome={() => goTab("home")} onArrivals={() => { goTab("arrivals"); setArrivalSection(null); }} onReady={() => goTab("ready")} onDossiers={() => goTab("dossiers")} onHistory={() => goTab("history")} onBons={() => goTab("bons")} onReports={() => goTab("reports")} onSettings={() => goTab("settings")} />
            <div className={cn("min-w-0 space-y-4", selectedPackageIds.length ? "pb-24 md:pb-20" : "")}>
              {showPushBanner && tab !== "settings" && <PushBanner busy={pushBusy} onActivate={() => void activatePush()} onDismiss={dismissPushBanner} />}
              {tab !== "home" && tab !== "settings" && !subPage && !onCustomerPage && <SearchBar value={search} onChange={(value) => { setSearch(value); setFocusedPackageId(null); }} onSubmit={openDossier}
                hint={tab === "arrivals" ? "Touchez un client pour voir ses colis arrivés en Haïti ou encore en cours." : null} />}

              {!subPage && tab === "settings" && <AgentSettingsView agentName={data.agent.name} pushPermission={pushPermission} pushBusy={pushBusy} onActivate={() => void activatePush()} />}
              {!subPage && tab === "home" && <HomeDashboard zoneName={data.zone.name} cash={cash} balanceCount={report.customer_balances.length}
                counts={{ ready: ready.length, incoming: incoming.length, dossiers: dossiers.length, bons: pendingBonCount }}
                payments={report.agent_payments} onGo={(next) => { goTab(next); if (next === "arrivals") setArrivalSection(null); }}
                onOpenReceipt={(paymentId) => window.open(`/espace-remise/recu-paiement/${paymentId}`, "_blank", "noopener,noreferrer")}
                search={search} onSearchChange={(value) => { setSearch(value); setFocusedPackageId(null); }} onOpenDossier={openDossier}
                bons={data.bons} selectedBonId={selectedBonId} onSelectBon={setSelectedBonId}
                bonBusy={bonBusy} bonConfirmedId={bonConfirmedId} onConfirmBon={confirmBonRemise} />}
              {!subPage && tab === "dossiers" && <ClientDossiersView dossiers={shownDossiers} focusedPackageId={focusedPackageId} expanded={expandedCustomer} onExpand={setExpandedCustomer} selectedPackageIds={selectedPackageIds} confirmedParcelIds={confirmedParcelIds} releasing={releasing} onToggleSelection={togglePackageSelection} onSelectCustomerPackages={selectPackagesForCustomer} onStartPayment={startPayment} onOpenInvoice={openInvoice} renderPayment={renderPayment} renderInvoice={renderInvoice} />}
              {!subPage && tab === "arrivals" && <ArrivalsView groups={shownGroups} expanded={expandedCustomer} section={arrivalSection} onToggleCustomer={toggleArrivalCustomer} onSelectSection={(value) => setArrivalSection(value)} />}
              {!subPage && tab === "ready" && <ReadyView groups={shownGroups} expanded={expandedCustomer} onExpand={setExpandedCustomer} selectedPackageIds={selectedPackageIds} confirmedParcelIds={confirmedParcelIds} releasing={releasing} onToggleSelection={togglePackageSelection} onSelectCustomerPackages={selectPackagesForCustomer} onStartPayment={startPayment} onOpenInvoice={openInvoice} renderPayment={renderPayment} renderInvoice={renderInvoice} />}
              {!subPage && tab === "history" && <RemiseHistoryView packages={filteredPackages} onOpenTicket={(packageId) => setTicketPackageId(packageId)} openCustomer={expandedCustomer} onOpenCustomer={setExpandedCustomer} />}
              {!subPage && tab === "bons" && <BonsView bons={filteredBons} onOpenPdf={(id) => void openDocument("bon-remise", id)} />}
              {!subPage && tab === "reports" && <ReportsView zoneName={data.zone.name} deliveries={delivered} allPayments={report.agent_payments} allBalances={report.customer_balances}
                onSendReport={async (pdf, summary) => { await call({ action: "send_report", pdf, summary }); }}
                agentName={data.agent.name} payments={reportPayments} balances={reportBalances} onOpenInvoice={openInvoice} onStartPayment={(customerCode) => startPayment(customerCode)} onOpenReceipt={(paymentId) => window.open(`/espace-remise/recu-paiement/${paymentId}`, "_blank", "noopener,noreferrer")} />}
              {subPage === "invoice" && selectedInvoice && !invoiceInline && <InvoiceDetails invoice={selectedInvoice} packages={packages.filter((item) => item.invoice_id === selectedInvoice.id)} onClose={goBack} onPay={selectedInvoice.payment_status !== "Payé" && selectedInvoice.has_pdf ? () => startPayment(selectedInvoice.customer_code, [selectedInvoice.id]) : undefined} />}
              {subPage === "payment" && paymentTarget && !paymentInline && <ClientPaymentForm plain key={paymentTarget.customerCode + (paymentTarget.invoiceIds ?? []).join()} title="Paiement avant remise" customerCode={paymentTarget.customerCode} customerName={dossiers.find((dossier) => dossier.customerCode === paymentTarget.customerCode)?.customerName ?? report.customer_balances.find((balance) => balance.customer_code === paymentTarget.customerCode)?.customer_name} invoices={paymentInvoicesFor(paymentTarget.customerCode)} initialSelected={paymentTarget.invoiceIds} busy={paymentBusy} error={paymentError} onSubmit={(payload) => void recordPayment(payload)} onClose={goBack} />}
            </div>
          </div>
          <MobileNavigation tab={tab} moreOpen={mobileMoreOpen} onHome={() => { goTab("home"); setMobileMoreOpen(false); }} onArrivals={() => { goTab("arrivals"); setArrivalSection(null); setMobileMoreOpen(false); }} onReports={() => { goTab("reports"); setMobileMoreOpen(false); }} onReady={() => { goTab("ready"); setMobileMoreOpen(false); }} onToggleMore={() => setMobileMoreOpen((open) => !open)} onDossiers={() => { goTab("dossiers"); setMobileMoreOpen(false); }} onHistory={() => { goTab("history"); setMobileMoreOpen(false); }} onBons={() => { goTab("bons"); setMobileMoreOpen(false); }} onSettings={() => { goTab("settings"); setMobileMoreOpen(false); }} />
          {selectedPackageIds.length > 0 && confirmedParcelIds.length === 0 && !mobileMoreOpen && <RemiseConfirmBar customerCode={selectedCustomerCode} count={selectedPackageIds.length} busy={releasing} onConfirm={() => void releaseSelectedPackages()} onClear={() => setSelectedPackageIds([])} />}
          {confirmedParcelIds.length > 0 && <RemiseSuccessOverlay customerCode={selectedCustomerCode} count={confirmedParcelIds.length} />}
          {remiseOffer && <RemiseOffer offer={remiseOffer} busy={releasing} onRelease={() => { const ids = remiseOffer.packageIds; setRemiseOffer(null); void releasePackages(ids); }} onLater={() => setRemiseOffer(null)} />}
        </>}
      </main>
    </div>
    {/* Ticket : hors de l'échelle réduite, pour que l'impression garde la vraie largeur du papier. */}
    {data && ticketPackageId && <RemiseTicketOverlay packageId={ticketPackageId} onClose={goBack} />}
  </>;
}

/** Argent encaissé par l'agent (Zelle exclu : il arrive directement sur le compte STANDA). */
function cashTotals(payments: AgentPayment[]) {
  return payments.filter((payment) => payment.payment_method !== "Zelle").reduce((value, payment) => ({
    usd: value.usd + (payment.currency === "USD" ? Number(payment.amount || 0) : 0),
    htg: value.htg + (payment.currency === "HTG" ? Number(payment.amount || 0) : 0)
  }), { usd: 0, htg: 0 });
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

// ═══════════════════════════════════════════════════════════════════════════
// PRÉSENTATION — style application bancaire : en-tête bleu marine plein, cartes
// blanches plates, listes à lignes, chiffres en avant. Aucune logique ici :
// toutes les actions viennent des props du composant principal.
// ═══════════════════════════════════════════════════════════════════════════
const NAVY = "#0b2a5b";

function initialsOf(name: string, code: string) {
  const letters = name.trim().split(/\s+/).filter((word) => /[A-Za-zÀ-ÿ]/.test(word[0] ?? "")).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return letters || code.replace(/\D/g, "").slice(-2) || "?";
}

function Avatar({ name, code, tone = "navy" }: { name: string; code: string; tone?: "navy" | "orange" | "emerald" | "violet" | "sky" }) {
  const tones = { navy: "bg-[#e7ecf5] text-[#0b2a5b]", orange: "bg-orange-50 text-[#c2410c]", emerald: "bg-emerald-50 text-emerald-700", violet: "bg-violet-50 text-violet-700", sky: "bg-sky-50 text-sky-700" };
  return <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold", tones[tone])} aria-hidden="true">{initialsOf(name, code)}</span>;
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70", className)}>{children}</section>;
}

function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3.5"><div className="min-w-0"><h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>{subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}</div>{right}</div>;
}

function CountPill({ value, tone = "slate" }: { value: number | string; tone?: "slate" | "orange" | "emerald" | "amber" }) {
  const tones = { slate: "bg-slate-100 text-slate-600", orange: "bg-orange-50 text-[#c2410c]", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-800" };
  return <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums", tones[tone])}>{value}</span>;
}

/** Ligne de client : touchée, elle ouvre la page du client. */
function CustomerRow({ code, name, meta, right, tone, open, onOpen, central = false }: { code: string; name: string; meta: ReactNode; right?: ReactNode; tone?: "navy" | "orange" | "emerald" | "violet" | "sky"; open: boolean; onOpen: () => void; central?: boolean }) {
  return <button type="button" aria-expanded={open} onClick={() => { if (!open) onOpen(); }} disabled={open} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-white">
    <Avatar name={central ? "STANDA" : name} code={code} tone={tone} />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[15px] font-semibold text-slate-900">{central ? "Compte central STANDA" : code}{!central && name && <span className="font-normal text-slate-500"> · {name}</span>}</span>
      <span className="mt-0.5 block text-xs text-slate-500">{meta}</span>
    </span>
    {right}
    {!open && <ChevronRight size={18} className="shrink-0 text-slate-300" />}
  </button>;
}

function SearchBar({ value, onChange, onSubmit, hint }: { value: string; onChange: (value: string) => void; onSubmit: () => void; hint?: string | null }) {
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="space-y-1.5">
    <div className="flex h-12 items-center gap-2 rounded-2xl bg-white pl-4 pr-1.5 ring-1 ring-slate-200 transition focus-within:ring-2 focus-within:ring-[#0b2a5b]">
      <Search size={18} className="shrink-0 text-slate-400" />
      <input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400" placeholder="Code client, suivi ou facture" aria-label="Rechercher un dossier client" autoCapitalize="characters" />
      <button type="submit" disabled={!value.trim()} className="h-9 shrink-0 rounded-xl px-3.5 text-[13px] font-semibold text-white transition disabled:opacity-35" style={{ background: NAVY }}>Ouvrir</button>
    </div>
    {hint && <p className="px-1 text-xs text-slate-500">{hint}</p>}
  </form>;
}

function PushBanner({ busy, onActivate, onDismiss }: { busy: boolean; onActivate: () => void; onDismiss: () => void }) {
  return <Card className="flex items-center gap-3 px-4 py-3">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e7ecf5] text-[#0b2a5b]"><Bell size={16} /></span>
    <p className="min-w-0 flex-1 text-[13px] text-slate-700">Recevoir une alerte pour chaque nouveau bon de remise ?</p>
    <button type="button" onClick={onActivate} disabled={busy} className="h-9 shrink-0 rounded-xl px-3 text-[13px] font-semibold text-white disabled:opacity-60" style={{ background: NAVY }}>{busy ? "…" : "Activer"}</button>
    <button type="button" onClick={onDismiss} aria-label="Fermer" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X size={16} /></button>
  </Card>;
}

function SideNavigation({ tab, incoming, ready, dossiers, delivered, bons, balanceCount, onHome, onArrivals, onReady, onDossiers, onHistory, onBons, onReports, onSettings }: {
  tab: Tab; incoming: number; ready: number; dossiers: number; delivered: number; bons: number; balanceCount: number;
  onHome: () => void; onArrivals: () => void; onReady: () => void; onDossiers: () => void; onHistory: () => void; onBons: () => void; onReports: () => void; onSettings: () => void;
}) {
  const Item = ({ label, count, icon, active, onClick }: { label: string; count?: number; icon: ReactNode; active: boolean; onClick: () => void }) => <button type="button" onClick={onClick} className={cn("flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition", active ? "bg-[#e7ecf5] font-semibold text-[#0b2a5b]" : "text-slate-600 hover:bg-slate-50")}><span className={active ? "text-[#0b2a5b]" : "text-slate-400"}>{icon}</span><span className="min-w-0 flex-1">{label}</span>{typeof count === "number" && <span className="text-xs tabular-nums text-slate-400">{count}</span>}</button>;
  return <aside className="sticky top-[4.5rem] hidden h-fit rounded-2xl bg-white p-2 ring-1 ring-slate-200/70 md:block">
    <div className="space-y-0.5">
      <Item label="Accueil" icon={<Home size={18} />} active={tab === "home"} onClick={onHome} />
      <Item label="À remettre" count={ready} icon={<ClipboardCheck size={18} />} active={tab === "ready"} onClick={onReady} />
      <Item label="Colis à venir" count={incoming} icon={<Truck size={18} />} active={tab === "arrivals"} onClick={onArrivals} />
      <Item label="Dossiers clients" count={dossiers} icon={<Users size={18} />} active={tab === "dossiers"} onClick={onDossiers} />
      <Item label="Rapport" count={balanceCount} icon={<Banknote size={18} />} active={tab === "reports"} onClick={onReports} />
      <Item label="Colis remis" count={delivered} icon={<CheckCircle2 size={18} />} active={tab === "history"} onClick={onHistory} />
    </div>
    <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-2"><Item label="Bons de remise" count={bons} icon={<FileText size={18} />} active={tab === "bons"} onClick={onBons} /><Item label="Paramètres" icon={<Settings size={18} />} active={tab === "settings"} onClick={onSettings} /></div>
  </aside>;
}

function MobileNavigation({ tab, moreOpen, onHome, onArrivals, onReports, onReady, onToggleMore, onDossiers, onHistory, onBons, onSettings }: {
  tab: Tab; moreOpen: boolean;
  onHome: () => void; onArrivals: () => void; onReports: () => void; onReady: () => void; onToggleMore: () => void; onDossiers: () => void; onHistory: () => void; onBons: () => void; onSettings: () => void;
}) {
  const NavButton = ({ label, icon, active, onClick }: { label: string; icon: ReactNode; active: boolean; onClick: () => void }) => <button type="button" onClick={onClick} aria-current={active ? "page" : undefined} className={cn("flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition", active ? "text-[#0b2a5b]" : "text-slate-400")}><span className={cn("grid h-7 w-12 place-items-center rounded-full transition", active && "bg-[#e7ecf5]")}>{icon}</span><span>{label}</span></button>;
  const MoreItem = ({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) => <button type="button" onClick={onClick} className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"><span className="text-slate-400">{icon}</span>{label}</button>;
  return <>
    {moreOpen && <button type="button" aria-label="Fermer le menu" onClick={onToggleMore} className="fixed inset-0 z-30 bg-slate-900/25 md:hidden" />}
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Navigation de l’espace de remise">
      {moreOpen && <div className="absolute inset-x-3 bottom-[calc(100%+0.5rem)] rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-slate-200">
        <MoreItem label="Dossiers clients" icon={<Users size={18} />} onClick={onDossiers} />
        <MoreItem label="Colis remis" icon={<CheckCircle2 size={18} />} onClick={onHistory} />
        <MoreItem label="Bons de remise" icon={<FileText size={18} />} onClick={onBons} />
        <MoreItem label="Paramètres" icon={<Settings size={18} />} onClick={onSettings} />
      </div>}
      <div className="mx-auto flex max-w-xl px-1">
        <NavButton label="Accueil" icon={<Home size={18} />} active={tab === "home"} onClick={onHome} />
        <NavButton label="À remettre" icon={<ClipboardCheck size={18} />} active={tab === "ready"} onClick={onReady} />
        <NavButton label="À venir" icon={<Truck size={18} />} active={tab === "arrivals"} onClick={onArrivals} />
        <NavButton label="Rapport" icon={<Banknote size={18} />} active={tab === "reports"} onClick={onReports} />
        <NavButton label="Plus" icon={<MoreHorizontal size={18} />} active={moreOpen || tab === "dossiers" || tab === "history" || tab === "bons" || tab === "settings"} onClick={onToggleMore} />
      </div>
    </nav>
  </>;
}

/** Réglage permanent : la bannière d'accueil peut être fermée, pas ce bouton. */
function AgentSettingsView({ agentName, pushPermission, pushBusy, onActivate }: {
  agentName: string; pushPermission: PushPermission; pushBusy: boolean; onActivate: () => void;
}) {
  const state = {
    checking: { title: "Vérification des notifications…", description: "Nous vérifions les réglages de cet appareil.", tone: "bg-slate-50 text-slate-700" },
    granted: { title: "Notifications activées", description: "Cet appareil recevra les nouveaux bons de remise et les mises à jour de paiement de votre agence.", tone: "bg-emerald-50 text-emerald-800" },
    default: { title: "Notifications non activées", description: "Activez les notifications pour être averti dès qu’un bon de remise ou un paiement vous concerne.", tone: "bg-amber-50 text-amber-900" },
    denied: { title: "Notifications refusées", description: "Autorisez les notifications dans les réglages du navigateur ou de l’application, puis revenez ici pour les activer.", tone: "bg-red-50 text-red-800" },
    unsupported: { title: "Notifications indisponibles sur cet appareil", description: "Utilisez un navigateur récent ou l’application STANDA pour les activer.", tone: "bg-slate-50 text-slate-700" }
  }[pushPermission];

  return <div className="mx-auto max-w-2xl space-y-4">
    <Card>
      <div className="flex items-center gap-3 px-4 py-4">
        <Avatar name={agentName} code="" />
        <div className="min-w-0"><p className="truncate text-[15px] font-semibold text-slate-900">{agentName}</p><p className="text-xs text-slate-500">Agent du point de retrait</p></div>
      </div>
    </Card>
    <Card>
      <CardHeader title="Notifications de l’agence" subtitle="Bons de remise et paiements clients." />
      <div className="px-4 pb-4">
        <div className={cn("flex gap-3 rounded-xl p-3", state.tone)}><span className="mt-0.5 shrink-0">{pushPermission === "granted" ? <CheckCircle2 size={18} /> : <Bell size={18} />}</span><div><p className="text-sm font-semibold">{state.title}</p><p className="mt-0.5 text-[13px] leading-5 opacity-90">{state.description}</p></div></div>
        {pushPermission === "default" && <button type="button" onClick={onActivate} disabled={pushBusy} className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-60" style={{ background: NAVY }}><BellRing size={18} />{pushBusy ? "Activation…" : "Activer les notifications"}</button>}
        {pushPermission === "denied" && <p className="mt-3 text-xs leading-5 text-slate-500">Sur iPhone, ouvrez Réglages, puis les réglages du site ou de l’application STANDA. Sur Android ou ordinateur, ouvrez les autorisations de notifications du navigateur.</p>}
      </div>
    </Card>
    <Card className="p-1.5"><PwaInstallButton variant="row" appName="STANDA Retrait" /></Card>
    <Card className="px-4 py-3.5"><p className="text-sm font-semibold text-slate-900">Ce que vous recevrez</p><p className="mt-1 text-[13px] leading-6 text-slate-600">Une alerte quand un bon de remise est créé pour votre zone, et quand un paiement est enregistré pour un client de votre agence. Les alertes restent liées seulement à ce compte et à cet appareil.</p></Card>
  </div>;
}

/** Accueil : la caisse comme un solde de compte, les raccourcis, la recherche et les derniers paiements. */
function HomeDashboard({
  zoneName, cash, balanceCount, counts, payments, onGo, onOpenReceipt,
  search, onSearchChange, onOpenDossier, bons, selectedBonId, onSelectBon, bonBusy, bonConfirmedId, onConfirmBon
}: {
  zoneName: string; cash: { usd: number; htg: number }; balanceCount: number;
  counts: { ready: number; incoming: number; dossiers: number; bons: number };
  payments: AgentPayment[]; onGo: (tab: Tab) => void; onOpenReceipt: (paymentId: string) => void;
  search: string; onSearchChange: (value: string) => void; onOpenDossier: () => void;
  bons: ZoneBon[]; selectedBonId: string | null; onSelectBon: (id: string | null) => void;
  bonBusy: boolean; bonConfirmedId: string | null; onConfirmBon: (id: string) => void;
}) {
  const shortcuts: Array<[Tab, string, ReactNode, number]> = [
    ["ready", "À remettre", <ClipboardCheck key="r" size={20} />, counts.ready],
    ["arrivals", "À venir", <Truck key="a" size={20} />, counts.incoming],
    ["dossiers", "Dossiers", <Users key="d" size={20} />, counts.dossiers],
    ["bons", "Bons", <FileText key="b" size={20} />, counts.bons]
  ];
  const recent = payments.slice(0, 5);
  return <div className="space-y-4">
    <section className="rounded-3xl p-5 text-white" style={{ background: NAVY }}>
      <div className="flex items-center justify-between gap-3"><p className="text-[13px] text-white/70">Caisse à remettre</p><button type="button" onClick={() => onGo("reports")} className="inline-flex items-center gap-0.5 text-[12px] font-medium text-white/85 hover:text-white">Rapport<ChevronRight size={14} /></button></div>
      <p className="mt-1 text-[34px] font-semibold leading-tight tracking-tight tabular-nums">{fmtUsd(cash.usd)}</p>
      <p className="text-[15px] text-white/80 tabular-nums">{fmtHtg(cash.htg)}</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/15 pt-3 text-[12px] text-white/65"><span className="truncate">{zoneName}</span><span className="shrink-0">{balanceCount} client{balanceCount > 1 ? "s" : ""} avec solde</span></div>
    </section>

    <div className="grid grid-cols-4 gap-1">
      {shortcuts.map(([id, label, icon, count]) => <button key={id} type="button" onClick={() => onGo(id)} className="flex flex-col items-center gap-1.5 rounded-2xl py-2 transition hover:bg-white">
        <span className="relative grid h-12 w-12 place-items-center rounded-full bg-white text-[#0b2a5b] ring-1 ring-slate-200">{icon}{count > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#e85e19] px-1 text-[10px] font-semibold text-white tabular-nums">{count > 99 ? "99+" : count}</span>}</span>
        <span className="text-[12px] font-medium text-slate-700">{label}</span>
      </button>)}
    </div>

    <PendingBonsNotification bons={bons} selectedId={selectedBonId} onSelect={onSelectBon} busy={bonBusy} confirmedId={bonConfirmedId} onConfirm={onConfirmBon} />

    <Card className="px-4 py-3.5">
      <p className="text-[15px] font-semibold text-slate-900">Ouvrir un dossier client</p>
      <p className="mb-3 mt-0.5 text-xs text-slate-500">Code client (ex. MC-3817) ou les 6 derniers chiffres du suivi.</p>
      <form onSubmit={(event) => { event.preventDefault(); onOpenDossier(); }} className="flex gap-2">
        <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xl bg-slate-50 px-3 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-[#0b2a5b]"><Search size={18} className="shrink-0 text-slate-400" /><input value={search} onChange={(event) => onSearchChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:font-normal placeholder:text-slate-400" placeholder="MC-3817 ou 481223" aria-label="Code client ou numéro de suivi" autoCapitalize="characters" /></label>
        <button type="submit" disabled={!search.trim()} className="h-12 shrink-0 rounded-xl bg-[#e85e19] px-4 text-sm font-semibold text-white transition hover:bg-[#d4530f] disabled:cursor-not-allowed disabled:opacity-40">Ouvrir</button>
      </form>
    </Card>

    <Card>
      <CardHeader title="Derniers paiements" right={payments.length > 0 ? <button type="button" onClick={() => onGo("reports")} className="text-[13px] font-medium text-[#0b2a5b]">Tout voir</button> : undefined} />
      {recent.length ? <div className="divide-y divide-slate-100">{recent.map((payment) => <button key={payment.id} type="button" onClick={() => onOpenReceipt(payment.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50">
        <Avatar name={payment.customer_name} code={payment.customer_code} tone="emerald" />
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{payment.customer_name || payment.customer_code}</span><span className="block truncate text-xs text-slate-500">{payment.payment_method || "Paiement"} · {dateText(payment.created_at)}</span></span>
        <span className="shrink-0 text-sm font-semibold text-emerald-700 tabular-nums">+{payment.currency === "HTG" ? fmtHtg(payment.amount) : fmtUsd(payment.amount)}</span>
      </button>)}</div> : <p className="px-4 pb-4 text-sm text-slate-500">Aucun paiement depuis la dernière clôture de caisse.</p>}
    </Card>
  </div>;
}

/**
 * Notifikasyon Bon de remise sou Akèy — agent la wè imedyatman ki Bon k ap tann
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
  return <Card className="ring-orange-200">
    <div className="flex items-center gap-3 px-4 pb-2 pt-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-50 text-[#e85e19]"><Truck size={19} /></span>
      <div className="min-w-0"><p className="text-[15px] font-semibold text-slate-900">{pending.length} bon{pending.length > 1 ? "s" : ""} de remise en route</p><p className="text-xs text-slate-500">Touchez le bon reçu, puis confirmez.</p></div>
    </div>
    <div className="divide-y divide-slate-100">
      {pending.map((bon) => {
        const selected = selectedId === bon.id;
        const justConfirmed = confirmedId === bon.id;
        return <button key={bon.id} type="button" onClick={() => onSelect(selected ? null : bon.id)} disabled={busy} aria-pressed={selected}
          className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition", selected ? "bg-orange-50/70" : "hover:bg-slate-50")}>
          <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", selected ? "border-[#e85e19] bg-[#e85e19] text-white" : "border-slate-300")}>{selected && <Check size={12} strokeWidth={3} />}</span>
          <span className="min-w-0 flex-1"><span className="block font-mono text-sm font-semibold text-slate-900">{bon.bon_number}</span><span className="block text-xs text-slate-500">{bon.package_count} colis · {dateText(bon.created_at)}</span></span>
          {justConfirmed && <CheckCircle2 className="shrink-0 text-emerald-500" size={20} />}
        </button>;
      })}
    </div>
    {selectedId && <div className="px-4 pb-4 pt-2"><button type="button" onClick={() => onConfirm(selectedId)} disabled={busy}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#e85e19] px-5 text-sm font-semibold text-white transition hover:bg-[#d4530f] disabled:cursor-not-allowed disabled:opacity-60">
      {busy ? <RefreshCw size={18} className="animate-spin" /> : <PackageCheck size={18} />}
      {busy ? "Mise à jour du système…" : "Rendre ces colis disponibles"}
    </button></div>}
  </Card>;
}

/**
 * Barre fixe : le bouton « Confirmer la remise » reste toujours visible à
 * l'écran (au-dessus de la navigation), jamais enfoui tout en bas de la liste.
 */
function RemiseConfirmBar({ customerCode, count, busy, onConfirm, onClear }: { customerCode: string; count: number; busy: boolean; onConfirm: () => void; onClear: () => void }) {
  return <div role="region" aria-label="Confirmer la remise" className="fixed inset-x-2 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-xl md:bottom-5">
    <div className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-[0_10px_30px_rgba(15,23,42,0.18)] ring-1 ring-slate-200">
      <button type="button" onClick={onClear} disabled={busy} aria-label="Annuler la sélection" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X size={18} /></button>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{customerCode || "Client"}</p><p className="text-xs text-emerald-700">{count} colis sélectionné{count > 1 ? "s" : ""}</p></div>
      <button type="button" onClick={onConfirm} disabled={busy} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-70">{busy ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}{busy ? "Confirmation…" : "Confirmer la remise"}</button>
    </div>
  </div>;
}

/** Juste après un paiement : proposer la remise immédiate des colis devenus remettables, puis le ticket. */
function RemiseOffer({ offer, busy, onRelease, onLater }: { offer: { customerCode: string; packageIds: string[]; paymentText: string }; busy: boolean; onRelease: () => void; onLater: () => void }) {
  const count = offer.packageIds.length;
  return <div role="dialog" aria-modal="true" aria-labelledby="remise-offer-title" className="fixed inset-0 z-[140] flex flex-col items-center justify-center overflow-y-auto bg-white px-6 py-8 text-center">
    <div className="w-full max-w-md">
      <div className="sd-pop mx-auto grid h-24 w-24 place-items-center rounded-full bg-emerald-500">
        <svg viewBox="0 0 24 24" className="h-14 w-14" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path className="sd-check" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </div>
      <h2 id="remise-offer-title" className="mt-6 text-xl font-semibold text-slate-900">Paiement enregistré{offer.customerCode}</h2>
      <p className="mx-auto mt-2 whitespace-pre-line text-[15px] leading-relaxed text-slate-600">{offer.paymentText}</p>
      <p className="mx-auto mt-5 rounded-xl bg-orange-50 px-4 py-3 text-sm font-medium text-[#c2410c]">{count} colis {count > 1 ? "sont prêts" : "est prêt"} à être remis au client.</p>
      <button type="button" autoFocus disabled={busy} onClick={onRelease} className="mx-auto mt-6 flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-[15px] font-semibold text-white outline-none transition hover:bg-emerald-700 focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:opacity-60">{busy ? <Spinner size={18} /> : <Printer size={19} />}{busy ? "Remise en cours…" : "Remettre et voir le ticket"}</button>
      <button type="button" disabled={busy} onClick={onLater} className="mx-auto mt-3 flex h-11 w-full max-w-xs items-center justify-center rounded-xl text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">Plus tard</button>
    </div>
  </div>;
}

/** Grande coche verte animée : la remise est enregistrée. */
function RemiseSuccessOverlay({ customerCode, count }: { customerCode: string; count: number }) {
  return <div role="status" aria-live="polite" className="fixed inset-0 z-[60] grid place-items-center bg-white/90 px-6 backdrop-blur-sm">
    <div className="text-center">
      <div className="sd-pop mx-auto grid h-24 w-24 place-items-center rounded-full bg-emerald-500">
        <svg viewBox="0 0 24 24" className="h-14 w-14" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path className="sd-check" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </div>
      <p className="mt-5 text-xl font-semibold text-slate-900">Remise confirmée</p>
      <p className="mt-1 text-sm text-slate-600">{count} colis livré{count > 1 ? "s" : ""}{customerCode ? " · " + customerCode : ""}</p>
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
  onStartPayment: (customerCode: string, invoiceIds?: string[]) => void; onOpenInvoice: (invoiceId: string) => void;
}) {
  const eligible = packages.filter(canReleaseParcel);
  const allSelected = eligible.length > 0 && eligible.every((item) => selectedPackageIds.includes(item.id));
  // Une seule action de paiement par facture impayée, pas une par colis.
  const unpaidInvoices = Array.from(new Map(packages.filter((item) => item.invoice_id && item.invoice_payment_status !== "Payé").map((item) => [item.invoice_id, item.invoice_number] as const)).entries());
  return <Card>
    <CardHeader title={`À remettre · ${packages.length} colis`} subtitle="Touchez les colis remis, puis confirmez en bas de l’écran."
      right={eligible.length > 1 ? <button type="button" disabled={locked} onClick={() => onSelectAll(eligible.map((item) => item.id))} className="h-9 shrink-0 rounded-xl px-3 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:opacity-60">{allSelected ? "Aucun" : `Tout (${eligible.length})`}</button> : undefined} />
    <div className="divide-y divide-slate-100">{packages.map((item) => {
      const selectable = canReleaseParcel(item);
      const selected = selectedPackageIds.includes(item.id);
      const reason = item.customer_balance_usd > 0.01 ? "Solde client à régler" : item.invoice_payment_status !== "Payé" ? "Paiement complet requis" : "";
      return <div key={item.id} className={cn(selected && "bg-emerald-50/60")}>
        <button type="button" role="checkbox" aria-checked={selected} disabled={!selectable || locked} onClick={() => onToggleSelection(item)} className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-not-allowed">
          <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition", selected ? "border-emerald-600 bg-emerald-600 text-white" : selectable ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-100")}>{selected && <Check size={14} strokeWidth={3} />}</span>
          <span className="min-w-0 flex-1">
            <span className={cn("block break-all text-sm font-medium", selectable ? "text-slate-900" : "text-slate-500")}>{packageReference(item)}</span>
            <span className="mt-0.5 block text-xs text-slate-500">Qté {item.quantity}{item.content ? " · " + item.content : ""} · {item.invoice_number} · {item.invoice_payment_status}</span>
            {reason && <span className="mt-1 inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">{reason}</span>}
          </span>
          <StatusChip status={item.status} />
        </button>
        {(item.is_special || item.invoice_payment_details) && <div className="px-4 pb-3 pl-[3.25rem]">{item.invoice_payment_details && <p className="text-xs font-medium text-emerald-700">{item.invoice_payment_details}</p>}<SpecialPackageNotice item={item} /></div>}
      </div>;
    })}</div>
    {unpaidInvoices.length > 0 && <div className="space-y-2 border-t border-slate-100 p-4">
      <button type="button" onClick={() => onStartPayment(packages[0]?.customer_code ?? "", unpaidInvoices.map(([invoiceId]) => invoiceId))} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#e85e19] px-3 text-sm font-semibold text-white hover:bg-[#d4530f]"><Banknote size={18} />Encaisser le paiement{unpaidInvoices.length > 1 ? ` · ${unpaidInvoices.length} factures` : ""}</button>
      <div className="flex flex-wrap gap-1.5">{unpaidInvoices.map(([invoiceId, invoiceNumber]) => <button key={invoiceId} type="button" onClick={() => onOpenInvoice(invoiceId)} className="h-9 rounded-lg px-2.5 text-xs font-medium text-[#0b2a5b] ring-1 ring-slate-200 hover:bg-slate-50">Voir {invoiceNumber}</button>)}</div>
    </div>}
  </Card>;
}

/** Onglet « À remettre » : colis prêts, un client ouvert à la fois. */
function ReadyView({ groups, expanded, onExpand, selectedPackageIds, confirmedParcelIds, releasing, onToggleSelection, onSelectCustomerPackages, onStartPayment, onOpenInvoice, renderPayment, renderInvoice }: {
  groups: PackageGroup[]; expanded: string | null; onExpand: (id: string | null) => void;
  selectedPackageIds: string[]; confirmedParcelIds: string[]; releasing: boolean; onToggleSelection: (item: ZonePackage) => void;
  onSelectCustomerPackages: (customerCode: string, parcelIds: string[]) => void;
  onStartPayment: (customerCode: string, invoiceIds?: string[]) => void; onOpenInvoice: (invoiceId: string) => void;
  renderPayment: (customerCode: string) => ReactNode; renderInvoice: (customerCode: string) => ReactNode;
}) {
  if (!groups.length) return <Empty text="Aucun colis facturé n’est disponible à remettre." />;
  const openGroup = groups.find((group) => group.customerCode === expanded);
  if (openGroup) {
    const hasBalance = openGroup.balanceUsd > 0.01;
    return <div id={"package-group-" + openGroup.customerCode} className="scroll-mt-20 space-y-3">
      <Card><CustomerRow code={openGroup.customerCode} name={openGroup.customerName} central={openGroup.isCentralAccount} tone="orange" open onOpen={() => undefined} meta={`${openGroup.packages.length} colis à remettre · ${quantityTotal(openGroup.packages)} article${quantityTotal(openGroup.packages) > 1 ? "s" : ""}`} /></Card>
      {hasBalance && <BalanceNotice balanceUsd={openGroup.balanceUsd} balanceHtg={openGroup.balanceHtg} invoiceNumber={openGroup.balanceInvoiceNumber} onPay={openGroup.balanceInvoiceId ? () => onStartPayment(openGroup.customerCode) : undefined} />}
      {renderPayment(openGroup.customerCode)}
      <ReadyChecklist packages={openGroup.packages} selectedPackageIds={selectedPackageIds} locked={releasing || confirmedParcelIds.length > 0} onToggleSelection={onToggleSelection} onSelectAll={(ids) => onSelectCustomerPackages(openGroup.customerCode, ids)} onStartPayment={onStartPayment} onOpenInvoice={onOpenInvoice} />
      {renderInvoice(openGroup.customerCode)}
    </div>;
  }
  return <Card>
    <CardHeader title="Clients à servir" right={<CountPill value={groups.length} tone="orange" />} />
    <div className="divide-y divide-slate-100">{groups.map((group) => <div id={"package-group-" + group.customerCode} key={group.customerCode} className="scroll-mt-20">
      <CustomerRow code={group.customerCode} name={group.customerName} central={group.isCentralAccount} tone="orange" open={false} onOpen={() => onExpand(group.customerCode)}
        meta={<>{group.packages.length} colis à remettre{group.balanceUsd > 0.01 && <span className="text-amber-700"> · solde {fmtUsd(group.balanceUsd)}</span>}</>} />
    </div>)}</div>
  </Card>;
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
  const openGroup = groups.find((group) => group.customerCode === expanded);
  if (openGroup) {
    const haiti = openGroup.packages.filter((item) => arrivalSectionOf(item) === "haiti");
    const miami = openGroup.packages.filter((item) => arrivalSectionOf(item) === "miami");
    const options: Array<[ArrivalSection, string, string, ZonePackage[], "violet" | "sky"]> = [
      ["haiti", "Arrivés en Haïti", "Pas encore disponibles au point de retrait", haiti, "violet"],
      ["miami", "À Miami · en cours", "Encore à Miami ou en transit", miami, "sky"]
    ];
    return <div id={"package-group-" + openGroup.customerCode} className="scroll-mt-20 space-y-3">
      <Card><CustomerRow code={openGroup.customerCode} name={openGroup.customerName} central={openGroup.isCentralAccount} tone="sky" open onOpen={() => undefined} meta={`${openGroup.packages.length} colis en route`} /></Card>
      {!section && <Card><div className="divide-y divide-slate-100">{options.map(([id, label, hint, items, tone]) => <button key={id} type="button" onClick={() => onSelectSection(id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50">
        <span className={cn("h-9 w-1.5 shrink-0 rounded-full", tone === "violet" ? "bg-violet-500" : "bg-sky-500")} />
        <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-slate-900">{label}</span><span className="block text-xs text-slate-500">{hint}</span></span>
        <span className="text-lg font-semibold tabular-nums text-slate-900">{items.length}</span><ChevronRight size={18} className="text-slate-300" />
      </button>)}</div></Card>}
      {section && options.filter(([id]) => id === section).map(([id, label, hint, items]) => <Card key={id}>
        <CardHeader title={label} subtitle={hint} right={<CountPill value={items.length} />} />
        {items.length ? <div className="divide-y divide-slate-100">{items.map((item) => <ParcelRow key={item.id} item={item} />)}</div> : <p className="px-4 pb-4 text-sm text-slate-500">Aucun colis à cette étape.</p>}
      </Card>)}
    </div>;
  }
  return <Card>
    <CardHeader title="Clients avec colis en route" right={<CountPill value={groups.length} />} />
    <div className="divide-y divide-slate-100">{groups.map((group) => <div id={"package-group-" + group.customerCode} key={group.customerCode} className="scroll-mt-20">
      <CustomerRow code={group.customerCode} name={group.customerName} central={group.isCentralAccount} tone="sky" open={false} onOpen={() => onToggleCustomer(group.customerCode)} meta={`${group.packages.length} colis en route`} />
    </div>)}</div>
  </Card>;
}

/**
 * Colis remis : une ligne par CLIENT, sans liste de colis. Toucher la ligne
 * affiche ses tickets de remise — chaque ticket porte le numéro de la
 * facture des colis remis, comme le ticket imprimé.
 */
function RemiseHistoryView({ packages, onOpenTicket, openCustomer, onOpenCustomer }: { packages: ZonePackage[]; onOpenTicket: (packageId: string) => void; openCustomer: string | null; onOpenCustomer: (code: string) => void }) {
  const [visible, setVisible] = useState(40);
  const clients = useMemo(() => {
    const byClient = new Map<string, { customerCode: string; customerName: string; lastAt: string; tickets: Map<string, { key: string; deliveredAt: string; packages: ZonePackage[] }> }>();
    for (const item of packages) {
      const client = byClient.get(item.customer_code) ?? { customerCode: item.customer_code, customerName: item.customer_name, lastAt: "", tickets: new Map() };
      if (!client.customerName && item.customer_name) client.customerName = item.customer_name;
      if (dateTimestamp(item.delivered_at) > dateTimestamp(client.lastAt)) client.lastAt = item.delivered_at;
      // Même regroupement que le ticket côté serveur : un ticket = une remise (même date de remise).
      const key = item.delivered_at || "sans-date|" + (item.invoice_id || item.id);
      const ticket = client.tickets.get(key) ?? { key, deliveredAt: item.delivered_at, packages: [] };
      ticket.packages.push(item);
      client.tickets.set(key, ticket);
      byClient.set(item.customer_code, client);
    }
    return Array.from(byClient.values())
      .map((client) => ({ ...client, tickets: Array.from(client.tickets.values()).sort((left, right) => dateTimestamp(right.deliveredAt) - dateTimestamp(left.deliveredAt)) }))
      .sort((left, right) => dateTimestamp(right.lastAt) - dateTimestamp(left.lastAt));
  }, [packages]);
  if (!clients.length) return <Empty text="Aucun colis remis ne correspond à la recherche." />;
  const opened = openCustomer ? clients.find((client) => client.customerCode === openCustomer) : undefined;
  if (opened) {
    return <div className="space-y-3">
      <Card><CustomerRow code={opened.customerCode} name={opened.customerName} tone="emerald" open onOpen={() => undefined} meta={opened.lastAt ? "Dernière remise le " + dateTimeText(opened.lastAt) : "Date de remise non archivée"} /></Card>
      <Card>
        <CardHeader title="Tickets de remise" right={<CountPill value={opened.tickets.length} tone="emerald" />} />
        <div className="divide-y divide-slate-100">{opened.tickets.map((ticket) => {
          const numbers = Array.from(new Set(ticket.packages.map((item) => item.invoice_number).filter(Boolean)));
          return <button key={ticket.key} type="button" onClick={() => onOpenTicket(ticket.packages[0].id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600"><Printer size={17} /></span>
            <span className="min-w-0 flex-1"><span className="block break-all text-sm font-medium text-slate-900">Ticket {numbers.length ? numbers.join(" / ") : "de remise"}</span><span className="block text-xs text-slate-500">{ticket.deliveredAt ? dateTimeText(ticket.deliveredAt) : "Date non archivée"} · {ticket.packages.length} colis</span></span>
            <ChevronRight size={18} className="shrink-0 text-slate-300" />
          </button>;
        })}</div>
      </Card>
    </div>;
  }
  return <Card>
    <CardHeader title="Colis remis" right={<CountPill value={`${clients.length} client${clients.length > 1 ? "s" : ""}`} tone="emerald" />} />
    <div className="divide-y divide-slate-100">{clients.slice(0, visible).map((client) => <CustomerRow key={client.customerCode} code={client.customerCode} name={client.customerName} tone="emerald" open={false} onOpen={() => onOpenCustomer(client.customerCode)}
      meta={<>{client.lastAt ? dateTimeText(client.lastAt) : "Date non archivée"} · {client.tickets.length} ticket{client.tickets.length > 1 ? "s" : ""}</>} />)}</div>
    {clients.length > visible && <div className="border-t border-slate-100 p-3"><button type="button" onClick={() => setVisible((count) => count + 40)} className="h-11 w-full rounded-xl text-sm font-medium text-[#0b2a5b] hover:bg-slate-50">Afficher plus de clients</button></div>}
  </Card>;
}

/**
 * Dossier client : tout ce qui se remet est dans UNE liste à cocher ; le reste
 * (arrivés en Haïti, en cours) n'est qu'informatif. Les clients sans colis en
 * route ni disponible sont retirés par le parent, et les colis remis ne
 * s'affichent plus ici : ils vont à l'historique.
 */
function ClientDossiersView({ dossiers, focusedPackageId, expanded, onExpand, selectedPackageIds, confirmedParcelIds, releasing, onToggleSelection, onSelectCustomerPackages, onStartPayment, onOpenInvoice, renderPayment, renderInvoice }: {
  dossiers: ClientDossier[]; focusedPackageId: string | null; expanded: string | null; onExpand: (value: string | null) => void;
  selectedPackageIds: string[]; confirmedParcelIds: string[]; releasing: boolean; onToggleSelection: (item: ZonePackage) => void;
  onSelectCustomerPackages: (customerCode: string, parcelIds: string[]) => void;
  onStartPayment: (customerCode: string, invoiceIds?: string[]) => void; onOpenInvoice: (invoiceId: string) => void;
  renderPayment: (customerCode: string) => ReactNode; renderInvoice: (customerCode: string) => ReactNode;
}) {
  if (!dossiers.length) return <Empty text="Aucun client n’a de colis en route ou disponible." />;
  const opened = dossiers.find((dossier) => dossier.customerCode === expanded);
  if (opened) {
    const scopedPackages = focusedPackageId ? opened.packages.filter((item) => item.id === focusedPackageId) : opened.packages;
    const scopedDossier = focusedPackageId ? { ...opened, packages: scopedPackages } : opened;
    const counts = dossierCounts(scopedDossier);
    const available = sortPackagesAvailableFirst(counts.active.filter(isReadyForPickup));
    const waiting = counts.active.filter((item) => !isReadyForPickup(item));
    const haiti = sortPackagesAvailableFirst(waiting.filter((item) => arrivalSectionOf(item) === "haiti"));
    const miami = sortPackagesAvailableFirst(waiting.filter((item) => arrivalSectionOf(item) === "miami"));
    const balanceSource = opened.invoices[0] ?? opened.packages[0];
    const balanceUsd = balanceSource?.customer_balance_usd ?? 0;
    const balanceHtg = balanceSource?.customer_balance_htg ?? 0;
    const balanceInvoice = opened.invoices.find((invoice) => invoice.payment_status !== "Payé");
    // Une facture entièrement livrée et payée est dans l'historique, pas ici.
    const openInvoices = (focusedPackageId ? opened.invoices.filter((invoice) => scopedPackages.some((item) => item.invoice_id === invoice.id)) : opened.invoices)
      .filter((invoice) => invoice.delivery_status !== "Livrée" || invoice.payment_status !== "Payé");
    return <div id={"dossier-" + opened.customerCode} className="scroll-mt-20 space-y-3">
      <Card>
        <CustomerRow code={opened.customerCode} name={opened.customerName} open onOpen={() => undefined} meta="Dossier client" />
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 text-center">
          <div className="py-2.5"><p className="text-lg font-semibold tabular-nums text-[#c2410c]">{available.length}</p><p className="text-[11px] text-slate-500">À remettre</p></div>
          <div className="py-2.5"><p className="text-lg font-semibold tabular-nums text-violet-700">{haiti.length}</p><p className="text-[11px] text-slate-500">En Haïti</p></div>
          <div className="py-2.5"><p className="text-lg font-semibold tabular-nums text-sky-700">{miami.length}</p><p className="text-[11px] text-slate-500">En cours</p></div>
        </div>
      </Card>
      {focusedPackageId && <p className="rounded-xl bg-sky-50 px-3 py-2 text-[13px] text-sky-900">Recherche précise : seul le colis correspondant aux 6 derniers chiffres est affiché.</p>}
      {balanceUsd > 0.01 && <BalanceNotice balanceUsd={balanceUsd} balanceHtg={balanceHtg} invoiceNumber={balanceInvoice?.invoice_number ?? ""} onPay={balanceInvoice ? () => onStartPayment(opened.customerCode) : undefined} />}
      {renderPayment(opened.customerCode)}
      {available.length > 0 && <ReadyChecklist packages={available} selectedPackageIds={selectedPackageIds} locked={releasing || confirmedParcelIds.length > 0} onToggleSelection={onToggleSelection} onSelectAll={(ids) => onSelectCustomerPackages(opened.customerCode, ids)} onStartPayment={onStartPayment} onOpenInvoice={onOpenInvoice} />}
      {haiti.length > 0 && <DossierSection title="Arrivés en Haïti" subtitle="Pas encore disponibles au point de retrait." packages={haiti} tone="violet" />}
      {miami.length > 0 && <DossierSection title="En cours" subtitle="Encore à Miami ou en transit." packages={miami} tone="sky" />}
      {openInvoices.length > 0 && <DossierInvoices invoices={openInvoices} onOpenInvoice={onOpenInvoice} />}
      {renderInvoice(opened.customerCode)}
    </div>;
  }
  return <Card>
    <CardHeader title="Dossiers clients" right={<CountPill value={dossiers.length} />} />
    <div className="divide-y divide-slate-100">{dossiers.map((dossier) => {
      const counts = dossierCounts(dossier);
      const available = counts.active.filter(isReadyForPickup).length;
      const waiting = counts.active.filter((item) => !isReadyForPickup(item));
      const haiti = waiting.filter((item) => arrivalSectionOf(item) === "haiti").length;
      const miami = waiting.length - haiti;
      const balanceSource = dossier.invoices[0] ?? dossier.packages[0];
      const owes = (balanceSource?.customer_balance_usd ?? 0) > 0.01;
      const parts = [available ? `${available} à remettre` : "", haiti ? `${haiti} en Haïti` : "", miami ? `${miami} en cours` : ""].filter(Boolean).join(" · ");
      return <div id={"dossier-" + dossier.customerCode} key={dossier.customerCode} className="scroll-mt-20">
        <CustomerRow code={dossier.customerCode} name={dossier.customerName} tone={available ? "orange" : "navy"} open={false} onOpen={() => onExpand(dossier.customerCode)}
          meta={<>{parts || "Aucun colis actif"}{owes && <span className="text-amber-700"> · solde</span>}</>} />
      </div>;
    })}</div>
  </Card>;
}

function BalanceNotice({ balanceUsd, balanceHtg, invoiceNumber, onPay }: { balanceUsd: number; balanceHtg: number; invoiceNumber: string; onPay?: () => void }) {
  return <Card className="ring-amber-200">
    <div className="px-4 py-3.5">
      <p className="text-[13px] font-medium text-amber-800">Solde client à régler</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{fmtUsd(balanceUsd)}</p>
      <p className="text-sm tabular-nums text-slate-500">{fmtHtg(balanceHtg)}{invoiceNumber ? " · " + invoiceNumber : ""}</p>
      <p className="mt-2 text-xs text-slate-500">Le solde précédent doit être réglé avant toute nouvelle remise.</p>
      {onPay && <button type="button" onClick={onPay} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#e85e19] px-3 text-sm font-semibold text-white hover:bg-[#d4530f]"><Banknote size={18} />Encaisser le solde</button>}
    </div>
  </Card>;
}

function DossierSection({ title, subtitle, packages, tone = "blue", renderPackage }: { title: string; subtitle: string; packages: ZonePackage[]; tone?: "blue" | "orange" | "emerald" | "violet" | "sky"; renderPackage?: (item: ZonePackage) => ReactNode }) {
  const pill = tone === "orange" ? "orange" : tone === "emerald" ? "emerald" : "slate";
  return <Card>
    <CardHeader title={title} subtitle={subtitle} right={<CountPill value={packages.length} tone={pill} />} />
    {packages.length ? <div className="divide-y divide-slate-100">{packages.map((item) => renderPackage ? <div key={item.id}>{renderPackage(item)}</div> : <ParcelRow key={item.id} item={item} />)}</div> : <p className="px-4 pb-4 text-sm text-slate-500">Aucun colis dans cette section.</p>}
  </Card>;
}

function SpecialPackageNotice({ item, compact = false }: { item: ZonePackage; compact?: boolean }) {
  if (!item.is_special) return null;
  return <div className={cn("rounded-lg bg-amber-50 text-amber-900", compact ? "mt-1 inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium" : "mt-2 p-2.5 text-xs")}>
    <span className="inline-flex items-center gap-1 font-semibold"><AlertTriangle size={compact ? 13 : 15} />Colis spécial</span>
    {!compact && item.special_reason && <p className="mt-1 leading-relaxed text-amber-800"><span className="font-semibold">Note :</span> {item.special_reason}</p>}
  </div>;
}

function ParcelRow({ item }: { item: ZonePackage }) {
  return <div className="flex items-center gap-3 px-4 py-3">
    <span className={cn("h-8 w-1 shrink-0 rounded-full", statusTone(item.status).bar)} />
    <div className="min-w-0 flex-1"><p className="break-all text-sm font-medium text-slate-900">{packageReference(item)}</p><p className="mt-0.5 text-xs text-slate-500">Qté {item.quantity}{item.content ? " · " + item.content : ""}</p><SpecialPackageNotice item={item} compact /></div>
    <StatusChip status={item.status} />
  </div>;
}

function DossierInvoices({ invoices, onOpenInvoice }: { invoices: ZoneInvoice[]; onOpenInvoice: (invoiceId: string) => void }) {
  return <Card>
    <CardHeader title="Factures du client" subtitle="Touchez une facture pour voir son total et ses colis." right={<CountPill value={invoices.length} />} />
    {invoices.length ? <div className="divide-y divide-slate-100">{invoices.map((invoice) => <button key={invoice.id} type="button" onClick={() => onOpenInvoice(invoice.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600"><FileText size={17} /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-900">{invoice.invoice_number}</span><span className="block text-xs text-slate-500">{invoice.package_count} colis · {dateText(invoice.created_at)}</span><span className="mt-1 flex flex-wrap gap-1"><PaymentChip status={invoice.payment_status} /><DeliveryChip status={invoice.delivery_status} /></span></span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{fmtUsd(invoice.grand_total_usd)}</span>
    </button>)}</div> : <p className="px-4 pb-4 text-sm text-slate-500">Aucune facture finalisée pour ce client.</p>}
  </Card>;
}

function InvoiceSummary({ invoice, packages }: { invoice: ZoneInvoice; packages: ZonePackage[] }) {
  const Line = ({ label, value, tone }: { label: string; value: string; tone?: string }) => <div className="flex items-baseline justify-between gap-3 px-4 py-2.5"><span className="text-sm text-slate-500">{label}</span><span className={cn("text-right text-sm font-semibold tabular-nums", tone ?? "text-slate-900")}>{value}</span></div>;
  return <>
    <div className="divide-y divide-slate-100 border-t border-slate-100">
      <Line label="Total de la facture" value={fmtUsd(invoice.grand_total_usd)} />
      {invoice.deposit_usd > 0 && <Line label="Acompte" value={fmtUsd(invoice.deposit_usd)} />}
      <Line label="Montant reçu" value={`${fmtUsd(invoice.payment_paid_usd)} · ${fmtHtg(invoice.payment_paid_htg)}`} tone="text-emerald-700" />
      <Line label="Solde à payer" value={`${fmtUsd(invoice.amount_due_usd)} · ${fmtHtg(invoice.amount_due_htg)}`} tone="text-[#c2410c]" />
    </div>
    <div className="border-t border-slate-100">
      <p className="px-4 pb-1 pt-3 text-xs font-medium text-slate-500">Colis dans cette facture · {packages.length}</p>
      {packages.length ? <div className="divide-y divide-slate-100">{packages.map((item) => <ParcelRow key={item.id} item={item} />)}</div> : <p className="px-4 pb-4 text-sm text-slate-500">Aucun colis associé à cette facture.</p>}
    </div>
  </>;
}

function InvoiceDetails({ invoice, packages, onClose, onPay }: { invoice: ZoneInvoice | null; packages: ZonePackage[]; onClose: () => void; onPay?: () => void }) {
  if (!invoice) return null;
  return <Card>
    <div className="flex items-start justify-between gap-3 px-4 py-4">
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{invoice.is_central_account ? "Compte central STANDA" : `${invoice.customer_code}${invoice.customer_name ? " · " + invoice.customer_name : ""}`}</p>
        <h3 className="mt-0.5 text-lg font-semibold text-slate-900">{invoice.invoice_number}</h3>
        <div className="mt-1.5 flex flex-wrap gap-1.5"><PaymentChip status={invoice.payment_status} /><DeliveryChip status={invoice.delivery_status} /></div>
        {invoice.payment_details && <p className="mt-1.5 text-xs font-medium text-emerald-700">{invoice.payment_details}</p>}
      </div>
      <button type="button" onClick={onClose} aria-label="Fermer le détail de la facture" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><X size={18} /></button>
    </div>
    <InvoiceSummary invoice={invoice} packages={packages} />
    {onPay && <div className="border-t border-slate-100 p-4"><button type="button" onClick={onPay} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#e85e19] px-3 text-sm font-semibold text-white hover:bg-[#d4530f]"><Banknote size={18} />Encaisser le paiement de cette facture</button></div>}
  </Card>;
}

/** Détail de la caisse par moyen de paiement : Espèces, MonCash, NatCash, Zelle (+ autres s'il y en a). */
const METHOD_ORDER = ["Espèces", "MonCash", "NatCash", "Zelle"];
function methodLabel(method: string) {
  const value = (method || "").trim();
  if (/^(esp[eè]ces?|cash)$/i.test(value)) return "Espèces";
  if (/^mon\s*cash$/i.test(value)) return "MonCash";
  if (/^nat\s*cash$/i.test(value)) return "NatCash";
  if (/^zelle$/i.test(value)) return "Zelle";
  return value || "Non précisé";
}
function MethodBreakdown({ payments }: { payments: AgentPayment[] }) {
  const rows = new Map<string, { usd: number; htg: number; count: number }>(METHOD_ORDER.map((label) => [label, { usd: 0, htg: 0, count: 0 }]));
  for (const payment of payments) {
    const label = methodLabel(payment.payment_method);
    const row = rows.get(label) ?? { usd: 0, htg: 0, count: 0 };
    if (payment.currency === "HTG") row.htg += Number(payment.amount || 0); else row.usd += Number(payment.amount || 0);
    row.count += 1;
    rows.set(label, row);
  }
  return <Card>
    <CardHeader title="Détail par moyen de paiement" subtitle="Zelle arrive directement sur le compte STANDA : il n’est pas dans la caisse à remettre." />
    <div className="divide-y divide-slate-100">{Array.from(rows, ([label, row]) => <div key={label} className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-900">{label}{label === "Zelle" && <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">hors caisse</span>}</p><p className="text-xs text-slate-500">{row.count} paiement{row.count > 1 ? "s" : ""}</p></div>
      <div className="shrink-0 text-right tabular-nums"><p className={cn("text-sm font-semibold", row.count ? "text-slate-900" : "text-slate-400")}>{fmtUsd(row.usd)}</p><p className="text-xs text-slate-500">{fmtHtg(row.htg)}</p></div>
    </div>)}</div>
  </Card>;
}

function ReportsView({ agentName, zoneName, payments, balances, allPayments, allBalances, deliveries, onSendReport, onOpenInvoice, onStartPayment, onOpenReceipt }: { agentName: string; zoneName: string; payments: AgentPayment[]; balances: CustomerBalanceReport[]; allPayments: AgentPayment[]; allBalances: CustomerBalanceReport[]; deliveries: ZonePackage[]; onSendReport: (pdfBase64: string, summary: string) => Promise<void>; onOpenInvoice: (invoiceId: string) => void; onStartPayment: (customerCode: string) => void; onOpenReceipt: (paymentId: string) => void }) {
  const [pdfBusy, setPdfBusy] = useState<"download" | "send" | null>(null);
  // Période du rapport : depuis le plus ancien paiement non clôturé (sinon aujourd'hui).
  const since = allPayments.reduce((min, payment) => payment.created_at && payment.created_at < min ? payment.created_at : min,
    new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
  const reportDeliveries = deliveries.filter((item) => item.delivered_at && item.delivered_at >= since)
    .sort((a, b) => b.delivered_at.localeCompare(a.delivered_at));
  const buildPdf = async () => {
    const { buildAgentReportPdf } = await import("@/lib/agent-report-pdf");
    return buildAgentReportPdf({
      agentName, zone: zoneName, since, payments: allPayments, balances: allBalances,
      deliveries: reportDeliveries.map((item) => ({ customer_code: item.customer_code, customer_name: item.customer_name, tracking: packageReference(item), invoice_number: item.invoice_number, delivered_at: item.delivered_at }))
    });
  };
  const downloadPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy("download");
    try { const { doc, fileName } = await buildPdf(); doc.save(fileName); }
    catch (error) { notify.error(error instanceof Error ? error.message : "PDF impossible.", { title: "Rapport PDF" }); }
    finally { setPdfBusy(null); }
  };
  const sendPdf = async () => {
    if (pdfBusy) return;
    if (!window.confirm("Envoyer le rapport PDF à l'administration ?")) return;
    setPdfBusy("send");
    try {
      const { doc, cash } = await buildPdf();
      const pdf = String(doc.output("datauristring")).split(",").pop() ?? "";
      const summary = `Caisse ${fmtUsd(cash.usd)} · ${fmtHtg(cash.htg)} · ${allPayments.length} paiement(s) · ${reportDeliveries.length} colis remis · ${allBalances.length} client(s) avec solde`;
      await onSendReport(pdf, summary);
      notify.success("L'administration a reçu votre rapport PDF.", { title: "Rapport envoyé" });
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Envoi impossible.", { title: "Rapport non envoyé" });
    } finally { setPdfBusy(null); }
  };
  // Zelle arrive directement sur le compte STANDA : il est listé, mais pas compté
  // dans l'argent que l'agent doit remettre à l'administration.
  const totals = cashTotals(payments);
  const zelle = payments.filter((payment) => payment.payment_method === "Zelle").reduce((value, payment) => ({
    usd: value.usd + (payment.currency === "USD" ? Number(payment.amount || 0) : 0),
    htg: value.htg + (payment.currency === "HTG" ? Number(payment.amount || 0) : 0)
  }), { usd: 0, htg: 0 });
  const hasZelle = zelle.usd > 0.009 || zelle.htg > 0.009;
  const paymentAmount = (payment: AgentPayment) => payment.currency === "HTG" ? fmtHtg(payment.amount) : fmtUsd(payment.amount);
  return <div className="space-y-4">
    <section className="rounded-3xl p-5 text-white" style={{ background: NAVY }}>
      <p className="text-[13px] text-white/70">Caisse de {agentName}</p>
      <p className="mt-1 text-[34px] font-semibold leading-tight tracking-tight tabular-nums">{fmtUsd(totals.usd)}</p>
      <p className="text-[15px] text-white/80 tabular-nums">{fmtHtg(totals.htg)}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3 text-[12px]">
        <div><p className="text-white/60">Clients avec solde</p><p className="mt-0.5 text-base font-semibold tabular-nums">{balances.length}</p></div>
        <div><p className="text-white/60">Paiements</p><p className="mt-0.5 text-base font-semibold tabular-nums">{payments.length}</p></div>
      </div>
      {hasZelle && <p className="mt-3 text-[12px] text-white/75">Zelle (déjà sur le compte STANDA, hors caisse) : {fmtUsd(zelle.usd)}{zelle.htg > 0.009 ? " · " + fmtHtg(zelle.htg) : ""}</p>}
    </section>
    <Card className="p-4">
      <p className="text-[15px] font-semibold text-slate-900">Rapport PDF</p>
      <p className="mt-0.5 text-xs text-slate-500">Caisse, détail Espèces / MonCash / NatCash / Zelle, paiements, colis remis ({reportDeliveries.length}) et soldes clients.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button type="button" disabled={!!pdfBusy} onClick={() => void sendPdf()} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#e85e19] px-4 text-sm font-semibold text-white hover:bg-[#d4530f] disabled:opacity-60">{pdfBusy === "send" ? <Spinner size={16} /> : <FileText size={17} />}{pdfBusy === "send" ? "Envoi…" : "Envoyer à l’administration"}</button>
        <button type="button" disabled={!!pdfBusy} onClick={() => void downloadPdf()} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#0b2a5b] ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60">{pdfBusy === "download" ? <Spinner size={16} /> : <FileDown size={17} />}Télécharger le PDF</button>
      </div>
    </Card>
    <MethodBreakdown payments={payments} />
    <p className="px-1 text-xs leading-5 text-slate-500">Seuls les paiements de ce point de retrait sont comptés. Quand l’argent est remis à l’administration, elle clôture le rapport : la caisse repart à zéro et seuls les soldes clients restent.</p>

    <Card>
      <CardHeader title="Paiements reçus" right={<CountPill value={payments.length} tone="emerald" />} />
      {payments.length ? <div className="divide-y divide-slate-100">{payments.map((payment) => <div key={payment.id} className="flex items-center gap-3 px-4 py-3">
        <Avatar name={payment.customer_name} code={payment.customer_code} tone="emerald" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{payment.customer_code}{payment.customer_name ? " · " + payment.customer_name : ""}</p>
          <p className="truncate text-xs text-slate-500">{payment.payment_method || "Méthode non précisée"} · {dateText(payment.created_at)}{payment.payment_reference ? " · Réf. " + payment.payment_reference : ""}</p>
          <div className="mt-1 flex gap-3 text-xs font-medium"><button type="button" onClick={() => onOpenInvoice(payment.invoice_id)} className="text-[#0b2a5b] hover:underline">{payment.invoice_number}</button><button type="button" onClick={() => onOpenReceipt(payment.id)} className="text-[#0b2a5b] hover:underline">Reçu</button></div>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700">+{paymentAmount(payment)}</p>
      </div>)}</div> : <p className="px-4 pb-4 text-sm text-slate-500">Aucun paiement n’a encore été enregistré par ce point de retrait.</p>}
    </Card>

    <Card>
      <CardHeader title="Clients avec un solde" subtitle="Le solde doit être réglé avant une nouvelle remise." right={<CountPill value={balances.length} tone="amber" />} />
      {balances.length ? <div className="divide-y divide-slate-100">{balances.map((balance) => <div key={balance.customer_code} className="flex items-center gap-3 px-4 py-3">
        <Avatar name={balance.customer_name} code={balance.customer_code} tone="orange" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{balance.customer_code}{balance.customer_name ? " · " + balance.customer_name : ""}</p>
          <p className="text-xs tabular-nums text-slate-500">{fmtUsd(balance.balance_usd)} · {fmtHtg(balance.balance_htg)} · {balance.invoice_count} facture{balance.invoice_count > 1 ? "s" : ""}</p>
          <button type="button" onClick={() => onOpenInvoice(balance.invoice_id)} className="mt-1 text-xs font-medium text-[#0b2a5b] hover:underline">Voir {balance.invoice_number}</button>
        </div>
        <button type="button" onClick={() => onStartPayment(balance.customer_code)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#e85e19] px-3 text-xs font-semibold text-white hover:bg-[#d4530f]"><Banknote size={15} />Encaisser</button>
      </div>)}</div> : <p className="px-4 pb-4 text-sm text-slate-500">Aucun client de cette zone n’a de solde en attente.</p>}
    </Card>
  </div>;
}

function BonsView({ bons, onOpenPdf }: { bons: ZoneBon[]; onOpenPdf: (id: string) => void }) {
  if (!bons.length) return <Empty text="Aucun bon de remise ne correspond à cette recherche." />;
  return <Card>
    <CardHeader title="Bons de remise" right={<CountPill value={bons.length} />} />
    <div className="divide-y divide-slate-100">{bons.map((bon) => <button key={bon.id} type="button" onClick={() => onOpenPdf(bon.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50">
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", bon.received_at ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-[#e85e19]")}>{bon.received_at ? <CheckCircle2 size={18} /> : <Truck size={18} />}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><span className="font-mono text-sm font-semibold text-slate-900">{bon.bon_number}</span><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", bon.received_at ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800")}>{bon.received_at ? "Reçu" : "En route"}</span></span>
        <span className="block truncate text-xs text-slate-500">{bon.destination || "Destination non précisée"} · {bon.package_count} colis · {dateText(bon.created_at)}{bon.received_by ? ` · reçu par ${bon.received_by}` : ""}</span>
      </span>
      <FileDown size={18} className="shrink-0 text-slate-400" />
    </button>)}</div>
  </Card>;
}

function Empty({ text }: { text: string }) { return <Card className="px-6 py-12 text-center"><CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={32} /><p className="text-sm font-medium text-slate-700">{text}</p></Card>; }
/**
 * Une couleur par étape, partout pareil : orange = disponible à remettre,
 * violet = arrivé en Haïti, bleu ciel = en cours (Miami / transit), vert = remis.
 */
function statusTone(status: string) {
  if (status === DONE) return { chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-400" };
  if (READY_STATUSES.has(status)) return { chip: "bg-orange-50 text-[#c2410c]", bar: "bg-orange-400" };
  if (HAITI_STATUSES.has(status)) return { chip: "bg-violet-50 text-violet-700", bar: "bg-violet-400" };
  return { chip: "bg-sky-50 text-sky-700", bar: "bg-sky-400" };
}
function StatusChip({ status }: { status: string }) { return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", statusTone(status).chip)}>{status}</span>; }
function PaymentChip({ status }: { status: string }) { const tone = status === "Payé" ? "bg-emerald-50 text-emerald-700" : status === "Payé partiel" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"; return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", tone)}>{status}</span>; }
function DeliveryChip({ status }: { status: string }) { const delivered = status === "Livrée"; return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", delivered ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>{delivered ? "Livrée" : "À remettre"}</span>; }
