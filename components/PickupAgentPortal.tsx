"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, BellRing, Check, CheckCircle2, ChevronRight, Copy, FileDown, FileText, Home, LogOut, Package, RefreshCw, Search, Settings, Users, Wallet, X } from "@/components/icons";
import { supabase } from "@/lib/supabase";
import { autoEnablePush, getPushPermissionState, isPushSupported, pushFailureMessage, reportPushFailure, subscribeStaffToPush } from "@/lib/push";
import { openSecureDocument } from "@/lib/secure-document";
import { sortPackagesAvailableFirst } from "@/lib/utils";
import Loader, { Spinner } from "@/components/Loader";
import { RemiseTicketOverlay } from "@/components/RemiseTicketPage";
import ClientPaymentForm, { type ClientPaymentSubmit } from "@/components/ClientPaymentForm";
import { invoiceStatusLines } from "@/lib/payment-allocation";
import { notify } from "@/lib/notify";
import type { PaymentInvoice } from "@/lib/payment-allocation";
import { cn } from "@/lib/cn";
import StaffNotifications from "@/components/StaffNotifications";
import { MessageScreen } from "@/components/Toaster";
import PwaInstallButton from "@/components/PwaInstallButton";

/* ═══════════════════════════════════════════════════════════════════════════
 * STANDA RETRAIT — application des agents des points de retrait.
 * Un outil de comptoir, pas l'app client : chaque code client, nom, facture
 * et colis ouvre une fiche complète. Toutes les règles (paiement complet avant
 * retrait, un client à la fois, zone de l'agent) restent vérifiées par l'API.
 * ═══════════════════════════════════════════════════════════════════════════ */

type ZonePackage = {
  id: string; tracking_number: string; tracking_manual: string; customer_code: string; customer_name: string;
  customer_balance_usd: number; customer_balance_htg: number; balance_invoice_id: string; balance_invoice_number: string;
  quantity: number; content: string; created_date: string; received_at: string; delivered_at: string; status: string;
  invoice_id: string; invoice_number: string; invoice_payment_status: string; invoice_payment_details: string;
  is_central_account: boolean;
  is_special: boolean; special_reason: string;
  weight?: number; created_at?: string; status_dates?: Record<string, string> | null;
  price_usd?: number; tax_usd?: number;
  conduce_number?: string; conduce_date?: string; bon_number?: string; bon_received_at?: string; bon_received_by?: string;
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
  parcels?: BonParcel[];
};
type BonParcel = { id: string; tracking_number: string; tracking_manual: string; customer_code: string; content: string; quantity: number; status: string };
type ClientCard = { customer_code: string; name: string; account_type: string; since: string; pickup_location: string; phone: string; whatsapp: string; id_type: string; id_number: string };
type AgentPayment = { id: string; invoice_id: string; invoice_number: string; customer_code: string; customer_name: string; amount: number; currency: string; amount_usd: number; amount_htg: number; payment_method: string; payment_reference: string; created_at: string };
type CustomerBalanceReport = { customer_code: string; customer_name: string; balance_usd: number; balance_htg: number; invoice_id: string; invoice_number: string; invoice_count: number };
type PortalData = { agent: { id: string; name: string; username: string }; zone: { name: string }; clients?: ClientCard[]; packages: ZonePackage[]; invoices: ZoneInvoice[]; bons: ZoneBon[]; report: { agent_payments: AgentPayment[]; customer_balances: CustomerBalanceReport[] } };
type Tab = "home" | "clients" | "colis" | "bordereaux" | "caisse" | "settings";
type ClientTab = "colis" | "factures" | "paiements" | "livraisons";
type ClientFilter = "comptoir" | "solde" | "transit" | "tous";
type ParcelFilter = "comptoir" | "transit" | "livres";
type PaymentTarget = { customerCode: string; invoiceIds?: string[] };
type PushPermission = NotificationPermission | "unsupported" | "checking";
type ClientFile = { code: string; name: string; card?: ClientCard; packages: ZonePackage[]; invoices: ZoneInvoice[]; central: boolean };

/** Colis d'un bordereau déjà à l'agence (plus à pointer). */
const BON_PARCEL_DONE = new Set(["Disponible", "Facturé", "Livré"]);
const DONE = "Livré";
const READY_STATUSES = new Set(["Disponible", "Facturé"]);
/** Ordre du suivi, de Miami jusqu'au retrait. */
const TRACK_STEPS = ["Reçu à Miami", "En préparation", "En transit", "Arrivé en Haïti", "En route vers agence", "Disponible", "Facturé", "Livré"];
/** Mots du shipping affichés à l'agent (le statut en base ne change pas). */
const STATUS_LABEL: Record<string, string> = { "En route vers agence": "En acheminement" };
const statusLabel = (status: string) => STATUS_LABEL[status] ?? status;

const NAVY = "#0b2a5b";
const fmtUsd = (value: number) => "$" + Number(value || 0).toFixed(2);
const fmtHtg = (value: number) => new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 2 }).format(Number(value || 0)) + " HTG";
const dateText = (value: string) => value ? new Date(value).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }) : "·";
const dateTimeText = (value: string) => value ? new Date(value).toLocaleString("fr-CA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "·";
const shortStamp = (value: string) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "·";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const packageReference = (item: ZonePackage) => item.tracking_number || item.tracking_manual || "Colis sans numéro";
const isReadyForPickup = (item: ZonePackage) => READY_STATUSES.has(item.status) && Boolean(item.invoice_id);
const atCounter = (item: ZonePackage) => READY_STATUSES.has(item.status);
/** Un colis sort seulement quand sa facture est payée et que le client n'a aucun solde ouvert. */
const canReleaseParcel = (item: ZonePackage) => isReadyForPickup(item) && item.invoice_payment_status === "Payé" && item.customer_balance_usd <= 0.01;
const releaseBlockReason = (item: ZonePackage) => !item.invoice_id ? "En attente de facture"
  : item.customer_balance_usd > 0.01 ? "Solde à régler avant retrait"
    : item.invoice_payment_status !== "Payé" ? "Facture impayée" : "";
const dateTimestamp = (value: string) => { const parsed = value ? Date.parse(value) : 0; return Number.isFinite(parsed) ? parsed : 0; };
/** dd/mm/yyyy (« Creado » MCPACK) → ISO. */
const mcpackDate = (value: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || "").trim()); return m ? `${m[3]}-${m[2]}-${m[1]}T12:00:00` : ""; };
/** Date d'arrivée au comptoir (Disponible), sinon de facturation. */
const counterSince = (item: ZonePackage) => item.status_dates?.["Disponible"] || item.status_dates?.["Facturé"] || "";
const daysSince = (value: string) => value ? Math.max(0, Math.floor((Date.now() - dateTimestamp(value)) / 86_400_000)) : 0;
const isToday = (value: string) => { if (!value) return false; const d = new Date(value); const n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate(); };
const digits = (value: string) => String(value || "").replace(/\D/g, "");
const toPaymentInvoice = (invoice: ZoneInvoice): PaymentInvoice => ({
  id: invoice.id, invoice_number: invoice.invoice_number, customer_code: invoice.customer_code,
  grand_total: invoice.amount_due_usd, total_usd: invoice.amount_due_usd, total_htg: invoice.amount_due_htg,
  exchange_rate_used: invoice.exchange_rate, order_deposit: 0, balance_due: invoice.amount_due_usd, has_pdf: invoice.has_pdf,
  payment_paid_usd: invoice.payment_paid_usd, payment_paid_htg: invoice.payment_paid_htg, created_at: invoice.created_at
});

export default function PickupAgentPortal() {
  const router = useRouter();
  const [data, setData] = useState<PortalData | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [clientCode, setClientCode] = useState<string | null>(null);
  const [clientTab, setClientTab] = useState<ClientTab>("colis");
  const [parcelId, setParcelId] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const [ticketPackageId, setTicketPackageId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<ClientFilter>("comptoir");
  const [parcelFilter, setParcelFilter] = useState<ParcelFilter>("comptoir");
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [releasing, setReleasing] = useState(false);
  const [releasedInfo, setReleasedInfo] = useState<{ customerCode: string; count: number } | null>(null);
  const [selectedBonId, setSelectedBonId] = useState<string | null>(null);
  const [bonBusy, setBonBusy] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [remiseOffer, setRemiseOffer] = useState<{ customerCode: string; packageIds: string[]; paymentText: string } | null>(null);
  const [loadError, setLoadError] = useState("");
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
      if (!silent) { setData(null); setLoadError(error instanceof Error ? error.message : "Chargement impossible."); }
    } finally {
      if (!silent) setLoading(false);
    }
    return null;
  }, [router]);

  useEffect(() => { void load(); }, [load]);
  // Mise à jour automatique toutes les 20 s quand l'app est à l'écran, jamais deux à la fois.
  const refreshingRef = useRef(false);
  useEffect(() => {
    const refresh = async () => {
      if (refreshingRef.current || document.visibilityState !== "visible") return;
      refreshingRef.current = true;
      try { await load(true); } finally { refreshingRef.current = false; }
    };
    const timer = window.setInterval(() => void refresh(), 20_000);
    let lastFocusRefresh = Date.now();
    const onVisible = () => { if (Date.now() - lastFocusRefresh < 15_000) return; lastFocusRefresh = Date.now(); void refresh(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);

  useEffect(() => {
    if (!data?.agent.id) return;
    let active = true;
    let dismissed = false;
    try { dismissed = window.localStorage.getItem("standa-agence:push-dismissed") === "1"; } catch { /* ignore */ }
    if (!isPushSupported()) { setPushPermission("unsupported"); return; }
    const agentId = data.agent.id;
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
      if (r.ok) { setPushPermission("granted"); notify.success("Notifications activées", { small: true }); dismissPushBanner(); }
      else if (r.reason === "denied") { setPushPermission("denied"); notify.error("Notifications refusées sur cet appareil", { small: true }); dismissPushBanner(); }
      else { notify.error(pushFailureMessage(r.reason), { small: true }); void reportPushFailure(r.reason ?? "inconnu"); }
    } finally { setPushBusy(false); }
  };

  const packages = useMemo(() => data?.packages ?? [], [data?.packages]);
  const invoices = useMemo(() => data?.invoices ?? [], [data?.invoices]);
  const bons = useMemo(() => data?.bons ?? [], [data?.bons]);
  const report = data?.report ?? { agent_payments: [] as AgentPayment[], customer_balances: [] as CustomerBalanceReport[] };
  const counter = useMemo(() => packages.filter(atCounter), [packages]);
  const delivered = useMemo(() => packages.filter((item) => item.status === DONE), [packages]);
  const inTransit = useMemo(() => packages.filter((item) => item.status !== DONE && !atCounter(item)), [packages]);
  const pendingBons = useMemo(() => bons.filter((bon) => !bon.received_at), [bons]);

  /** Une fiche par client : identité, colis, factures. Le compte central reste à part. */
  const files = useMemo(() => {
    const byCode = new Map<string, ClientFile>();
    const ensure = (code: string, name: string, central: boolean) => {
      const existing = byCode.get(code);
      if (existing) { if (!existing.name && name) existing.name = name; return existing; }
      const card = (data?.clients ?? []).find((client) => client.customer_code === code);
      const file: ClientFile = { code, name: card?.name || name, card, packages: [], invoices: [], central };
      byCode.set(code, file);
      return file;
    };
    for (const item of packages) ensure(item.customer_code, item.customer_name, item.is_central_account).packages.push(item);
    for (const invoice of invoices) ensure(invoice.customer_code, invoice.customer_name, invoice.is_central_account).invoices.push(invoice);
    return byCode;
  }, [packages, invoices, data?.clients]);
  const balanceOf = (code: string) => {
    const file = files.get(code);
    const source = file?.invoices[0] ?? file?.packages[0];
    return { usd: source?.customer_balance_usd ?? 0, htg: source?.customer_balance_htg ?? 0 };
  };

  // L'actualisation peut rendre un colis choisi non retirable : on le retire de la sélection.
  useEffect(() => {
    setSelectedPackageIds((current) => {
      const valid = current.filter((id) => { const item = packages.find((parcel) => parcel.id === id); return item && canReleaseParcel(item); });
      return valid.length === current.length ? current : valid;
    });
  }, [packages]);

  const call = async (body: Record<string, unknown>) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) { router.replace("/point-retrait"); return null; }
    const response = await fetch("/api/pickup-agent", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(body)
    });
    const json = await response.json();
    if (!response.ok || !json.ok) throw new Error(json.reason || "Opération impossible.");
    return json;
  };

  // ── NAVIGATION PAR PAGES ─────────────────────────────────────────────────
  // Chaque fiche ouverte entre dans l'historique du navigateur : Retour (ou le
  // geste retour du téléphone) revient sur l'écran précédent, sans quitter l'app.
  type NavSnapshot = { tab: Tab; clientCode: string | null; clientTab: ClientTab; parcelId: string | null; selectedInvoiceId: string | null; paymentTarget: PaymentTarget | null; ticketPackageId: string | null };
  const snapshot: NavSnapshot = { tab, clientCode, clientTab, parcelId, selectedInvoiceId, paymentTarget, ticketPackageId };
  const snapshotKey = JSON.stringify(snapshot);
  const lastKeyRef = useRef<string | null>(null);
  const restoringRef = useRef(false);
  const applySnapshot = (next: NavSnapshot) => {
    restoringRef.current = true;
    setTab(next.tab); setClientCode(next.clientCode); setClientTab(next.clientTab); setParcelId(next.parcelId);
    setSelectedInvoiceId(next.selectedInvoiceId); setPaymentTarget(next.paymentTarget); setTicketPackageId(next.ticketPackageId);
  };
  const applySnapshotRef = useRef(applySnapshot);
  applySnapshotRef.current = applySnapshot;
  useEffect(() => {
    if (lastKeyRef.current === null) { lastKeyRef.current = snapshotKey; return; }
    if (lastKeyRef.current === snapshotKey) return;
    lastKeyRef.current = snapshotKey;
    if (restoringRef.current) restoringRef.current = false;
    else { try { window.history.pushState({ ...(window.history.state ?? {}), standaAgentNav: snapshot }, "", window.location.href); } catch { /* noop */ } }
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotKey]);
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const saved = event.state && typeof event.state === "object" ? (event.state as { standaAgentNav?: NavSnapshot }).standaAgentNav : undefined;
      applySnapshotRef.current(saved ?? { tab: "home", clientCode: null, clientTab: "colis", parcelId: null, selectedInvoiceId: null, paymentTarget: null, ticketPackageId: null });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const goTab = (next: Tab) => { setTab(next); setClientCode(null); setParcelId(null); setSelectedInvoiceId(null); setPaymentTarget(null); setSearch(""); };
  const goBack = () => { if (!paymentBusy) window.history.back(); };
  const openClient = (code: string, initialTab: ClientTab = "colis") => { setClientCode(code); setClientTab(initialTab); setParcelId(null); setSelectedInvoiceId(null); setPaymentTarget(null); };
  const openParcel = (id: string) => { setParcelId(id); setSelectedInvoiceId(null); setPaymentTarget(null); };
  const openInvoice = (id: string) => { setSelectedInvoiceId(id); setPaymentTarget(null); };
  const startPayment = (customerCode: string, invoiceIds?: string[]) => { if (customerCode) setPaymentTarget({ customerCode, invoiceIds }); };

  /** Recherche du comptoir : code client, nom, téléphone, N° de guía ou de suivi (complet ou 6 derniers chiffres). */
  const runSearch = () => {
    const needle = search.trim().toLowerCase();
    if (!needle) return;
    const exactClient = Array.from(files.values()).find((file) => file.code.toLowerCase() === needle);
    if (exactClient) { setSearch(""); openClient(exactClient.code); return; }
    const compact = needle.replace(/\s+/g, "");
    const byTracking = packages.filter((item) => [item.tracking_number, item.tracking_manual].some((value) => {
      const v = String(value || "").toLowerCase();
      return v && (v === compact || (compact.length >= 6 && /^\d+$/.test(compact) && v.endsWith(compact)));
    }));
    if (byTracking.length === 1) { setSearch(""); openParcel(byTracking[0].id); return; }
    if (byTracking.length > 1) { notify.error("Plusieurs colis correspondent : tapez le numéro complet", { small: true }); return; }
    const needleDigits = digits(needle);
    const byPhone = needleDigits.length >= 6 ? Array.from(files.values()).filter((file) => [file.card?.phone, file.card?.whatsapp].some((p) => digits(p ?? "").endsWith(needleDigits))) : [];
    if (byPhone.length === 1) { setSearch(""); openClient(byPhone[0].code); return; }
    const byName = Array.from(files.values()).filter((file) => `${file.code} ${file.name}`.toLowerCase().includes(needle));
    if (byName.length === 1) { setSearch(""); openClient(byName[0].code); return; }
    if (byName.length > 1 || byPhone.length > 1) { setTab("clients"); setClientCode(null); setParcelId(null); setClientFilter("tous"); return; }
    notify.error("Aucun client ni colis trouvé", { small: true });
  };

  const togglePackageSelection = (parcel: ZonePackage) => {
    setSelectedPackageIds((current) => {
      const otherClient = current.some((id) => packages.find((item) => item.id === id)?.customer_code !== parcel.customer_code);
      if (otherClient) return [parcel.id];
      return current.includes(parcel.id) ? current.filter((id) => id !== parcel.id) : [...current, parcel.id];
    });
  };
  const selectAllFor = (ids: string[]) => setSelectedPackageIds((current) => ids.length > 0 && ids.every((id) => current.includes(id)) ? [] : ids);
  const selectedCustomerCode = packages.find((item) => item.id === selectedPackageIds[0])?.customer_code ?? "";

  const releasePackages = async (packageIds: string[]) => {
    if (releasing || !packageIds.length) return;
    const customerCode = packages.find((item) => item.id === packageIds[0])?.customer_code ?? "";
    setReleasing(true);
    try {
      const result = await call({ action: "release_many", package_ids: packageIds });
      if (!result) return;
      const confirmed: string[] = Array.isArray(result.package_ids) ? result.package_ids : packageIds;
      setReleasedInfo({ customerCode, count: confirmed.length });
      // Chaque retrait produit sa preuve de livraison : elle s'ouvre juste après la grande coche verte.
      window.setTimeout(() => {
        setReleasedInfo(null); setSelectedPackageIds([]);
        if (confirmed[0]) setTicketPackageId(confirmed[0]);
        void load(true);
      }, 1_400);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Retrait impossible.", { title: "Retrait refusé" });
    } finally {
      setReleasing(false);
    }
  };

  const confirmBon = async (bonId: string, packageIds: string[]) => {
    if (bonBusy || !packageIds.length) return;
    setBonBusy(true);
    try {
      const result = await call({ action: "confirm_bon_remise", bon_remise_id: bonId, package_ids: packageIds });
      const text = result.alreadyConfirmed
        ? "Ce bordereau était déjà pointé."
        : `${result.updated} colis au comptoir${result.alreadyReady ? ` · ${result.alreadyReady} déjà reçus` : ""}.` +
          (result.remaining ? `\nIl reste ${result.remaining} colis à pointer sur ce bordereau.` : "");
      notify.success(text, { title: result.remaining ? "Pointage enregistré" : "Bordereau pointé" });
      setSelectedBonId(null);
      void load(true);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Pointage impossible.", { title: "Pointage refusé" });
    } finally {
      setBonBusy(false);
    }
  };

  const paymentInvoicesFor = (customerCode: string) => invoices
    .filter((invoice) => invoice.customer_code === customerCode && invoice.has_pdf && invoice.payment_status !== "Payé")
    .map(toPaymentInvoice);

  const recordPayment = async (payload: ClientPaymentSubmit) => {
    setPaymentBusy(true);
    try {
      const result = await call({
        action: "record_payment", invoice_ids: payload.invoiceIds,
        lines: payload.lines.map((line) => ({ amount: line.amount, currency: line.currency, payment_method: line.method, payment_reference: line.reference }))
      });
      if (!result) return;
      const lines = (result.payments ?? []) as Array<{ invoice_number: string; payment_status: string }>;
      const paymentText = `${payload.summary}\n${invoiceStatusLines(lines)}`;
      const customerCode = paymentTarget?.customerCode ?? "";
      window.history.back();
      const fresh = await load(true);
      const releasable = (fresh?.packages ?? []).filter((item) => item.customer_code === customerCode && canReleaseParcel(item)).map((item) => item.id);
      if (releasable.length) setRemiseOffer({ customerCode, packageIds: releasable, paymentText });
      else notify.success(paymentText, { title: `Paiement encaissé · ${customerCode}` });
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Paiement impossible.", { title: "Paiement non enregistré" });
    } finally {
      setPaymentBusy(false);
    }
  };

  const openDocument = async (kind: "invoice" | "bon-remise", id: string) => {
    try { await openSecureDocument(kind, id); }
    catch (error) { notify.error(error instanceof Error ? error.message : "PDF indisponible", { small: true }); }
  };
  const copyText = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); notify.success(`${label} copié`, { small: true }); }
    catch { notify.error("Copie impossible", { small: true }); }
  };
  const logout = async () => { await supabase.auth.signOut(); router.replace("/point-retrait"); };

  const cash = cashTotals(report.agent_payments);
  const openFile = clientCode ? files.get(clientCode) ?? null : null;
  const openParcelRow = parcelId ? packages.find((item) => item.id === parcelId) ?? null : null;
  const selectedInvoice = selectedInvoiceId ? invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null : null;
  const subPage: "payment" | "invoice" | "parcel" | "client" | null = paymentTarget ? "payment" : selectedInvoice ? "invoice" : openParcelRow ? "parcel" : openFile ? "client" : null;
  const TAB_TITLES: Record<Tab, string> = { home: "Accueil", clients: "Clients", colis: "Colis", bordereaux: "Bordereaux", caisse: "Caisse", settings: "Paramètres" };
  const pageTitle = subPage === "payment" ? "Encaissement" : subPage === "invoice" ? "Facture" : subPage === "parcel" ? "Fiche colis" : subPage === "client" ? "Fiche client" : TAB_TITLES[tab];
  const headerCode = subPage === "client" ? openFile?.code : subPage === "payment" ? paymentTarget?.customerCode : subPage === "invoice" ? selectedInvoice?.customer_code : undefined;
  const showBack = Boolean(data) && (tab !== "home" || Boolean(subPage));
  const today = new Date();
  const stamp = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;
  const firstName = (data?.agent.name ?? "").trim().split(/\s+/)[0] || "Agent";
  const navTab = subPage ? (subPage === "parcel" && tab === "colis" ? "colis" : tab === "home" ? "home" : tab) : tab;

  return <>
    <div className="agent-app min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-30 text-white" style={{ background: NAVY }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-6">
          {showBack
            ? <button type="button" onClick={goBack} disabled={paymentBusy} aria-label="Retour" className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition hover:bg-white/10 disabled:opacity-40"><ArrowLeft size={20} /></button>
            : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[13px] font-extrabold" style={{ color: NAVY }}>SC</span>}
          <div className="min-w-0 flex-1">
            {showBack
              ? <p className="truncate text-[15px] font-extrabold">{pageTitle}</p>
              : <><p className="truncate text-[15px] font-extrabold leading-tight">STANDA Retrait</p><p className="agent-mono truncate text-[11px] uppercase tracking-wide text-white/65">{data ? `${data.zone.name} · ${stamp} · ${firstName}` : "Point de retrait"}</p></>}
          </div>
          {headerCode && <span className="agent-mono hidden shrink-0 rounded-md bg-white px-2 py-1 text-[12px] font-semibold min-[360px]:inline" style={{ color: NAVY }}>{headerCode}</span>}
          <StaffNotifications variant="icon" />
          {!showBack && <button type="button" onClick={() => goTab("settings")} aria-label="Paramètres" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/85 hover:bg-white/10"><Settings size={18} /></button>}
          <button type="button" onClick={logout} aria-label="Se déconnecter" title="Se déconnecter" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/85 transition hover:bg-white/10"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 pb-36 pt-3 sm:px-6 md:pb-12">
        {loading && <div className="grid min-h-[45vh] place-items-center"><Loader inline size={64} /></div>}
        {!loading && !data && <MessageScreen tone="error" title="Accès à vérifier" text={loadError || "Impossible de préparer votre espace."} actionLabel="Réessayer" onAction={() => void load()} />}
        {!loading && data && <div className="md:grid md:grid-cols-[200px_minmax(0,1fr)] md:gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <SideNavigation tab={navTab} counts={{ clients: files.size, colis: counter.length, bordereaux: pendingBons.length }} onGo={goTab} />
          <div className="min-w-0 space-y-3">
            {showPushBanner && !subPage && tab === "home" && <PushBanner busy={pushBusy} onActivate={() => void activatePush()} onDismiss={dismissPushBanner} />}

            {subPage === "payment" && paymentTarget && <ClientPaymentForm plain key={paymentTarget.customerCode + (paymentTarget.invoiceIds ?? []).join()} title="Encaissement" customerCode={paymentTarget.customerCode} customerName={files.get(paymentTarget.customerCode)?.name} invoices={paymentInvoicesFor(paymentTarget.customerCode)} initialSelected={paymentTarget.invoiceIds} busy={paymentBusy} onSubmit={(payload) => void recordPayment(payload)} onClose={goBack} />}
            {subPage === "invoice" && selectedInvoice && <InvoicePage invoice={selectedInvoice} packages={packages.filter((item) => item.invoice_id === selectedInvoice.id)} onOpenParcel={openParcel} onOpenClient={() => openClient(selectedInvoice.customer_code)} onPdf={() => void openDocument("invoice", selectedInvoice.id)} onPay={selectedInvoice.payment_status !== "Payé" && selectedInvoice.has_pdf ? () => startPayment(selectedInvoice.customer_code, [selectedInvoice.id]) : undefined} />}
            {subPage === "parcel" && openParcelRow && <ParcelPage item={openParcelRow} zoneName={data.zone.name} onOpenClient={() => openClient(openParcelRow.customer_code)} onOpenInvoice={openInvoice} onPay={() => startPayment(openParcelRow.customer_code, openParcelRow.invoice_id ? [openParcelRow.invoice_id] : undefined)} onRelease={() => void releasePackages([openParcelRow.id])} releasing={releasing} onTicket={() => setTicketPackageId(openParcelRow.id)} onCopy={copyText} />}
            {subPage === "client" && openFile && <ClientPage file={openFile} zoneName={data.zone.name} balance={balanceOf(openFile.code)} activeTab={clientTab} onTab={setClientTab}
              selectedPackageIds={selectedPackageIds} locked={releasing || Boolean(releasedInfo)} onToggle={togglePackageSelection} onSelectAll={selectAllFor}
              onOpenParcel={openParcel} onOpenInvoice={openInvoice} onPay={(ids) => startPayment(openFile.code, ids)} onTicket={setTicketPackageId}
              onOpenReceipt={(paymentId) => window.open(`/espace-remise/recu-paiement/${paymentId}`, "_blank", "noopener,noreferrer")} payments={report.agent_payments.filter((p) => p.customer_code === openFile.code)} />}

            {!subPage && tab === "home" && <HomeView search={search} onSearch={setSearch} onSubmit={runSearch} counts={{ counter: counter.length, transit: inTransit.length, today: delivered.filter((item) => isToday(item.delivered_at)).length }}
              pendingBons={pendingBons} onOpenBon={setSelectedBonId} files={files} counter={counter} balanceOf={balanceOf} onOpenClient={openClient} cash={cash} paymentsCount={report.agent_payments.length} onCaisse={() => goTab("caisse")} onGo={goTab} />}
            {!subPage && tab === "clients" && <ClientsView files={files} filter={clientFilter} onFilter={setClientFilter} search={search} onSearch={setSearch} balanceOf={balanceOf} onOpen={openClient} />}
            {!subPage && tab === "colis" && <ParcelsView packages={packages} filter={parcelFilter} onFilter={setParcelFilter} search={search} onSearch={setSearch} onOpen={openParcel} onOpenClient={openClient} />}
            {!subPage && tab === "bordereaux" && <BordereauxView bons={bons} search={search} onSearch={setSearch} onPoint={setSelectedBonId} onPdf={(id) => void openDocument("bon-remise", id)} />}
            {!subPage && tab === "caisse" && <CaisseView zoneName={data.zone.name} agentName={data.agent.name} deliveries={delivered} payments={report.agent_payments} balances={report.customer_balances}
              onSendReport={async (pdf, summary) => { await call({ action: "send_report", pdf, summary }); }}
              onOpenInvoice={openInvoice} onOpenClient={(code) => openClient(code, "factures")} onStartPayment={(code) => startPayment(code)}
              onOpenReceipt={(paymentId) => window.open(`/espace-remise/recu-paiement/${paymentId}`, "_blank", "noopener,noreferrer")} />}
            {!subPage && tab === "settings" && <SettingsView agentName={data.agent.name} pushPermission={pushPermission} pushBusy={pushBusy} onActivate={() => void activatePush()} />}
          </div>
        </div>}
      </main>

      {data && <BottomNavigation tab={navTab} counts={{ colis: counter.length, bordereaux: pendingBons.length }} onGo={goTab} />}
      {data && selectedPackageIds.length > 0 && !releasedInfo && (subPage === "client" || subPage === null) && <ReleaseBar customerCode={selectedCustomerCode} count={selectedPackageIds.length} busy={releasing} onConfirm={() => void releasePackages(selectedPackageIds)} onClear={() => setSelectedPackageIds([])} />}
    </div>
    {releasedInfo && <BigConfirmation title="Retrait validé" text={`${releasedInfo.count} colis${releasedInfo.customerCode ? " · " + releasedInfo.customerCode : ""}`} />}
    {remiseOffer && <RemiseOffer offer={remiseOffer} busy={releasing} onRelease={() => { const ids = remiseOffer.packageIds; setRemiseOffer(null); void releasePackages(ids); }} onLater={() => setRemiseOffer(null)} />}
    {data && selectedBonId && (() => { const bon = bons.find((b) => b.id === selectedBonId); return bon ? <PointageSheet key={bon.id} bon={bon} busy={bonBusy} onClose={() => setSelectedBonId(null)} onConfirm={(ids) => void confirmBon(bon.id, ids)} /> : null; })()}
    {/* Preuve de livraison : hors de l'échelle réduite, pour que l'impression garde la vraie largeur du papier. */}
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

// ═══════════════════════════════════════════════════════════════════════════
// PRÉSENTATION — modèle « A+C » : en-tête bleu marine, listes à lignes fines
// (registre), cadres à petits titres en majuscules (lettre de transport).
// ═══════════════════════════════════════════════════════════════════════════

/** Le code client : une étiquette bleu marine qui ouvre la fiche client. */
function CodeTag({ code, onClick, central = false, size = "md" }: { code: string; onClick?: () => void; central?: boolean; size?: "sm" | "md" }) {
  const cls = cn("agent-mono inline-flex shrink-0 items-center justify-center rounded-[5px] font-semibold",
    size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-[12px]",
    central ? "border border-dashed border-[#e85e19] bg-orange-50 text-[#9a3412]" : "bg-[#0b2a5b] text-white");
  const label = central ? "Central" : code;
  return onClick ? <button type="button" onClick={(event) => { event.stopPropagation(); onClick(); }} className={cn(cls, "transition hover:opacity-85")} aria-label={`Fiche client ${code}`}>{label}</button> : <span className={cls}>{label}</span>;
}

function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500", className)}>{children}</p>;
}
function Box({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("overflow-hidden rounded-lg border-[1.5px] border-slate-900 bg-white", className)}>{children}</section>;
}
function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return <div className="flex items-center justify-between gap-2 px-1 pb-1.5 pt-3"><FieldLabel>{children}</FieldLabel>{right}</div>;
}
function StatusText({ status }: { status: string }) {
  const tone = status === DONE ? "text-emerald-700" : status === "Facturé" ? "text-blue-700" : status === "Disponible" ? "text-emerald-700" : "text-slate-500";
  return <span className={cn("shrink-0 text-[10px] font-extrabold uppercase tracking-[0.06em]", tone)}>{statusLabel(status)}</span>;
}
function PaymentText({ status }: { status: string }) {
  const tone = status === "Payé" ? "text-emerald-700" : status === "Payé partiel" ? "text-amber-700" : "text-red-700";
  const label = status === "Payé" ? "Payée" : status === "Payé partiel" ? "Partielle" : status === "Non facturé" ? "Non facturé" : "Impayée";
  return <span className={cn("shrink-0 text-[10px] font-extrabold uppercase tracking-[0.06em]", tone)}>{label}</span>;
}
function Empty({ text }: { text: string }) { return <div className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center text-sm font-medium text-slate-500">{text}</div>; }
function SearchField({ value, onChange, onSubmit, placeholder = "Code, nom, téléphone, N° de suivi" }: { value: string; onChange: (value: string) => void; onSubmit?: () => void; placeholder?: string }) {
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit?.(); }} className="flex h-12 items-center gap-2 rounded-lg border-[1.5px] border-slate-900 bg-white px-3 focus-within:ring-2 focus-within:ring-[#0b2a5b]/30">
    <Search size={18} className="shrink-0 text-slate-900" />
    <input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-slate-400" placeholder={placeholder} aria-label="Rechercher" autoCapitalize="characters" enterKeyHint="search" />
    {onSubmit && value.trim() && <button type="submit" className="h-9 shrink-0 rounded-md px-3 text-[13px] font-bold text-white" style={{ background: NAVY }}>Ouvrir</button>}
  </form>;
}
function Chips<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string, number?]>; onChange: (value: T) => void }) {
  return <div className="flex gap-1.5 overflow-x-auto pb-0.5">{options.map(([id, label, count]) => <button key={id} type="button" onClick={() => onChange(id)} aria-pressed={value === id}
    className={cn("h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold transition", value === id ? "bg-[#0b2a5b] text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50")}>
    {label}{typeof count === "number" && <span className={cn("agent-mono ml-1.5", value === id ? "text-white/75" : "text-slate-400")}>{count}</span>}
  </button>)}</div>;
}

function PushBanner({ busy, onActivate, onDismiss }: { busy: boolean; onActivate: () => void; onDismiss: () => void }) {
  return <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
    <Bell size={18} className="shrink-0 text-[#0b2a5b]" />
    <p className="min-w-0 flex-1 text-[13px] font-medium text-slate-700">Alertes des nouveaux bordereaux</p>
    <button type="button" onClick={onActivate} disabled={busy} className="h-9 shrink-0 rounded-md px-3 text-[13px] font-bold text-white disabled:opacity-60" style={{ background: NAVY }}>{busy ? "…" : "Activer"}</button>
    <button type="button" onClick={onDismiss} aria-label="Fermer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-200"><X size={16} /></button>
  </div>;
}

const NAV_ITEMS: Array<[Tab, string, ReactNode]> = [
  ["home", "Accueil", <Home key="h" size={20} />],
  ["clients", "Clients", <Users key="c" size={20} />],
  ["colis", "Colis", <Package key="p" size={20} />],
  ["bordereaux", "Bordereaux", <FileText key="b" size={20} />],
  ["caisse", "Caisse", <Wallet key="w" size={20} />]
];

function SideNavigation({ tab, counts, onGo }: { tab: Tab; counts: { clients: number; colis: number; bordereaux: number }; onGo: (tab: Tab) => void }) {
  const countOf = (id: Tab) => id === "clients" ? counts.clients : id === "colis" ? counts.colis : id === "bordereaux" ? counts.bordereaux : undefined;
  return <aside className="sticky top-[4.25rem] hidden h-fit rounded-lg border border-slate-200 bg-white p-1.5 md:block">
    {NAV_ITEMS.map(([id, label, icon]) => <button key={id} type="button" onClick={() => onGo(id)} aria-current={tab === id ? "page" : undefined}
      className={cn("flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm transition", tab === id ? "bg-[#0b2a5b] font-bold text-white" : "text-slate-600 hover:bg-slate-50")}>
      <span className={tab === id ? "text-white" : "text-slate-400"}>{icon}</span><span className="min-w-0 flex-1">{label}</span>
      {typeof countOf(id) === "number" && <span className={cn("agent-mono text-xs", tab === id ? "text-white/70" : "text-slate-400")}>{countOf(id)}</span>}
    </button>)}
  </aside>;
}

function BottomNavigation({ tab, counts, onGo }: { tab: Tab; counts: { colis: number; bordereaux: number }; onGo: (tab: Tab) => void }) {
  return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Navigation">
    <div className="mx-auto grid max-w-xl grid-cols-5">{NAV_ITEMS.map(([id, label, icon]) => {
      const badge = id === "bordereaux" ? counts.bordereaux : 0;
      return <button key={id} type="button" onClick={() => onGo(id)} aria-current={tab === id ? "page" : undefined}
        className={cn("relative flex h-16 flex-col items-center justify-center gap-1 border-t-[2.5px] text-[11px] transition", tab === id ? "border-[#0b2a5b] font-extrabold text-[#0b2a5b]" : "border-transparent font-semibold text-slate-500")}>
        {icon}<span>{label}</span>
        {badge > 0 && <span className="agent-mono absolute right-[22%] top-2 grid h-4 min-w-4 place-items-center rounded-full bg-[#e85e19] px-1 text-[10px] font-semibold text-white">{badge}</span>}
      </button>;
    })}</div>
  </nav>;
}

/* ─────────────────────────── ACCUEIL ─────────────────────────── */
function HomeView({ search, onSearch, onSubmit, counts, pendingBons, onOpenBon, files, counter, balanceOf, onOpenClient, cash, paymentsCount, onCaisse, onGo }: {
  search: string; onSearch: (value: string) => void; onSubmit: () => void;
  counts: { counter: number; transit: number; today: number };
  pendingBons: ZoneBon[]; onOpenBon: (id: string) => void;
  files: Map<string, ClientFile>; counter: ZonePackage[]; balanceOf: (code: string) => { usd: number; htg: number };
  onOpenClient: (code: string) => void; cash: { usd: number; htg: number }; paymentsCount: number; onCaisse: () => void; onGo: (tab: Tab) => void;
}) {
  const byClient = new Map<string, number>();
  for (const item of counter) byClient.set(item.customer_code, (byClient.get(item.customer_code) ?? 0) + 1);
  const rows = Array.from(byClient.entries()).sort((a, b) => b[1] - a[1]);
  return <div className="space-y-3">
    <SearchField value={search} onChange={onSearch} onSubmit={onSubmit} />
    <Box className="grid grid-cols-3">
      {([["Au comptoir", counts.counter, "text-[#c2410c]", "colis"], ["En transit", counts.transit, "text-slate-900", "colis"], ["Livrés auj.", counts.today, "text-emerald-700", "colis"]] as const).map(([label, value, tone, target], index) =>
        <button key={label} type="button" onClick={() => onGo(target)} className={cn("px-3 py-2.5 text-left transition hover:bg-slate-50", index < 2 && "border-r border-slate-300")}>
          <FieldLabel>{label}</FieldLabel><p className={cn("mt-0.5 text-[26px] font-extrabold leading-tight tracking-tight", tone)}>{value}</p>
        </button>)}
    </Box>

    {pendingBons.length > 0 && <section className="rounded-lg border-[1.5px] border-dashed border-[#e85e19] bg-orange-50 px-3 py-2.5">
      <FieldLabel className="text-[#9a3412]">Bordereaux à pointer · {pendingBons.length}</FieldLabel>
      <div className="mt-1 divide-y divide-dashed divide-orange-300">{pendingBons.map((bon) => {
        const parcels = bon.parcels ?? [];
        const done = parcels.filter((p) => BON_PARCEL_DONE.has(p.status)).length;
        return <button key={bon.id} type="button" onClick={() => onOpenBon(bon.id)} className="flex w-full items-center gap-2 py-2 text-left">
          <span className="agent-mono flex-1 text-[13px] font-semibold">{bon.bon_number}</span>
          <span className="agent-mono text-[12px] text-slate-600">{done} / {parcels.length || bon.package_count}</span>
          <span className="text-[12px] text-slate-500">{dateText(bon.created_at)}</span>
          <ChevronRight size={16} className="text-orange-400" />
        </button>;
      })}</div>
    </section>}

    <div>
      <SectionTitle>Au comptoir · par client</SectionTitle>
      {rows.length ? <div className="border-y border-slate-200">{rows.slice(0, 30).map(([code, count]) => {
        const file = files.get(code);
        const balance = balanceOf(code);
        return <button key={code} type="button" onClick={() => onOpenClient(code)} className="grid w-full grid-cols-[88px_minmax(0,1fr)_34px_72px] items-center gap-2 border-b border-slate-100 px-1 py-2.5 text-left last:border-b-0 hover:bg-slate-50">
          <CodeTag code={code} central={file?.central} />
          <span className="truncate text-[14px] font-semibold">{file?.central ? "Compte central STANDA" : file?.name || "Client"}</span>
          <span className="agent-mono text-right text-[13px]">×{count}</span>
          <span className={cn("text-right text-[13px] font-bold", balance.usd > 0.01 ? "text-red-700" : "text-emerald-700")}>{balance.usd > 0.01 ? fmtUsd(balance.usd) : "Payé"}</span>
        </button>;
      })}</div> : <Empty text="Aucun colis au comptoir." />}
    </div>

    <button type="button" onClick={onCaisse} className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left text-white" style={{ background: NAVY }}>
      <div><FieldLabel className="text-white/65">Caisse à verser</FieldLabel><p className="mt-0.5 text-[18px] font-extrabold tracking-tight">{fmtUsd(cash.usd)} · {fmtHtg(cash.htg)}</p></div>
      <span className="text-[12px] text-white/70">{paymentsCount} encaissement{paymentsCount > 1 ? "s" : ""}</span>
    </button>
  </div>;
}

/* ─────────────────────────── CLIENTS ─────────────────────────── */
function ClientsView({ files, filter, onFilter, search, onSearch, balanceOf, onOpen }: {
  files: Map<string, ClientFile>; filter: ClientFilter; onFilter: (value: ClientFilter) => void; search: string; onSearch: (value: string) => void;
  balanceOf: (code: string) => { usd: number; htg: number }; onOpen: (code: string) => void;
}) {
  const all = Array.from(files.values());
  const counts = (file: ClientFile) => ({
    counter: file.packages.filter(atCounter).length,
    transit: file.packages.filter((item) => item.status !== DONE && !atCounter(item)).length
  });
  const matches: Record<ClientFilter, (file: ClientFile) => boolean> = {
    comptoir: (file) => counts(file).counter > 0,
    solde: (file) => balanceOf(file.code).usd > 0.01,
    transit: (file) => counts(file).transit > 0,
    tous: () => true
  };
  const needle = search.trim().toLowerCase();
  const needleDigits = digits(needle);
  const list = all.filter(matches[filter]).filter((file) => !needle || `${file.code} ${file.name}`.toLowerCase().includes(needle)
    || (needleDigits.length >= 4 && [file.card?.phone, file.card?.whatsapp].some((p) => digits(p ?? "").includes(needleDigits))))
    .sort((a, b) => counts(b).counter - counts(a).counter || balanceOf(b.code).usd - balanceOf(a.code).usd || a.code.localeCompare(b.code));
  return <div className="space-y-3">
    <SearchField value={search} onChange={onSearch} placeholder="Code, nom ou téléphone" />
    <Chips value={filter} onChange={onFilter} options={[["comptoir", "Au comptoir", all.filter(matches.comptoir).length], ["solde", "Solde dû", all.filter(matches.solde).length], ["transit", "En transit", all.filter(matches.transit).length], ["tous", "Tous", all.length]]} />
    {list.length ? <div className="border-y border-slate-200">
      <div className="grid grid-cols-[88px_minmax(0,1fr)_64px_72px] gap-2 px-1 py-1.5"><FieldLabel>Code</FieldLabel><FieldLabel>Client</FieldLabel><FieldLabel className="text-right">Colis</FieldLabel><FieldLabel className="text-right">Solde</FieldLabel></div>
      {list.map((file) => {
        const c = counts(file); const balance = balanceOf(file.code);
        return <button key={file.code} type="button" onClick={() => onOpen(file.code)} className="grid w-full grid-cols-[88px_minmax(0,1fr)_64px_72px] items-center gap-2 border-t border-slate-100 px-1 py-2.5 text-left hover:bg-slate-50">
          <CodeTag code={file.code} central={file.central} />
          <span className="min-w-0"><span className="block truncate text-[14px] font-semibold">{file.central ? "Compte central STANDA" : file.name || "Client"}</span>{file.card?.phone && <span className="agent-mono block truncate text-[11px] text-slate-500">{file.card.phone}</span>}</span>
          <span className="agent-mono text-right text-[12px]"><span className="font-semibold text-[#c2410c]">{c.counter}</span><span className="text-slate-400"> / {c.transit}</span></span>
          <span className={cn("text-right text-[13px] font-bold", balance.usd > 0.01 ? "text-red-700" : "text-slate-400")}>{balance.usd > 0.01 ? fmtUsd(balance.usd) : "·"}</span>
        </button>;
      })}
    </div> : <Empty text="Aucun client ne correspond." />}
    <p className="px-1 text-[11px] text-slate-400">Colis : au comptoir / en transit</p>
  </div>;
}

/* ─────────────────────────── FICHE CLIENT ─────────────────────────── */
function ClientPage({ file, zoneName, balance, activeTab, onTab, selectedPackageIds, locked, onToggle, onSelectAll, onOpenParcel, onOpenInvoice, onPay, onTicket, onOpenReceipt, payments }: {
  file: ClientFile; zoneName: string; balance: { usd: number; htg: number }; activeTab: ClientTab; onTab: (tab: ClientTab) => void;
  selectedPackageIds: string[]; locked: boolean; onToggle: (item: ZonePackage) => void; onSelectAll: (ids: string[]) => void;
  onOpenParcel: (id: string) => void; onOpenInvoice: (id: string) => void; onPay: (invoiceIds?: string[]) => void; onTicket: (packageId: string) => void;
  onOpenReceipt: (paymentId: string) => void; payments: AgentPayment[];
}) {
  const card = file.card;
  const active = file.packages.filter((item) => item.status !== DONE);
  const counterItems = sortPackagesAvailableFirst(active.filter(atCounter));
  const transitItems = sortPackagesAvailableFirst(active.filter((item) => !atCounter(item)));
  const deliveredItems = file.packages.filter((item) => item.status === DONE);
  const eligible = counterItems.filter(canReleaseParcel);
  const allSelected = eligible.length > 0 && eligible.every((item) => selectedPackageIds.includes(item.id));
  const unpaid = file.invoices.filter((invoice) => invoice.has_pdf && invoice.payment_status !== "Payé");
  const owes = balance.usd > 0.01;
  const tel = digits(card?.phone ?? "");
  const wa = digits(card?.whatsapp || card?.phone || "");
  const invoicePayments = file.invoices.flatMap((invoice) => invoice.payments.map((payment, index) => ({ ...payment, key: invoice.id + index, invoice })))
    .sort((a, b) => dateTimestamp(b.created_at) - dateTimestamp(a.created_at));
  const receiptFor = (invoiceId: string, createdAt: string) => payments.find((p) => p.invoice_id === invoiceId && p.created_at === createdAt)?.id;
  const tickets = groupTickets(deliveredItems);

  return <div className="space-y-3">
    <Box>
      <div className="flex items-start gap-3 border-b border-slate-300 px-3 py-2.5">
        <div className="min-w-0 flex-1"><FieldLabel>Destinataire</FieldLabel><p className="mt-0.5 text-[20px] font-extrabold leading-tight tracking-tight">{file.central ? "Compte central STANDA" : file.name || "Client"}</p></div>
        <CodeTag code={file.code} central={file.central} />
      </div>
      {!file.central && <div className="grid grid-cols-2">
        <Field label="Téléphone" mono value={card?.phone || "·"} className="border-b border-r border-slate-200" />
        <Field label="Pièce d'identité" mono value={card?.id_number ? `${card.id_type ? card.id_type + " " : ""}${card.id_number}` : "·"} className="border-b border-slate-200" />
        <Field label="Ville" value={zoneName} className="border-r border-slate-200" />
        <Field label="Compte" value={`${card?.account_type || "Personnel"}${card?.since ? " · depuis " + new Date(card.since).getFullYear() : ""}`} />
        {card?.pickup_location && <Field label="Point de retrait" value={card.pickup_location} className="col-span-2 border-t border-slate-200" />}
      </div>}
      {!file.central && (tel || wa) && <div className="grid grid-cols-2 border-t border-slate-300">
        {tel ? <a href={`tel:+${tel.length === 8 ? "509" + tel : tel}`} className="grid h-11 place-items-center border-r border-slate-300 text-[13px] font-bold text-slate-900 hover:bg-slate-50">Appeler</a> : <span className="border-r border-slate-300" />}
        {wa ? <a href={`https://wa.me/${wa.length === 8 ? "509" + wa : wa}`} target="_blank" rel="noopener noreferrer" className="grid h-11 place-items-center text-[13px] font-bold text-emerald-700 hover:bg-slate-50">WhatsApp</a> : <span />}
      </div>}
    </Box>

    {(owes || unpaid.length > 0) && <div className="flex items-center gap-3 rounded-lg border-[1.5px] border-red-300 bg-red-50 px-3 py-2.5">
      <div className="min-w-0 flex-1"><FieldLabel className="text-red-700">Solde dû</FieldLabel><p className="mt-0.5 text-[19px] font-extrabold tracking-tight text-red-800">{fmtUsd(balance.usd)} <span className="text-[13px] font-semibold text-slate-600">· {fmtHtg(balance.htg)}</span></p></div>
      {unpaid.length > 0 && <button type="button" onClick={() => onPay(unpaid.map((invoice) => invoice.id))} className="h-11 shrink-0 rounded-md bg-[#e85e19] px-4 text-[14px] font-extrabold text-white hover:bg-[#d4530f]">Encaisser</button>}
    </div>}

    <Box className="grid grid-cols-4 text-center">
      {([["En transit", transitItems.length, "", "colis"], ["Au comptoir", counterItems.length, "text-[#c2410c] bg-orange-50", "colis"], ["Factures", file.invoices.length, "", "factures"], ["Livrés", deliveredItems.length, "text-emerald-700", "livraisons"]] as const).map(([label, value, tone, target], index) =>
        <button key={label} type="button" onClick={() => onTab(target)} className={cn("py-2 transition hover:bg-slate-50", index < 3 && "border-r border-slate-300", tone)}>
          <p className="text-[17px] font-extrabold">{value}</p><p className="text-[10px] font-bold">{label}</p>
        </button>)}
    </Box>

    <div role="tablist" className="-mx-3 flex border-b border-slate-200 px-3 sm:mx-0 sm:px-0">
      {([["colis", "Colis"], ["factures", "Factures"], ["paiements", "Paiements"], ["livraisons", "Livraisons"]] as const).map(([id, label]) =>
        <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => onTab(id)}
          className={cn("h-11 flex-1 border-b-[2.5px] text-[13px] transition", activeTab === id ? "border-[#0b2a5b] font-extrabold text-[#0b2a5b]" : "border-transparent font-semibold text-slate-500")}>{label}</button>)}
    </div>

    {activeTab === "colis" && <div>
      {counterItems.length > 0 && <>
        <SectionTitle right={eligible.length > 1 ? <button type="button" disabled={locked} onClick={() => onSelectAll(eligible.map((item) => item.id))} className="text-[12px] font-bold text-[#0b2a5b] disabled:opacity-50">{allSelected ? "Tout décocher" : `Tout cocher (${eligible.length})`}</button> : undefined}>Au comptoir · {counterItems.length}</SectionTitle>
        <div className="border-y border-slate-200">{counterItems.map((item) => <ParcelLine key={item.id} item={item} selectable={canReleaseParcel(item) && !locked} selected={selectedPackageIds.includes(item.id)} onToggle={() => onToggle(item)} onOpen={() => onOpenParcel(item.id)} showSelector />)}</div>
        {counterItems.some((item) => !canReleaseParcel(item)) && <p className="px-1 pt-1.5 text-[12px] font-bold text-red-700">{releaseBlockReason(counterItems.find((item) => !canReleaseParcel(item))!)}</p>}
      </>}
      {transitItems.length > 0 && <>
        <SectionTitle>En transit · {transitItems.length}</SectionTitle>
        <div className="border-y border-slate-200">{transitItems.map((item) => <ParcelLine key={item.id} item={item} onOpen={() => onOpenParcel(item.id)} />)}</div>
      </>}
      {!counterItems.length && !transitItems.length && <div className="pt-3"><Empty text="Aucun colis en cours pour ce client." /></div>}
    </div>}

    {activeTab === "factures" && <div className="pt-1">{file.invoices.length ? <div className="border-y border-slate-200">{file.invoices.map((invoice) =>
      <button key={invoice.id} type="button" onClick={() => onOpenInvoice(invoice.id)} className="flex w-full items-center gap-3 border-b border-slate-100 px-1 py-2.5 text-left last:border-b-0 hover:bg-slate-50">
        <span className="min-w-0 flex-1"><span className="agent-mono block text-[13px] font-semibold">{invoice.invoice_number}</span><span className="block text-[12px] text-slate-500">{dateText(invoice.created_at)} · {invoice.package_count} colis · {invoice.delivery_status === "Livrée" ? "livrée" : "en cours"}</span></span>
        <span className="text-right"><span className="block text-[14px] font-extrabold">{fmtUsd(invoice.grand_total_usd)}</span><PaymentText status={invoice.payment_status} /></span>
        <ChevronRight size={16} className="shrink-0 text-slate-300" />
      </button>)}</div> : <Empty text="Aucune facture émise." />}</div>}

    {activeTab === "paiements" && <div className="pt-1">{invoicePayments.length ? <div className="border-y border-slate-200">{invoicePayments.map((payment) => {
      const receipt = receiptFor(payment.invoice.id, payment.created_at);
      return <div key={payment.key} className="flex items-center gap-3 border-b border-slate-100 px-1 py-2.5 last:border-b-0">
        <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">{payment.method}</span><span className="block text-[12px] text-slate-500"><span className="agent-mono">{payment.invoice.invoice_number}</span> · {dateTimeText(payment.created_at)} · {payment.by}</span></span>
        <span className="text-right"><span className="block text-[14px] font-extrabold text-emerald-700">+{payment.currency === "HTG" ? fmtHtg(payment.amount) : fmtUsd(payment.amount)}</span>{receipt && <button type="button" onClick={() => onOpenReceipt(receipt)} className="text-[12px] font-bold text-[#0b2a5b]">Reçu</button>}</span>
      </div>;
    })}</div> : <Empty text="Aucun paiement enregistré." />}</div>}

    {activeTab === "livraisons" && <div className="pt-1">{tickets.length ? <div className="border-y border-slate-200">{tickets.map((ticket) =>
      <button key={ticket.key} type="button" onClick={() => onTicket(ticket.packages[0].id)} className="flex w-full items-center gap-3 border-b border-slate-100 px-1 py-2.5 text-left last:border-b-0 hover:bg-slate-50">
        <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">Preuve de livraison</span><span className="block text-[12px] text-slate-500">{ticket.deliveredAt ? dateTimeText(ticket.deliveredAt) : "Date non archivée"} · {ticket.packages.length} colis{ticket.invoices.length ? <> · <span className="agent-mono">{ticket.invoices.join(" / ")}</span></> : null}</span></span>
        <ChevronRight size={16} className="shrink-0 text-slate-300" />
      </button>)}</div> : <Empty text="Aucun colis livré." />}</div>}
  </div>;
}

function Field({ label, value, mono = false, className }: { label: string; value: string; mono?: boolean; className?: string }) {
  return <div className={cn("min-w-0 px-3 py-2", className)}><FieldLabel>{label}</FieldLabel><p className={cn("mt-0.5 break-words text-[13px] font-semibold", mono && "agent-mono text-[12px]")}>{value}</p></div>;
}

function groupTickets(items: ZonePackage[]) {
  const byKey = new Map<string, { key: string; deliveredAt: string; packages: ZonePackage[]; invoices: string[] }>();
  for (const item of items) {
    const key = item.delivered_at || "sans-date|" + (item.invoice_id || item.id);
    const ticket = byKey.get(key) ?? { key, deliveredAt: item.delivered_at, packages: [], invoices: [] };
    ticket.packages.push(item);
    if (item.invoice_number && !ticket.invoices.includes(item.invoice_number)) ticket.invoices.push(item.invoice_number);
    byKey.set(key, ticket);
  }
  return Array.from(byKey.values()).sort((a, b) => dateTimestamp(b.deliveredAt) - dateTimestamp(a.deliveredAt));
}

/** Une ligne de colis (registre) : case à cocher séparée, la ligne ouvre la fiche colis. */
function ParcelLine({ item, selectable = false, selected = false, onToggle, onOpen, showSelector = false, client }: {
  item: ZonePackage; selectable?: boolean; selected?: boolean; onToggle?: () => void; onOpen: () => void; showSelector?: boolean; client?: ReactNode;
}) {
  const days = atCounter(item) ? daysSince(counterSince(item)) : 0;
  const old = days >= 14;
  return <div className={cn("flex items-center gap-2 border-b border-slate-100 last:border-b-0", selected && "bg-emerald-50", !selected && old && "bg-red-50/70")}>
    {showSelector && <button type="button" role="checkbox" aria-checked={selected} aria-label={`Sélectionner ${packageReference(item)}`} disabled={!selectable} onClick={onToggle}
      className="grid h-12 w-11 shrink-0 place-items-center disabled:cursor-not-allowed">
      <span className={cn("grid h-5 w-5 place-items-center rounded border-2 transition", selected ? "border-emerald-600 bg-emerald-600 text-white" : selectable ? "border-slate-900 bg-white" : "border-slate-300 bg-slate-100")}>{selected && <Check size={13} strokeWidth={3} />}</span>
    </button>}
    <button type="button" onClick={onOpen} className={cn("flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-1 text-left", !showSelector && "pl-1")}>
      <span className="min-w-0 flex-1">
        <span className="agent-mono block truncate text-[12.5px] font-semibold">{packageReference(item)}</span>
        <span className={cn("block truncate text-[12px]", old ? "font-bold text-red-700" : "text-slate-500")}>
          {Number(item.weight || 0).toFixed(2)} lb{item.content ? " · " + item.content : ""}{atCounter(item) ? ` · ${days} j` : ""}{item.is_special ? " · spécial" : ""}
        </span>
      </span>
      {client}
      <StatusText status={item.status} />
      <ChevronRight size={15} className="shrink-0 text-slate-300" />
    </button>
  </div>;
}

/* ─────────────────────────── FICHE COLIS ─────────────────────────── */
function ParcelPage({ item, zoneName, onOpenClient, onOpenInvoice, onPay, onRelease, releasing, onTicket, onCopy }: {
  item: ZonePackage; zoneName: string; onOpenClient: () => void; onOpenInvoice: (id: string) => void; onPay: () => void;
  onRelease: () => void; releasing: boolean; onTicket: () => void; onCopy: (value: string, label: string) => void;
}) {
  const days = atCounter(item) ? daysSince(counterSince(item)) : null;
  const amount = Number(item.price_usd || 0) + Number(item.tax_usd || 0);
  const dates: Record<string, string> = { ...(item.status_dates ?? {}) };
  if (!dates["Reçu à Miami"]) dates["Reçu à Miami"] = mcpackDate(item.created_date) || item.received_at || "";
  if (item.status === DONE && item.delivered_at) dates[DONE] = item.delivered_at;
  const currentIndex = TRACK_STEPS.indexOf(item.status);
  const steps = TRACK_STEPS.map((step, index) => ({ step, at: dates[step] ?? "", reached: index <= currentIndex || Boolean(dates[step]), current: step === item.status }))
    .filter((row) => row.at || row.current).reverse();
  const releasable = canReleaseParcel(item);
  const unpaid = Boolean(item.invoice_id) && item.invoice_payment_status !== "Payé";
  return <div className="space-y-3">
    <Box>
      <div className="border-b border-slate-300 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2"><FieldLabel>N° de guía</FieldLabel><StatusText status={item.status} /></div>
        <p className="agent-mono mt-0.5 break-all text-[20px] font-semibold leading-tight">{item.tracking_number || "·"}</p>
        <div aria-hidden="true" className="agent-barcode mt-2 h-8" />
        {item.tracking_manual && <button type="button" onClick={() => onCopy(item.tracking_manual, "N° de suivi")} className="agent-mono mt-2 inline-flex items-center gap-1.5 text-[12px] text-slate-600 hover:text-slate-900">Suivi · {item.tracking_manual}<Copy size={13} /></button>}
      </div>
      <div className="grid grid-cols-3">
        <Field label="Poids" value={`${Number(item.weight || 0).toFixed(2)} lb`} className="border-r border-slate-300" />
        <Field label="Quantité" value={String(item.quantity || 1)} className="border-r border-slate-300" />
        <div className="min-w-0 px-3 py-2"><FieldLabel>Au comptoir</FieldLabel><p className={cn("mt-0.5 text-[13px] font-extrabold", days !== null && days >= 14 ? "text-red-700" : "text-[#c2410c]")}>{days === null ? "·" : `${days} jour${days > 1 ? "s" : ""}`}</p></div>
      </div>
    </Box>

    {item.is_special && <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900"><span className="font-extrabold">Colis spécial</span>{item.special_reason ? ` · ${item.special_reason}` : ""}</div>}

    <dl className="grid grid-cols-[112px_minmax(0,1fr)] border-y border-slate-200 text-[13px]">
      <dt className="py-2 text-slate-500">Client</dt>
      <dd className="flex min-w-0 items-center gap-2 py-1.5"><CodeTag code={item.customer_code} central={item.is_central_account} onClick={onOpenClient} /><button type="button" onClick={onOpenClient} className="truncate font-bold underline-offset-2 hover:underline">{item.is_central_account ? "Compte central" : item.customer_name || "Client"}</button></dd>
      <Row label="Contenu" value={item.content || "·"} />
      <Row label="Conduce" value={item.conduce_number ? <><span className="agent-mono">{item.conduce_number}</span>{item.conduce_date ? ` · ${dateText(item.conduce_date + "T12:00:00")}` : ""}</> : "·"} />
      <Row label="Bordereau" value={item.bon_number ? <><span className="agent-mono">{item.bon_number}</span>{item.bon_received_by ? ` · pointé par ${item.bon_received_by}` : item.bon_received_at ? "" : " · à pointer"}</> : "·"} />
      <Row label="Facture" value={item.invoice_id ? <><button type="button" onClick={() => onOpenInvoice(item.invoice_id)} className="agent-mono font-semibold text-[#0b2a5b] underline underline-offset-2">{item.invoice_number}</button>{amount > 0 ? ` · ${fmtUsd(amount)}` : ""}</> : "En attente de facture"} />
      <Row label="Paiement" value={item.invoice_id ? <span className={cn("font-extrabold", item.invoice_payment_status === "Payé" ? "text-emerald-700" : "text-red-700")}>{item.invoice_payment_status === "Payé" ? "Facture payée" : item.invoice_payment_status === "Payé partiel" ? "Paiement partiel" : "Facture impayée"}</span> : "·"} />
      {item.status === DONE && <Row label="Livré" value={item.delivered_at ? dateTimeText(item.delivered_at) : "Date non archivée"} />}
      <Row label="Agence" value={zoneName} last />
    </dl>

    <div>
      <SectionTitle>Suivi</SectionTitle>
      <ol className="space-y-2 px-1">{steps.map((row) =>
        <li key={row.step} className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-2.5 text-[13px]">
          <span className={cn("h-2.5 w-2.5 rounded-[2px]", row.current ? (row.step === DONE || row.step === "Disponible" ? "bg-emerald-600" : "bg-[#0b2a5b]") : "border-2 border-slate-400")} />
          <span className={row.current ? "font-extrabold" : "text-slate-600"}>{statusLabel(row.step)}</span>
          <span className="agent-mono text-[12px] text-slate-500">{shortStamp(row.at)}</span>
        </li>)}</ol>
    </div>

    <div className="grid grid-cols-2 gap-2 pt-1">
      {item.invoice_id && <button type="button" onClick={() => onOpenInvoice(item.invoice_id)} className="h-12 rounded-lg border-[1.5px] border-slate-900 bg-white text-[14px] font-bold">Voir la facture</button>}
      {item.status === DONE ? <button type="button" onClick={onTicket} className="h-12 rounded-lg text-[14px] font-extrabold text-white" style={{ background: NAVY }}>Preuve de livraison</button>
        : releasable ? <button type="button" onClick={onRelease} disabled={releasing} className="flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-600 text-[14px] font-extrabold text-white disabled:opacity-60">{releasing && <Spinner size={16} />}Valider le retrait</button>
          : unpaid ? <button type="button" onClick={onPay} className="h-12 rounded-lg bg-[#e85e19] text-[14px] font-extrabold text-white">Encaisser</button> : null}
    </div>
  </div>;
}
function Row({ label, value, last = false }: { label: string; value: ReactNode; last?: boolean }) {
  return <><dt className={cn("border-t border-slate-100 py-2 text-slate-500", last && "")}>{label}</dt><dd className="min-w-0 break-words border-t border-slate-100 py-2 font-semibold">{value}</dd></>;
}

/* ─────────────────────────── COLIS ─────────────────────────── */
function ParcelsView({ packages, filter, onFilter, search, onSearch, onOpen, onOpenClient }: {
  packages: ZonePackage[]; filter: ParcelFilter; onFilter: (value: ParcelFilter) => void; search: string; onSearch: (value: string) => void;
  onOpen: (id: string) => void; onOpenClient: (code: string) => void;
}) {
  const [visible, setVisible] = useState(60);
  const groups: Record<ParcelFilter, ZonePackage[]> = {
    comptoir: sortPackagesAvailableFirst(packages.filter(atCounter)),
    transit: sortPackagesAvailableFirst(packages.filter((item) => item.status !== DONE && !atCounter(item))),
    livres: packages.filter((item) => item.status === DONE).sort((a, b) => dateTimestamp(b.delivered_at) - dateTimestamp(a.delivered_at))
  };
  const needle = search.trim().toLowerCase();
  const list = groups[filter].filter((item) => !needle || [item.tracking_number, item.tracking_manual, item.customer_code, item.customer_name, item.content, item.invoice_number].join(" ").toLowerCase().includes(needle));
  return <div className="space-y-3">
    <SearchField value={search} onChange={onSearch} placeholder="N° de guía, suivi, code client" />
    <Chips value={filter} onChange={(value) => { onFilter(value); setVisible(60); }} options={[["comptoir", "Au comptoir", groups.comptoir.length], ["transit", "En transit", groups.transit.length], ["livres", "Livrés", groups.livres.length]]} />
    {list.length ? <div className="border-y border-slate-200">{list.slice(0, visible).map((item) =>
      <ParcelLine key={item.id} item={item} onOpen={() => onOpen(item.id)} client={<CodeTag code={item.customer_code} central={item.is_central_account} size="sm" onClick={() => onOpenClient(item.customer_code)} />} />)}</div>
      : <Empty text="Aucun colis ne correspond." />}
    {list.length > visible && <button type="button" onClick={() => setVisible((n) => n + 60)} className="h-11 w-full rounded-lg border border-slate-300 text-sm font-bold text-[#0b2a5b]">Afficher plus</button>}
  </div>;
}

/* ─────────────────────────── BORDEREAUX ─────────────────────────── */
function BordereauxView({ bons, search, onSearch, onPoint, onPdf }: { bons: ZoneBon[]; search: string; onSearch: (value: string) => void; onPoint: (id: string) => void; onPdf: (id: string) => void }) {
  const needle = search.trim().toLowerCase();
  const list = needle ? bons.filter((bon) => bon.bon_number.toLowerCase().includes(needle)) : bons;
  const pending = list.filter((bon) => !bon.received_at);
  const done = list.filter((bon) => bon.received_at);
  return <div className="space-y-3">
    <SearchField value={search} onChange={onSearch} placeholder="N° de bordereau" />
    <div>
      <SectionTitle>À pointer · {pending.length}</SectionTitle>
      {pending.length ? <div className="rounded-lg border-[1.5px] border-dashed border-[#e85e19] bg-orange-50 px-3"><div className="divide-y divide-dashed divide-orange-300">{pending.map((bon) => {
        const parcels = bon.parcels ?? [];
        const received = parcels.filter((p) => BON_PARCEL_DONE.has(p.status)).length;
        return <div key={bon.id} className="flex items-center gap-2 py-2.5">
          <button type="button" onClick={() => onPoint(bon.id)} className="min-w-0 flex-1 text-left"><span className="agent-mono block text-[13px] font-semibold">{bon.bon_number}</span><span className="block text-[12px] text-slate-600"><span className="agent-mono">{received} / {parcels.length || bon.package_count}</span> pointés · {dateText(bon.created_at)}</span></button>
          {bon.has_pdf && <button type="button" onClick={() => onPdf(bon.id)} aria-label="PDF du bordereau" className="grid h-10 w-10 place-items-center rounded-md text-slate-500 hover:bg-orange-100"><FileDown size={17} /></button>}
          <button type="button" onClick={() => onPoint(bon.id)} className="h-10 rounded-md bg-[#e85e19] px-3 text-[13px] font-extrabold text-white">Pointer</button>
        </div>;
      })}</div></div> : <Empty text="Aucun bordereau à pointer." />}
    </div>
    <div>
      <SectionTitle>Pointés · {done.length}</SectionTitle>
      {done.length ? <div className="border-y border-slate-200">{done.slice(0, 80).map((bon) =>
        <button key={bon.id} type="button" onClick={() => onPdf(bon.id)} disabled={!bon.has_pdf} className="flex w-full items-center gap-3 border-b border-slate-100 px-1 py-2.5 text-left last:border-b-0 hover:bg-slate-50 disabled:cursor-default">
          <span className="min-w-0 flex-1"><span className="agent-mono block text-[13px] font-semibold">{bon.bon_number}</span><span className="block truncate text-[12px] text-slate-500">{bon.package_count} colis · {dateText(bon.received_at)}{bon.received_by ? ` · ${bon.received_by}` : ""}</span></span>
          {bon.has_pdf && <FileDown size={17} className="shrink-0 text-slate-400" />}
        </button>)}</div> : <Empty text="Aucun bordereau pointé." />}
    </div>
  </div>;
}

/** Pointage colis par colis. Le bouton de validation est fixé en haut, sous le pouce. */
function PointageSheet({ bon, busy, onClose, onConfirm }: { bon: ZoneBon; busy: boolean; onClose: () => void; onConfirm: (packageIds: string[]) => void }) {
  const parcels = bon.parcels ?? [];
  const [checked, setChecked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const todo = parcels.filter((p) => !BON_PARCEL_DONE.has(p.status));
  const done = parcels.filter((p) => BON_PARCEL_DONE.has(p.status));
  const q = query.trim().toLowerCase();
  const visible = q ? todo.filter((p) => `${p.tracking_number} ${p.tracking_manual} ${p.customer_code} ${p.content}`.toLowerCase().includes(q)) : todo;
  const toggle = (id: string) => setChecked((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const allChecked = todo.length > 0 && todo.every((p) => checked.includes(p.id));
  const count = checked.length;
  return <div role="dialog" aria-modal="true" aria-label={`Pointage du bordereau ${bon.bon_number}`} className="agent-font fixed inset-0 z-[90] flex flex-col bg-white">
    <div className="shrink-0 text-white" style={{ background: NAVY }}>
      <div className="flex items-center gap-2 px-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} disabled={busy} aria-label="Retour" className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-white/10 disabled:opacity-50"><ArrowLeft size={20} /></button>
        <div className="min-w-0 flex-1"><p className="agent-mono truncate text-[14px] font-semibold">{bon.bon_number}</p><p className="text-[12px] text-white/70">{count} pointé{count > 1 ? "s" : ""} sur {todo.length}</p></div>
        <button type="button" onClick={() => onConfirm(checked)} disabled={busy || count === 0}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-emerald-500 px-4 text-[14px] font-extrabold text-white disabled:bg-white/15 disabled:text-white/50">
          {busy ? <RefreshCw size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}Valider{count ? ` (${count})` : ""}
        </button>
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-2">
      {todo.length > 8 ? <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-300 px-2.5"><Search size={16} className="text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="N° de suivi ou code client" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none" /></label> : <span className="flex-1" />}
      {todo.length > 1 && <button type="button" onClick={() => setChecked(allChecked ? [] : todo.map((p) => p.id))} className="h-10 shrink-0 rounded-md border border-slate-300 px-3 text-[13px] font-bold text-[#0b2a5b]">{allChecked ? "Aucun" : "Tout"}</button>}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
      {todo.length === 0 ? <p className="px-6 py-12 text-center text-sm text-slate-600">Tous les colis de ce bordereau sont au comptoir.</p> : visible.length === 0 ? <p className="px-6 py-12 text-center text-sm text-slate-500">Aucun colis ne correspond.</p> :
        <div className="divide-y divide-slate-100">{visible.map((p) => {
          const on = checked.includes(p.id);
          return <button key={p.id} type="button" role="checkbox" aria-checked={on} disabled={busy} onClick={() => toggle(p.id)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition", on && "bg-emerald-50")}>
            <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded border-2 transition", on ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-900 bg-white")}>{on && <Check size={15} strokeWidth={3} />}</span>
            <span className="min-w-0 flex-1"><span className="agent-mono block break-all text-[13px] font-semibold">{p.tracking_number || p.tracking_manual || "Colis sans numéro"}</span><span className="block truncate text-[12px] text-slate-500"><span className="agent-mono">{p.customer_code}</span>{p.content ? ` · ${p.content}` : ""}</span></span>
          </button>;
        })}</div>}
      {done.length > 0 && <p className="px-4 py-3 text-center text-xs text-slate-500">{done.length} colis déjà au comptoir.</p>}
    </div>
  </div>;
}

/* ─────────────────────────── FACTURE ─────────────────────────── */
function InvoicePage({ invoice, packages, onOpenParcel, onOpenClient, onPdf, onPay }: { invoice: ZoneInvoice; packages: ZonePackage[]; onOpenParcel: (id: string) => void; onOpenClient: () => void; onPdf: () => void; onPay?: () => void }) {
  return <div className="space-y-3">
    <Box>
      <div className="flex items-start gap-3 border-b border-slate-300 px-3 py-2.5">
        <div className="min-w-0 flex-1"><FieldLabel>Facture</FieldLabel><p className="agent-mono mt-0.5 text-[18px] font-semibold">{invoice.invoice_number}</p><p className="text-[12px] text-slate-500">{dateText(invoice.created_at)} · {invoice.package_count} colis</p></div>
        <CodeTag code={invoice.customer_code} central={invoice.is_central_account} onClick={onOpenClient} />
      </div>
      <div className="grid grid-cols-2">
        <Field label="Total" value={fmtUsd(invoice.grand_total_usd)} className="border-b border-r border-slate-200" />
        <div className="border-b border-slate-200 px-3 py-2"><FieldLabel>Paiement</FieldLabel><div className="mt-1"><PaymentText status={invoice.payment_status} /></div></div>
        <Field label="Reçu" value={`${fmtUsd(invoice.payment_paid_usd)} · ${fmtHtg(invoice.payment_paid_htg)}`} className="border-r border-slate-200" />
        <div className="px-3 py-2"><FieldLabel>Solde</FieldLabel><p className={cn("mt-0.5 text-[13px] font-extrabold", invoice.amount_due_usd > 0.01 ? "text-red-700" : "text-emerald-700")}>{fmtUsd(invoice.amount_due_usd)}</p><p className="text-[11px] text-slate-500">{fmtHtg(invoice.amount_due_htg)}</p></div>
      </div>
      {invoice.deposit_usd > 0 && <Field label="Acompte" value={fmtUsd(invoice.deposit_usd)} className="border-t border-slate-200" />}
    </Box>
    {invoice.payments.length > 0 && <div><SectionTitle>Paiements</SectionTitle><div className="border-y border-slate-200">{invoice.payments.map((payment, index) =>
      <div key={index} className="flex items-center gap-3 border-b border-slate-100 px-1 py-2 last:border-b-0"><span className="min-w-0 flex-1 text-[13px]"><span className="font-semibold">{payment.method}</span><span className="text-slate-500"> · {dateTimeText(payment.created_at)} · {payment.by}</span></span><span className="text-[13px] font-extrabold text-emerald-700">+{payment.currency === "HTG" ? fmtHtg(payment.amount) : fmtUsd(payment.amount)}</span></div>)}</div></div>}
    <div><SectionTitle>Colis · {packages.length}</SectionTitle>{packages.length ? <div className="border-y border-slate-200">{packages.map((item) => <ParcelLine key={item.id} item={item} onOpen={() => onOpenParcel(item.id)} />)}</div> : <Empty text="Aucun colis associé." />}</div>
    <div className="grid grid-cols-2 gap-2">
      {invoice.has_pdf && <button type="button" onClick={onPdf} className="flex h-12 items-center justify-center gap-2 rounded-lg border-[1.5px] border-slate-900 text-[14px] font-bold"><FileDown size={17} />PDF</button>}
      {onPay && <button type="button" onClick={onPay} className="h-12 rounded-lg bg-[#e85e19] text-[14px] font-extrabold text-white">Encaisser</button>}
    </div>
  </div>;
}

/* ─────────────────────────── CAISSE ─────────────────────────── */
const METHOD_ORDER = ["Espèces", "MonCash", "NatCash", "Zelle"];
function methodLabel(method: string) {
  const value = (method || "").trim();
  if (/^(esp[eè]ces?|cash)$/i.test(value)) return "Espèces";
  if (/^mon\s*cash$/i.test(value)) return "MonCash";
  if (/^nat\s*cash$/i.test(value)) return "NatCash";
  if (/^zelle$/i.test(value)) return "Zelle";
  return value || "Non précisé";
}

function CaisseView({ agentName, zoneName, payments, balances, deliveries, onSendReport, onOpenInvoice, onOpenClient, onStartPayment, onOpenReceipt }: {
  agentName: string; zoneName: string; payments: AgentPayment[]; balances: CustomerBalanceReport[]; deliveries: ZonePackage[];
  onSendReport: (pdfBase64: string, summary: string) => Promise<void>; onOpenInvoice: (invoiceId: string) => void; onOpenClient: (code: string) => void;
  onStartPayment: (customerCode: string) => void; onOpenReceipt: (paymentId: string) => void;
}) {
  const [pdfBusy, setPdfBusy] = useState<"download" | "send" | null>(null);
  // Période du rapport : depuis le plus ancien encaissement non clôturé (sinon aujourd'hui).
  const since = payments.reduce((min, payment) => payment.created_at && payment.created_at < min ? payment.created_at : min,
    new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
  const reportDeliveries = deliveries.filter((item) => item.delivered_at && item.delivered_at >= since).sort((a, b) => b.delivered_at.localeCompare(a.delivered_at));
  const buildPdf = async () => {
    const { buildAgentReportPdf } = await import("@/lib/agent-report-pdf");
    return buildAgentReportPdf({
      agentName, zone: zoneName, since, payments, balances,
      deliveries: reportDeliveries.map((item) => ({ customer_code: item.customer_code, customer_name: item.customer_name, tracking: packageReference(item), invoice_number: item.invoice_number, delivered_at: item.delivered_at }))
    });
  };
  const downloadPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy("download");
    try { const { doc, fileName } = await buildPdf(); doc.save(fileName); }
    catch (error) { notify.error(error instanceof Error ? error.message : "PDF impossible", { small: true }); }
    finally { setPdfBusy(null); }
  };
  const sendPdf = async () => {
    if (pdfBusy) return;
    if (!window.confirm("Envoyer le rapport de caisse à l'administration ?")) return;
    setPdfBusy("send");
    try {
      const { doc, cash } = await buildPdf();
      const pdf = String(doc.output("datauristring")).split(",").pop() ?? "";
      const summary = `Caisse ${fmtUsd(cash.usd)} · ${fmtHtg(cash.htg)} · ${payments.length} encaissement(s) · ${reportDeliveries.length} colis livré(s) · ${balances.length} client(s) avec solde`;
      await onSendReport(pdf, summary);
      notify.success("L'administration a reçu le rapport de caisse.", { title: "Rapport envoyé" });
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Envoi impossible.", { title: "Rapport non envoyé" });
    } finally { setPdfBusy(null); }
  };
  const totals = cashTotals(payments);
  const rows = new Map<string, { usd: number; htg: number; count: number }>(METHOD_ORDER.map((label) => [label, { usd: 0, htg: 0, count: 0 }]));
  for (const payment of payments) {
    const label = methodLabel(payment.payment_method);
    const row = rows.get(label) ?? { usd: 0, htg: 0, count: 0 };
    if (payment.currency === "HTG") row.htg += Number(payment.amount || 0); else row.usd += Number(payment.amount || 0);
    row.count += 1;
    rows.set(label, row);
  }
  const amountOf = (payment: AgentPayment) => payment.currency === "HTG" ? fmtHtg(payment.amount) : fmtUsd(payment.amount);
  return <div className="space-y-3">
    <section className="rounded-lg px-4 py-4 text-white" style={{ background: NAVY }}>
      <FieldLabel className="text-white/65">Caisse à verser · {agentName}</FieldLabel>
      <p className="mt-1 text-[30px] font-extrabold leading-tight tracking-tight">{fmtUsd(totals.usd)}</p>
      <p className="text-[15px] text-white/80">{fmtHtg(totals.htg)}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/15 pt-2.5 text-[12px]">
        <div><p className="text-white/60">Encaissements</p><p className="agent-mono text-[15px] font-semibold">{payments.length}</p></div>
        <div><p className="text-white/60">Soldes clients</p><p className="agent-mono text-[15px] font-semibold">{balances.length}</p></div>
      </div>
    </section>
    <div className="grid grid-cols-2 gap-2">
      <button type="button" disabled={!!pdfBusy} onClick={() => void sendPdf()} className="flex h-12 items-center justify-center gap-2 rounded-lg bg-[#e85e19] text-[14px] font-extrabold text-white disabled:opacity-60">{pdfBusy === "send" ? <Spinner size={16} /> : <FileText size={17} />}Envoyer le rapport</button>
      <button type="button" disabled={!!pdfBusy} onClick={() => void downloadPdf()} className="flex h-12 items-center justify-center gap-2 rounded-lg border-[1.5px] border-slate-900 text-[14px] font-bold disabled:opacity-60">{pdfBusy === "download" ? <Spinner size={16} /> : <FileDown size={17} />}PDF</button>
    </div>
    <Box>{Array.from(rows, ([label, row], index) => <div key={label} className={cn("flex items-center gap-3 px-3 py-2.5", index > 0 && "border-t border-slate-200")}>
      <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold">{label}{label === "Zelle" && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">hors caisse</span>}</span><span className="agent-mono block text-[11px] text-slate-500">{row.count} encaissement{row.count > 1 ? "s" : ""}</span></span>
      <span className="text-right"><span className={cn("block text-[14px] font-extrabold", !row.count && "text-slate-400")}>{fmtUsd(row.usd)}</span><span className="block text-[11px] text-slate-500">{fmtHtg(row.htg)}</span></span>
    </div>)}</Box>

    <div><SectionTitle>Encaissements · {payments.length}</SectionTitle>
      {payments.length ? <div className="border-y border-slate-200">{payments.map((payment) => <div key={payment.id} className="flex items-center gap-2 border-b border-slate-100 px-1 py-2.5 last:border-b-0">
        <CodeTag code={payment.customer_code} onClick={() => onOpenClient(payment.customer_code)} />
        <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{methodLabel(payment.payment_method)}{payment.payment_reference ? ` · ${payment.payment_reference}` : ""}</span>
          <span className="block text-[12px] text-slate-500"><button type="button" onClick={() => onOpenInvoice(payment.invoice_id)} className="agent-mono font-semibold text-[#0b2a5b]">{payment.invoice_number}</button> · {dateText(payment.created_at)} · <button type="button" onClick={() => onOpenReceipt(payment.id)} className="font-bold text-[#0b2a5b]">Reçu</button></span></span>
        <span className="shrink-0 text-[13px] font-extrabold text-emerald-700">+{amountOf(payment)}</span>
      </div>)}</div> : <Empty text="Aucun encaissement depuis la dernière clôture." />}
    </div>

    <div><SectionTitle>Soldes clients · {balances.length}</SectionTitle>
      {balances.length ? <div className="border-y border-slate-200">{balances.map((balance) => <div key={balance.customer_code} className="flex items-center gap-2 border-b border-slate-100 px-1 py-2.5 last:border-b-0">
        <CodeTag code={balance.customer_code} onClick={() => onOpenClient(balance.customer_code)} />
        <button type="button" onClick={() => onOpenClient(balance.customer_code)} className="min-w-0 flex-1 text-left"><span className="block truncate text-[13px] font-semibold">{balance.customer_name || "Client"}</span><span className="block text-[12px] text-slate-500">{fmtUsd(balance.balance_usd)} · {balance.invoice_count} facture{balance.invoice_count > 1 ? "s" : ""}</span></button>
        <button type="button" onClick={() => onStartPayment(balance.customer_code)} className="h-9 shrink-0 rounded-md bg-[#e85e19] px-3 text-[12px] font-extrabold text-white">Encaisser</button>
      </div>)}</div> : <Empty text="Aucun client avec un solde." />}
    </div>
    <p className="px-1 text-[11px] leading-5 text-slate-400">Zelle arrive sur le compte STANDA. À la clôture par l'administration, la caisse repart à zéro.</p>
  </div>;
}

function SettingsView({ agentName, pushPermission, pushBusy, onActivate }: { agentName: string; pushPermission: PushPermission; pushBusy: boolean; onActivate: () => void }) {
  const state = {
    checking: ["Vérification…", "text-slate-600"],
    granted: ["Notifications activées", "text-emerald-700"],
    default: ["Notifications non activées", "text-amber-700"],
    denied: ["Notifications refusées dans les réglages de l'appareil", "text-red-700"],
    unsupported: ["Notifications indisponibles sur cet appareil", "text-slate-600"]
  }[pushPermission] as [string, string];
  return <div className="mx-auto max-w-2xl space-y-3">
    <Box className="px-3 py-3"><FieldLabel>Agent</FieldLabel><p className="mt-0.5 text-[16px] font-extrabold">{agentName}</p></Box>
    <Box className="px-3 py-3">
      <FieldLabel>Notifications</FieldLabel>
      <p className={cn("mt-1 text-[14px] font-bold", state[1])}>{state[0]}</p>
      {pushPermission === "default" && <button type="button" onClick={onActivate} disabled={pushBusy} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg text-[14px] font-extrabold text-white disabled:opacity-60" style={{ background: NAVY }}><BellRing size={18} />{pushBusy ? "Activation…" : "Activer"}</button>}
    </Box>
    <Box className="p-1.5"><PwaInstallButton variant="row" appName="STANDA Retrait" /></Box>
  </div>;
}

/* ─────────────────────────── CONFIRMATIONS ─────────────────────────── */
/** Barre fixe : « Valider le retrait » toujours visible au-dessus de la navigation. */
function ReleaseBar({ customerCode, count, busy, onConfirm, onClear }: { customerCode: string; count: number; busy: boolean; onConfirm: () => void; onClear: () => void }) {
  return <div role="region" aria-label="Valider le retrait" className="agent-font fixed inset-x-2 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-xl md:bottom-5">
    <div className="flex items-center gap-2 rounded-lg border-[1.5px] border-slate-900 bg-white p-2 shadow-[0_10px_30px_rgba(15,23,42,0.18)]">
      <button type="button" onClick={onClear} disabled={busy} aria-label="Annuler la sélection" className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X size={18} /></button>
      <div className="min-w-0 flex-1"><p className="agent-mono truncate text-[13px] font-semibold">{customerCode || "Client"}</p><p className="text-[12px] font-bold text-emerald-700">{count} colis sélectionné{count > 1 ? "s" : ""}</p></div>
      <button type="button" onClick={onConfirm} disabled={busy} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-[14px] font-extrabold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-70">{busy ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}Valider le retrait</button>
    </div>
  </div>;
}

/** Grande coche verte plein écran (grandes opérations). */
function BigConfirmation({ title, text }: { title: string; text: string }) {
  return <div role="status" aria-live="polite" className="agent-font fixed inset-0 z-[160] grid place-items-center bg-white px-6">
    <div className="text-center">
      <div className="sd-pop mx-auto grid h-28 w-28 place-items-center rounded-full bg-emerald-600 shadow-[0_18px_50px_rgba(16,185,129,0.4)]">
        <svg viewBox="0 0 24 24" className="h-16 w-16" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path className="sd-check" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </div>
      <p className="mt-6 text-[26px] font-extrabold tracking-tight">{title}</p>
      <p className="agent-mono mt-1 text-[15px] text-slate-600">{text}</p>
    </div>
  </div>;
}

/** Juste après un encaissement : proposer le retrait des colis devenus retirables. */
function RemiseOffer({ offer, busy, onRelease, onLater }: { offer: { customerCode: string; packageIds: string[]; paymentText: string }; busy: boolean; onRelease: () => void; onLater: () => void }) {
  const count = offer.packageIds.length;
  return <div role="dialog" aria-modal="true" aria-labelledby="remise-offer-title" className="agent-font fixed inset-0 z-[140] flex flex-col items-center justify-center overflow-y-auto bg-white px-6 py-8 text-center">
    <div className="w-full max-w-md">
      <div className="sd-pop mx-auto grid h-24 w-24 place-items-center rounded-full bg-emerald-600">
        <svg viewBox="0 0 24 24" className="h-14 w-14" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path className="sd-check" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </div>
      <h2 id="remise-offer-title" className="mt-6 text-[24px] font-extrabold tracking-tight">Paiement encaissé</h2>
      <p className="agent-mono mt-1 text-[14px] text-slate-500">{offer.customerCode}</p>
      <p className="mx-auto mt-3 whitespace-pre-line text-[15px] leading-relaxed text-slate-600">{offer.paymentText}</p>
      <p className="mx-auto mt-5 rounded-lg border border-dashed border-[#e85e19] bg-orange-50 px-4 py-3 text-[14px] font-bold text-[#9a3412]">{count} colis au comptoir</p>
      <button type="button" autoFocus disabled={busy} onClick={onRelease} className="mx-auto mt-6 flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 text-[15px] font-extrabold text-white disabled:opacity-60">{busy && <Spinner size={18} />}Valider le retrait</button>
      <button type="button" disabled={busy} onClick={onLater} className="mx-auto mt-3 flex h-11 w-full max-w-xs items-center justify-center rounded-lg border border-slate-300 text-[14px] font-bold text-slate-600">Plus tard</button>
    </div>
  </div>;
}
