"use client";
/*
 * STANDA COMMERCIAL — ESPACE CLIENT (V12)
 * ═══════════════════════════════════════
 * ACCUEIL : 4 liy klikab (Disponibles · Réceptions · Factures · Historique)
 *           + Demandes de retrait ak detay koli yo.
 *
 * LOJIK KOLI
 *   RÉCEPTIONS  = tout koli ki rive epi ki POKO fakti (Disponibles anlè).
 *   DISPONIBLES = sou-ansanm Réceptions.
 *   FACTURÉS = rete sou fakti kliyan an jouk remise a konfime.
 *   LIVRÉS = soti nan lis aktif yo pou ale nan HISTORIQUE.
 *
 * PRI (V12) — règ STANDA:
 *   • Koli ki DEJA fakti  -> pri REYÈL admin nan fikse a (total_usd). Pa gen devinèt.
 *   • Koli ki poko fakti  -> ESTIMASYON GLOBAL sèlman, montre yon sèl fwa anlè lis la:
 *       Business : tout pwa yo adisyone ANVAN × pri/lb Business
 *       Lòt kont: ti koli 0.10–0.99 lb -> pri fiks (Paramètres) ; sinon pwa × pri/lb
 *       Nan toude ka: pwa total ≥ 6.50 lb -> + 10 USD taxe fiks (yon sèl fwa)
 *     Nou PA mete yon pri sou chak kat koli ankò — sa te bay chif fo
 *     (li t ap ajoute frè fiks vil la sou CHAK koli).
 *
 * ⚠️ TOUT hooks yo deklare ANVAN nenpòt `return` kondisyonèl (règ React).
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Ban, Bell, BellRing, BookOpen, Calculator, ChevronDown, CircleCheck,
  ChevronRight, Clock, FileText, HelpCircle, KeyRound, LogOut, MapPin,
  MessageCircle, PackageCheck, Phone, ReceiptText, RefreshCw, Route, Search, ShieldCheck, Store, Trash2, Truck, X
} from "lucide-react";
import DeleteAccountModal from "@/components/DeleteAccountModal";
import HermesChat from "@/components/HermesChat";
import { supabase } from "@/lib/supabase";
import { safeMessage } from "@/lib/safeerror";
import {
  createRetrait, getClientByAuthId, getClientPackagesAndInvoices,
  getClientRetraits, getSmallParcelConfig
} from "@/lib/db";
import { Agence, getAgences } from "@/lib/agences";
import { getPushPermissionState, isPushSupported, subscribeToPush } from "@/lib/push";
import { Client, Invoice, INTERNAL_STATUSES, Pkg, Retrait } from "@/lib/types";
import { DEPOT } from "@/lib/depot";
import { SUPPORT_PHONE } from "@/lib/branding";
import {
  DEFAULT_SMALL_PARCEL, SmallParcelConfig, TAX_FIXED_USD, TAX_THRESHOLD_LB,
  estimateForPackages, round2
} from "@/lib/pricing";
import { dateFr, usd } from "@/lib/utils";
import { specialPackageInfo } from "@/lib/special-package";
import { hasSignificantInvoiceBalance, invoicePayableAmounts, invoiceRemainingAmounts, paymentStatusFromAmounts } from "@/lib/invoice-payable";
import Loader, { BusyButton, SavedToast, Spinner, SuccessCheck } from "@/components/Loader";
import StatusBadge from "@/components/StatusBadge";
import { StatusTimeline } from "@/components/StatusFlow";
import { WhatsAppIcon } from "@/components/site/BrandIcons";
import { openSecureDocument } from "@/lib/secure-document";
import { ClientLogisticsDashboard, ClientTrackingDetails } from "@/components/ClientLogisticsDashboard";

import { useNoticeToast } from "@/lib/notify";
type View = "home" | "disponibles" | "colisFactures" | "receptions" | "factures" | "historique" | "retraits" | "notifications" | "adresse" | "calc" | "infos";
type NoticeKind = "available" | "invoice" | "pickup" | "shipment";
type ClientNotice = {
  id: string;
  key: string;
  title: string;
  description: string;
  stamp: string;
  to: View;
  kind: NoticeKind;
};

const WA_NUM = SUPPORT_PHONE.replace(/\D/g, "");
const WA_LINK = `https://wa.me/${WA_NUM}`;
const NOTICE_STORAGE_PREFIX = "standa:client-notification-reads:";
const NOTICE_METADATA_KEY = "standa_notification_reads";

function localReadKeys(userId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(`${NOTICE_STORAGE_PREFIX}${userId}`);
    const value: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(value) ? value.filter((key): key is string => typeof key === "string").slice(-40) : []);
  } catch {
    return new Set();
  }
}

function saveLocalReadKeys(userId: string, keys: Set<string>) {
  try {
    window.localStorage.setItem(`${NOTICE_STORAGE_PREFIX}${userId}`, JSON.stringify([...keys].slice(-40)));
  } catch {
    // L'aplikasyon an kontinye fonksyone menm si navigatè a entèdi storage.
  }
}

function metadataReadKeys(value: unknown): Set<string> {
  return new Set(Array.isArray(value) ? value.filter((key): key is string => typeof key === "string").slice(-40) : []);
}

// Empreinte courte et déterministe : elle sert seulement à reconnaître un avis
// déjà lu, jamais à protéger une donnée ni à identifier un client.
function noticeKey(kind: string, ...parts: Array<string | undefined | null>): string {
  const source = [kind, ...parts.map((part) => String(part ?? ""))].join("|");
  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) hash = (hash * 33) ^ source.charCodeAt(index);
  return `${kind}:${(hash >>> 0).toString(36)}`;
}

/**
 * Lyen WhatsApp pou yon koli — Tracking Number ak Tracking ID nan TÈT mesaj la,
 * konsa ekip la wè imedyatman de ki koli kliyan an ap pale.
 */
function waPkgLink(p: Pkg, code: string): string {
  const tn = String(p.tracking_manual ?? "").trim() || "—";
  const id = String(p.tracking_number ?? "").trim() || "—";
  const msg =
    `Tracking Number: ${tn}\n` +
    `Tracking ID: ${id}\n` +
    `Client: ${code}\n\n` +
    `Bonjou STANDA COMMERCIAL, mwen gen yon kesyon sou koli sa a.`;
  return `https://wa.me/${WA_NUM}?text=${encodeURIComponent(msg)}`;
}

/** Yon fakti prepare koli a pou remise; se livrezon ki fè li antre nan historique. */
const isInvoiced = (p: Pkg) => p.status === "Facturé" || Boolean(p.invoice_id);
const isDelivered = (p: Pkg) => p.status === "Livré";

export default function EspaceClientPage() {
  // ── HOOKS (tout ansanm, anvan tout return) ──────────────────────────────
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [invs, setInvs] = useState<Invoice[]>([]);
  const [retraits, setRetraits] = useState<Retrait[]>([]);
  const [agences, setAgences] = useState<Agence[]>([]);
  const [smallCfg, setSmallCfg] = useState<SmallParcelConfig>(DEFAULT_SMALL_PARCEL);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authUserMetadata, setAuthUserMetadata] = useState<Record<string, unknown>>({});
  const [readNoticeKeys, setReadNoticeKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [view, setView] = useState<View>("home");
  const [detail, setDetail] = useState<Pkg | null>(null);
  const [trackQuery, setTrackQuery] = useState("");
  const [openRetrait, setOpenRetrait] = useState<string | null>(null);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useNoticeToast(msg, setMsg);
  const [toast, setToast] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  useNoticeToast(pwdMsg, setPwdMsg);
  const [pwdBusy, setPwdBusy] = useState(false);

  const [calcW, setCalcW] = useState("");
  const [showPushBanner, setShowPushBanner] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [retraitConfirmedCount, setRetraitConfirmedCount] = useState<number | null>(null);

  const load = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) { router.replace("/espace-client/connexion"); return; }
    const userId = data.user.id;
    const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    setAuthUserId(userId);
    setAuthUserMetadata(metadata);
    const cachedReads = localReadKeys(userId);
    const remoteReads = metadataReadKeys(metadata[NOTICE_METADATA_KEY]);
    const mergedReads = new Set([...cachedReads, ...remoteReads]);
    setReadNoticeKeys(mergedReads);
    saveLocalReadKeys(userId, mergedReads);

    const [c, cfg, ag] = await Promise.all([
      getClientByAuthId(userId),
      getSmallParcelConfig(),
      getAgences().catch(() => [])
    ]);

    setClient(c); setSmallCfg(cfg); setAgences(ag);
    if (c?.customer_code) {
      const [{ pkgs: p, invs: i }, rs] = await Promise.all([
        getClientPackagesAndInvoices(c.customer_code),
        getClientRetraits(c.customer_code)
      ]);
      setPkgs(p); setInvs(i); setRetraits(rs);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [router]);

  /**
   * Premye koneksyon sou APARÈY sa a: montre demann otorizasyon an pou KLIYAN
   * sa a. Demann natif la dwe soti apre yon klik "Activer"; Chrome, Safari ak
   * Android bloke demann ki lanse otomatikman san aksyon kliyan an.
   *
   * "v2" (2026-09-27): STANDA mande pou TOUT kliyan jwenn demann sa a ankò,
   * menm sa ki te fè "Pas maintenant" anvan — clé localStorage la chanje non
   * yon sèl fwa pou sa. Yon dezyèm "Pas maintenant" apre jodi a rete respekte
   * san nou pa re-mande chak jou (pa gen okenn lòt chanjman pou vèsyon sa a).
   */
  const PUSH_DISMISS_KEY_PREFIX = "standa:push-permission-dismissed-v2:";
  useEffect(() => {
    const customerCode = client?.customer_code;
    if (!customerCode || !isPushSupported()) return;
    let dismissed = false;
    try { dismissed = window.localStorage.getItem(`${PUSH_DISMISS_KEY_PREFIX}${customerCode}`) === "1"; } catch { /* ignore */ }
    if (dismissed) return;
    getPushPermissionState().then((state) => setShowPushBanner(state === "default"));
  }, [client?.customer_code]);

  const dismissPushBanner = () => {
    setShowPushBanner(false);
    try {
      if (client?.customer_code) window.localStorage.setItem(`${PUSH_DISMISS_KEY_PREFIX}${client.customer_code}`, "1");
    } catch { /* ignore */ }
  };

  const activatePush = async () => {
    if (!client?.customer_code || pushBusy) return;
    setPushBusy(true);
    try {
      const r = await subscribeToPush(client.customer_code);
      if (r.ok) { setToast("Notifications activées."); dismissPushBanner(); }
      else if (r.reason === "denied") { setToast("Notifications refusées — activez-les depuis les réglages de votre navigateur si vous changez d'avis."); dismissPushBanner(); }
      // "timeout" (réseau lent, service worker pas encore prêt) : la bannière
      // reste affichée pour que le client puisse simplement réessayer.
      else if (r.reason === "timeout") setToast("La demande a pris trop de temps. Vérifiez votre connexion et réessayez.");
      else setToast("Impossible d'activer les notifications pour le moment.");
    } finally { setPushBusy(false); }
  };

  /**
   * MIZAJOU OTOMATIK (pwen 4) — chanjman admin fè nan Paramètres (tarif, ti koli,
   * statut koli) desann pou kont yo: lè kliyan an retounen sou onglè a, epi chak
   * 60 segond pandan app la louvri. Silansye: pa gen spinner, pa gen toast.
   */
  useEffect(() => {
    const silent = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", silent);
    window.addEventListener("focus", silent);
    const timer = setInterval(silent, 60000);
    return () => {
      document.removeEventListener("visibilitychange", silent);
      window.removeEventListener("focus", silent);
      clearInterval(timer);
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  // ── Aksyon ──────────────────────────────────────────────────────────────
  /**
   * ACTUALISER (pwen 6) — remonte TOUT done yo: pwofil, tarif (Paramètres),
   * koli, fakti, demann retrait. Ansyen done yo rete sou ekran an pandan tan
   * an (koli yo pa disparèt), yo ranplase sèlman lè nouvo yo fin desann.
   * Ilustrasyon an ap vire jiskaske li fini, epi ✅ vèt la parèt.
   */
  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    window.location.reload();
  };
  const logout = async () => { await supabase.auth.signOut(); router.replace("/espace-client/connexion"); };

  const changePassword = async () => {
    setPwdMsg(null);
    if (pwd1.length < 6) { setPwdMsg("Le mot de passe doit contenir au moins 6 caractères."); return; }
    if (pwd1 !== pwd2) { setPwdMsg("Les deux mots de passe ne correspondent pas."); return; }
    setPwdBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd1 });
      if (error) throw error;
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        // Le mot de passe vit uniquement dans Supabase Auth. Cette écriture
        // supprime aussi un ancien marqueur de changement obligatoire.
        await supabase.from("clients").update({ must_change_password: false }).eq("auth_user_id", auth.user.id);
      }
      setPwd1(""); setPwd2("");
      setShowPwd(false); setPwdMsg(null);
      setToast("Votre mot de passe a été modifié");
    } catch (e: unknown) { setPwdMsg(safeMessage(e)); }
    finally { setPwdBusy(false); }
  };

  const toggleSel = (id: string) =>
    setSel((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const notifierRetrait = async () => {
    if (!client || !sel.size) return;
    // GAD: sèlman koli "Disponible" ka antre nan yon demann retrait.
    const chosen = pkgs.filter((p) => sel.has(p.id) && p.status === "Disponible");
    if (!chosen.length) { setMsg("Seuls les colis disponibles peuvent être ajoutés à une demande de retrait."); return; }
    setBusy(true);
    try {
      await createRetrait(client, chosen);
      setRetraits(await getClientRetraits(client.customer_code));
      setSel(new Set());
      setMsg(null);
      setRetraitConfirmedCount(chosen.length);
    } catch (e: unknown) { setMsg(safeMessage(e)); }
    finally { setBusy(false); }
  };

  /**
   * BOUTON/JÈS "TOUNEN" TELEFÒN NAN (Android) — PA DWE KITE APP LA.
   * ═══════════════════════════════════════════════════════════════════
   * App la itilize yon sèl "page" (/espace-client) epi li chanje "ekran"
   * yo (view, detay koli, modal...) jis ak eta React — URL la pa chanje.
   * Rezilta: istwa navigatè a pa konn anyen sou chanjman sa yo, donk lè
   * kliyan an peze/rale bouton tounen telefòn lan, OS la jwenn "anyen pou
   * tounen sou li" epi li KITE app la — menm si gen yon ekran ki te
   * ouvri anndan app la.
   *
   * Solisyon: nou kenbe TOUJOU yon "antre gad" anplis nan istwa a. Chak
   * fwa yon "tounen" rive, nou fèmen bagay ki pi "anlè" a (modal, detay
   * koli, oswa vi aktyèl la) epi nou remete yon nouvo antre gad — jiskaske
   * nou rive sou akèy san anyen louvri, kote nou kite pwochen "tounen" an
   * kite app la vrèman (konpòtman nòmal yon app Android sou ekran rasin).
   */
  const closeTopmostScreen = (): boolean => {
    if (showPwd) { setShowPwd(false); return true; }
    if (showDelete) { setShowDelete(false); return true; }
    if (detail) { setDetail(null); return true; }
    if (retraitConfirmedCount !== null) { setRetraitConfirmedCount(null); return true; }
    if (showPushBanner) { dismissPushBanner(); return true; }
    if (view !== "home") { setView("home"); return true; }
    return false;
  };
  const closeTopmostScreenRef = useRef(closeTopmostScreen);
  closeTopmostScreenRef.current = closeTopmostScreen;

  useEffect(() => {
    history.pushState({ standaBackGuard: true }, "");
    const onPopState = () => {
      if (closeTopmostScreenRef.current()) history.pushState({ standaBackGuard: true }, "");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // ── Gad kondisyonèl (apre TOUT hooks) ───────────────────────────────────
  if (loading) return <Loader />;

  if (!client) return (
    <div className="min-h-screen bg-mist grid place-items-center p-6">
      <div className="card p-8 max-w-md text-center space-y-4">
        <p className="text-sm text-slate-600">Votre profil est introuvable. Contactez STANDA COMMERCIAL.</p>
        <button className="btn justify-center w-full" onClick={logout}>Se déconnecter</button>
      </div>
    </div>
  );

  const non = [client.fullname, client.surname].filter(Boolean).join(" ").trim();

  if (client.account_status !== "Actif" || !client.customer_code) {
    return (
      <div className="min-h-screen bg-mist grid place-items-center p-6">
        <div className="card p-8 max-w-md w-full text-center space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="mx-auto h-14 object-contain" />
          <Clock className="mx-auto text-amber-500" size={44} />
          <h1 className="text-lg font-extrabold text-navy">Votre compte est en attente d&apos;activation</h1>
          <p className="text-sm text-slate-600">
            {non} — l&apos;équipe STANDA COMMERCIAL vérifie vos informations. Dès que votre compte sera activé,
            vous recevrez votre adresse de dépôt aux États-Unis et pourrez utiliser tous nos services.
          </p>
          <a className="btn btn-wa justify-center w-full" href={WA_LINK} target="_blank" rel="noreferrer">
            <WhatsAppIcon size={15} /> Contactez-nous sur WhatsApp
          </a>
          <button className="btn btn-ghost justify-center w-full" onClick={logout}>
            <LogOut size={15} /> Se déconnecter
          </button>
          <button className="w-full text-center text-xs font-semibold text-red-600 hover:underline" onClick={() => setShowDelete(true)}>
            Supprimer mon compte
          </button>
        </div>
        {showDelete && <DeleteAccountModal whatsappHref={WA_LINK} onClose={() => setShowDelete(false)} />}
      </div>
    );
  }

  // ── Klasman koli yo ─────────────────────────────────────────────────────
  // Yon koli rete nan "Disponible" (menm si li deja facturé) tout tan li poko
  // Livré — se konsa ajan pwen de retrait la deja konsidere l tou (READY_STATUSES
  // = Disponible + Facturé nan PickupAgentPortal.tsx). Se PEMAN + LIVREZON ki fè
  // l soti, pa fakti a sèl. Li rete vizib TOU sou fakti li (onglet Factures).
  const historique = pkgs.filter(isDelivered);
  const activeRetraits = retraits.filter((retrait) => retrait.status !== "Remis");
  const receptionsAll = pkgs.filter((p) => !isDelivered(p));
  const disponibles = receptionsAll.filter((p) => p.status === "Disponible" || p.status === "Facturé");
  // Yon koli facturé pa dwe parèt nan "Miami" — l ap parèt SÈLMAN nan "Disponible".
  const nonFactures = disponibles.filter((p) => !isInvoiced(p));
  // "Arrivé en Haïti" (ak pi lwen) parèt ANLÈ "Reçu à Miami" — pwogrè a
  // detèmine lòd la tout tan, pa dat kreyasyon an.
  const progressRank = (status: string) => {
    const idx = INTERNAL_STATUSES.indexOf(status as (typeof INTERNAL_STATUSES)[number]);
    return idx < 0 ? -1 : idx;
  };
  const autres = receptionsAll
    .filter((p) => p.status !== "Disponible" && p.status !== "Facturé")
    .sort((a, b) => progressRank(b.status) - progressRank(a.status));

  const poidsDe = (list: Pkg[]) => round2(list.reduce((s, p) => s + (Number(p.weight) || 0), 0));
  const estimation = (list: Pkg[]) =>
    estimateForPackages(list.map((p) => Number(p.weight) || 0), client.account_type, client.ville, smallCfg);

  const clientName = non || client.customer_code;
  const activePackage = autres.find((p) => ["En transit", "Arrivé en Haïti", "En route vers agence"].includes(p.status))
    ?? autres[0]
    ?? disponibles[0]
    ?? null;
  // "Disponible" et "Facturé" comptés séparément sur l'accueil — un colis
  // facturé reste dans la liste "Disponibles" (règle métier inchangée),
  // mais les 2 tuiles de l'accueil doivent montrer chacune son propre compte.
  const disponiblesOnly = disponibles.filter((p) => p.status === "Disponible");
  const facturesOnly = disponibles.filter((p) => p.status === "Facturé");
  const dispoCount = disponiblesOnly.length;
  const factureCount = facturesOnly.length;
  const dispoEst = disponiblesOnly.length ? estimation(disponiblesOnly) : null;
  const trackQueryNorm = trackQuery.trim().toLowerCase();
  const trackMatches = trackQueryNorm.length < 2 ? [] : pkgs.filter((p) =>
    p.tracking_number?.toLowerCase().includes(trackQueryNorm)
    || p.tracking_manual?.toLowerCase().includes(trackQueryNorm)
    || (p.content ?? "").toLowerCase().includes(trackQueryNorm)
  ).slice(0, 5);
  const outstandingBalanceUsd = round2(invs.reduce((total, invoice) => (
    hasSignificantInvoiceBalance(invoice) ? total + invoiceRemainingAmounts(invoice).remainingUsd : total
  ), 0));
  // ── Sant notifikasyon (V13) ──────────────────────────────────────────────
  // Chak evènman VRE (yon fakti, yon demann retrait, yon koli ki disponib)
  // pran SA PWÒP LIY pou tèt li, epi li rete la pou tout tan — se sèlman
  // kantite fakti/demann/koli ki egziste ki chanje lis la, jamè yon nouvo
  // evènman ki "efase" yon ansyen. Se konsa mesaj yo pa disparèt.
  const clientNotifications: ClientNotice[] = [];

  if (nonFactures.length > 0) {
    clientNotifications.push({
      id: "available",
      key: noticeKey("available", ...nonFactures.map((pkg) => `${pkg.id}:${pkg.status}`).sort()),
      title: nonFactures.length === 1 ? "Votre colis est disponible" : `${nonFactures.length} colis sont disponibles`,
      description: "Présentez-vous à votre agence avec une pièce d'identité.",
      stamp: "À l'instant",
      to: "disponibles",
      kind: "available"
    });
  }
  // Yon liy PA fakti — pa sèlman dènye a. Yon fakti pa janm disparèt lis la.
  for (const invoice of invs) {
    clientNotifications.push({
      id: `invoice-${invoice.id}`,
      key: noticeKey("invoice", invoice.id ?? invoice.invoice_number, invoice.created_at),
      title: "Facture disponible",
      description: invoice.invoice_number ? `Facture ${invoice.invoice_number} disponible dans votre espace.` : "Une facture est disponible dans votre espace.",
      stamp: invoice.created_at ? dateFr(invoice.created_at) : "Récemment",
      to: "factures",
      kind: "invoice"
    });
  }
  // Yon liy PA demann retrait — statut aktyèl la parèt, men demann lan
  // pa disparèt lis la lè statut li chanje, yon lòt demann rive, elatriye.
  for (const retrait of retraits) {
    clientNotifications.push({
      id: `pickup-${retrait.id}`,
      key: noticeKey("pickup", retrait.id, retrait.status, retrait.created_at),
      title: `Retrait · ${retrait.status}`,
      description: retrait.status === "Remis"
        ? `${retrait.package_count} colis remis.`
        : retrait.status === "Préparé"
          ? "Votre demande est préparée à l'agence."
          : "Votre demande de retrait est en cours de préparation.",
      stamp: retrait.created_at ? dateFr(retrait.created_at) : "Récemment",
      to: "retraits",
      kind: "pickup"
    });
  }
  if (activePackage) {
    clientNotifications.push({
      id: `shipment-${activePackage.id}`,
      key: noticeKey("shipment", activePackage.id, activePackage.status, activePackage.received_at ?? activePackage.created_date),
      title: "Colis en cours d'acheminement",
      description: `${activePackage.tracking_number || "Votre colis"} · ${activePackage.status || "Statut en cours"}`,
      stamp: "Actualisé",
      to: "receptions",
      kind: "shipment"
    });
  }
  // `invs` ak `retraits` deja triye pi resan an premye (getClientPackagesAndInvoices
  // / getClientRetraits) — nou pa bezwen re-triye, jis gwoupe pa kategori.

  const unreadNotifications = clientNotifications.filter((notice) => !readNoticeKeys.has(notice.key));

  const markNoticesRead = (notices: ClientNotice[]) => {
    if (!notices.length) return;
    const keys = notices.map((notice) => notice.key);
    const updated = new Set([...readNoticeKeys, ...keys]);
    setReadNoticeKeys(updated);

    if (!authUserId) return;
    saveLocalReadKeys(authUserId, updated);

    // Auth ne permet à un client de modifier que son propre user_metadata.
    // Les clés gardées ici ne sont que des accusés de lecture, jamais des
    // données de colis, d'identité ou de facturation.
    const nextMetadata = { ...authUserMetadata, [NOTICE_METADATA_KEY]: [...updated].slice(-40) };
    setAuthUserMetadata(nextMetadata);
    void supabase.auth.updateUser({ data: nextMetadata });
  };

  const openNotifications = () => {
    markNoticesRead(clientNotifications);
    setView("notifications");
  };

  const openNotice = (notice: ClientNotice) => {
    markNoticesRead([notice]);
    setView(notice.to);
  };

  const NotificationIcon = ({ kind, size = 18 }: { kind: NoticeKind; size?: number }) => {
    if (kind === "available") return <PackageCheck size={size} />;
    if (kind === "invoice") return <ReceiptText size={size} />;
    if (kind === "pickup") return <BellRing size={size} />;
    return <Route size={size} />;
  };

  /** Rezime yon lis koli: kantite, pwa total, epi pri (reyèl oswa estimasyon). */
  const Totaux = ({ list, reel }: { list: Pkg[]; reel?: boolean }) => {
    const w = poidsDe(list);
    // "Disponible" mélange désormais des colis déjà facturés (prix réel,
    // fixé — jamais une estimation) et des colis pas encore facturés (prix
    // seulement estimé). On sépare les deux pour ne jamais afficher un prix
    // "estimé" sur un colis dont le montant est en réalité déjà arrêté.
    const facturedItems = list.filter(isInvoiced);
    const nonFacturedItems = reel ? [] : list.filter((p) => !isInvoiced(p));
    const totalFacture = round2(facturedItems.reduce((s, p) => s + (Number(p.total_usd) || 0), 0));
    const est = nonFacturedItems.length ? estimation(nonFacturedItems) : null;
    return (
      <div className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-start gap-2.5">
            <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eaf4ff] text-[#1466b8]"><PackageCheck size={17} /></span>
            <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-mute">Total des colis</p>
            <p className="text-2xl font-extrabold text-ink leading-tight">{list.length}</p>
            </div>
          </div>
          <div className="flex items-start justify-end gap-2.5 text-right">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-mute">Poids total</p>
              <p className="text-2xl font-extrabold text-ink leading-tight">{w.toFixed(2)} <span className="text-sm">lb</span></p>
            </div>
            <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eaf4ff] text-[#1466b8]"><Route size={17} /></span>
          </div>
        </div>
        {facturedItems.length > 0 && totalFacture > 0 && (
          <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
            <span className="text-[12px] text-mute">Total facturé{!reel ? ` (${facturedItems.length} colis)` : ""}</span>
            <span className="text-xl font-extrabold text-navy">{usd(totalFacture)}</span>
          </div>
        )}
        {est && (
          <div className="mt-3 pt-3 border-t border-line space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-mute">Estimation · {nonFacturedItems.length} colis pas encore facturés</p>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-mute">Transport estimé</span>
              <span className="font-semibold text-ink">{usd(est.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-mute">Taxe fixe</span>
              <span className="font-semibold text-ink">{est.fixedTax > 0 ? usd(est.fixedTax) : "—"}</span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-line">
              <span className="text-[13px] font-bold text-ink">Total estimé</span>
              <span className="text-xl font-extrabold text-navy">{usd(est.total)}</span>
            </div>
          </div>
        )}
        {!est && !reel && !facturedItems.length && (
          <p className="mt-3 pt-3 border-t border-line text-[11px] text-amber-700">
            Le tarif de votre ville n&apos;est pas encore configuré. Contactez-nous sur WhatsApp.
          </p>
        )}
      </div>
    );
  };

  const AvailableEmpty = () => (
    <div className="relative overflow-hidden rounded-[28px] border border-sky-100 bg-gradient-to-b from-sky-50 to-white px-6 py-10 text-center shadow-sm">
      <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-[26px] border border-white bg-white text-[#1466b8] shadow-[0_15px_28px_-16px_rgba(14,83,172,.45)]">
        <PackageCheck size={36} strokeWidth={1.55} />
      </div>
      <h2 className="relative mt-5 text-[17px] font-extrabold text-navy">Aucun colis disponible</h2>
      <p className="relative mx-auto mt-2 max-w-[260px] text-[13px] leading-relaxed text-mute">
        Dès que vos colis seront prêts à votre agence, ils apparaîtront ici.
      </p>
    </div>
  );

  /** Lis demann retrait yo — sèvi ni sou Akèy (rezime), ni sou paj Retrait la. */
  const RetraitsList = ({ list = retraits }: { list?: Retrait[] }) => (
    <>
      {list.map((r) => {
        const open = openRetrait === r.id;
        return (
          <div key={r.id} className="card overflow-hidden">
            <button className="w-full p-4 flex items-center justify-between gap-3 text-left"
              onClick={() => setOpenRetrait(open ? null : r.id)}>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {r.package_count} colis · {Number(r.total_weight).toFixed(2)} lb
                </p>
                <p className="text-xs text-mute mt-0.5">{dateFr(r.created_at)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`pill ${r.status === "Remis" ? "pill-green" : r.status === "Préparé" ? "pill-blue" : "pill-amber"}`}>
                  <span className="pill-dot" /> {r.status}
                </span>
                <ChevronDown size={15} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
              </div>
            </button>
            {open && (
              <div className="border-t border-line divide-y divide-line">
                {(r.items ?? []).length === 0
                  ? <p className="px-4 py-3 text-xs text-mute">Le détail des colis n&apos;est pas disponible.</p>
                  : (r.items ?? []).map((it, i) => (
                    <div key={it.id ?? i} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-[12px] font-bold text-ink truncate">{it.tracking_number || "—"}</p>
                        <span className="text-[12px] font-semibold text-ink shrink-0">
                          {Number(it.weight) > 0 ? `${Number(it.weight).toFixed(2)} lb` : "—"}
                        </span>
                      </div>
                      <p className="text-[11px] text-mute truncate mt-0.5">
                        {it.tracking_manual || "—"} · {it.content || "—"}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );

  const PkgCard = ({ p, check }: { p: Pkg; check?: boolean }) => {
    const facture = Number(p.total_usd) > 0 && isInvoiced(p);
    const special = specialPackageInfo(p);
    // Un colis déjà facturé reste visible dans "Disponible" (il attend d'être
    // payé et retiré), mais ne peut pas entrer dans une NOUVELLE demande de
    // retrait — la demande existante ou le règlement s'en occupe déjà.
    const selectable = !check || p.status === "Disponible";
    return (
      <div className="relative border-b border-line py-3.5 last:border-0">
        {check && (
          <input type="checkbox" aria-label="Chwazi koli a"
            className="absolute top-3.5 right-0 z-10 h-[18px] w-[18px] accent-emerald-600 disabled:opacity-30"
            checked={sel.has(p.id)} disabled={!selectable}
            title={selectable ? undefined : "Colis déjà facturé — réglez la facture pour le retirer."}
            onChange={() => toggleSel(p.id)} />
        )}
        <button onClick={() => setDetail(p)} className={`w-full text-left ${check ? "pr-7" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[13px] font-bold text-ink truncate">{p.tracking_number || "—"}</p>
              {p.tracking_manual && <p className="font-mono text-[11px] text-mute truncate mt-0.5">{p.tracking_manual}</p>}
              <div className="mt-1 flex flex-wrap gap-1">
                {check && isInvoiced(p) && <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Facturé</span>}
                {check && !isInvoiced(p) && <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Disponible</span>}
                {special.isSpecial && <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800" title="Traitement particulier appliqué à ce colis">Colis spécial</span>}
              </div>
            </div>
            {!check && <StatusBadge status={p.status} />}
          </div>
          <div className="mt-2.5"><StatusTimeline status={p.status} compact /></div>
          {p.status === "Livré" && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
              <CircleCheck size={15} strokeWidth={2.4} /> Livraison terminée
            </div>
          )}
          <div className="flex items-center justify-between gap-2 mt-2.5">
            <span className="text-xs text-mute truncate">{p.content || "—"}</span>
            <span className="text-xs font-semibold text-ink shrink-0">
              {Number(p.weight) > 0 ? `${Number(p.weight).toFixed(2)} lb` : "—"}
            </span>
          </div>
          {facture && (
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-[11px] text-mute">Prix facturé</span>
              <span className="text-base font-extrabold text-navy">{usd(p.total_usd)}</span>
            </div>
          )}
        </button>
      </div>
    );
  };

  const Empty = ({ t }: { t: string }) => (
    <div className="card p-10 text-center text-mute text-sm">{t}</div>
  );

  // ── Kalkilatris ─────────────────────────────────────────────────────────
  const w = Number(calcW.replace(",", "."));
  const calcOk = Number.isFinite(w) && w > 0;
  const calcRes = calcOk ? estimateForPackages([w], client.account_type, client.ville, smallCfg) : null;

  // ── Bare navigasyon anba ────────────────────────────────────────────────
  const NavBtn = ({ icon: Icon, label, to, href }: {
    icon: typeof FileText; label: string; to?: View; href?: string;
  }) => {
    const active = to && view === to;
    const cls = `client-nav-item flex-1 flex flex-col items-center gap-0.5 py-2 ${active ? "text-navy" : "text-slate-400"}`;
    const inner = <><Icon size={20} /><span className="text-[10px] font-semibold">{label}</span></>;
    return href
      ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
      : <button className={cls} onClick={() => to && setView(to)}>{inner}</button>;
  };

  return (
    <div className="client-app min-h-screen pb-24">

      {/* ══ EN-TÊTE CLIENT ══ */}
      <header className="client-app-header sticky top-0 z-30">
        <div className="client-header-inner mx-auto flex h-[78px] items-center gap-2.5 px-4">
          <div className="relative flex min-w-0 flex-1 items-center gap-3">
            <button aria-label="Mon compte" onClick={() => setMenuOpen((v) => !v)}
              className="client-header-profile p-1.5" style={{ background: "#fff" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="STANDA COMMERCIAL" className="h-full w-full object-contain" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-white">{clientName}</p>
              <p className="mt-0.5 truncate text-[11px] font-medium tracking-wide text-white/70">{client.customer_code}</p>
            </div>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-lift border border-line py-1 z-20 text-ink">
                  <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-mist text-left"
                    onClick={() => { setMenuOpen(false); setShowPwd(true); }}>
                    <KeyRound size={15} className="text-mute" /> Changer mon mot de passe
                  </button>
                  <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-mist text-left text-red-600"
                    onClick={logout}>
                    <LogOut size={15} /> Dekonekte
                  </button>
                  <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-mist text-left text-red-600 border-t border-line"
                    onClick={() => { setMenuOpen(false); setShowDelete(true); }}>
                    <Trash2 size={15} /> Supprimer mon compte
                  </button>
                </div>
              </>
            )}
          </div>

          <button onClick={refresh} disabled={refreshing} aria-label="Actualiser"
            title="Mettre à jour toutes les données"
            className="client-header-icon">
            {refreshing
              ? <Spinner size={19} />
              : toast ? <SuccessCheck size={20} /> : <RefreshCw size={19} />}
          </button>

          <button onClick={() => setView("infos")} aria-label="Messages et aide" title="Messages et aide"
            className="client-header-icon">
            <MessageCircle size={20} />
          </button>

          <button onClick={openNotifications} aria-label="Notifications" title="Notifications"
            className="client-header-icon relative">
            <BellRing size={19} />
            {unreadNotifications.length > 0 && <span className="client-notification-count">{Math.min(unreadNotifications.length, 9)}</span>}
          </button>
        </div>
      </header>

      <div className="client-app-content mx-auto space-y-4 px-4 pb-5 pt-5 sm:px-5">

        {/* ═══════════ ACCUEIL ═══════════ */}
        {view === "home" && (
          <>
            <ClientLogisticsDashboard
              availableCount={dispoCount}
              invoicedCount={factureCount}
              receptionCount={autres.length}
              retraitCount={activeRetraits.length}
              deliveredCount={historique.length}
              unreadNotifications={unreadNotifications.length}
              onNavigate={(destination) => destination === "notifications" ? openNotifications() : setView(destination)}
            />

            <div className="relative client-enter client-enter-d4">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={trackQuery}
                onChange={(e) => setTrackQuery(e.target.value)}
                placeholder="Rechercher un colis (numéro de suivi, contenu)…"
                className="input w-full pl-10"
                aria-label="Rechercher un colis"
              />
              {trackQueryNorm.length >= 2 && (
                <div className="absolute inset-x-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-2xl border border-line bg-white shadow-lift">
                  {trackMatches.length === 0 ? (
                    <p className="px-3.5 py-3 text-xs text-mute">Aucun colis trouvé pour « {trackQuery.trim()} ».</p>
                  ) : trackMatches.map((p) => (
                    <button key={p.id} type="button"
                      onClick={() => { setDetail(p); setTrackQuery(""); }}
                      className="flex w-full items-center justify-between gap-2 border-b border-line px-3.5 py-2.5 text-left last:border-0 hover:bg-mist">
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-xs font-bold text-ink">{p.tracking_number || p.tracking_manual || "—"}</span>
                        <span className="block truncate text-[11px] text-mute">{p.content || "—"}</span>
                      </span>
                      <StatusBadge status={p.status} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {showPushBanner && (
              <div role="dialog" aria-modal="true" aria-labelledby="push-permission-title" className="fixed inset-0 z-[70] flex items-end bg-slate-950/35 p-3 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-5">
                <section className="w-full max-w-sm overflow-hidden rounded-[30px] bg-white shadow-[0_28px_60px_rgba(4,33,78,.3)]">
                  <div className="relative overflow-hidden bg-gradient-to-br from-[#0b3977] via-[#145ca8] to-[#28a3bc] px-6 pb-7 pt-6 text-white">
                    <span className="relative grid h-14 w-14 place-items-center rounded-2xl border border-white/20 bg-white/15 shadow-lg shadow-blue-950/20"><BellRing size={27} /></span>
                    <p className="relative mt-5 text-[11px] font-bold uppercase tracking-[.14em] text-sky-100">STANDA COMMERCIAL</p>
                    <h2 id="push-permission-title" className="relative mt-1 text-[19px] font-black leading-tight">Activez les notifications</h2>
                  </div>
                  <div className="p-5">
                    <p className="text-sm leading-relaxed text-slate-600">Recevez une alerte dans la barre de notifications de votre téléphone dès qu&apos;un colis est reçu, disponible, facturé ou remis.</p>
                    <button onClick={activatePush} disabled={pushBusy} className="btn btn-brand mt-5 w-full justify-center !py-3 disabled:opacity-60">
                      {pushBusy ? <Spinner size={16} /> : <BellRing size={16} />} {pushBusy ? "Activation…" : "Autoriser les notifications"}
                    </button>
                    <button onClick={dismissPushBanner} disabled={pushBusy} className="mt-3 w-full py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-700 disabled:opacity-50">Pas maintenant</button>
                  </div>
                </section>
              </div>
            )}

            <button onClick={() => setView("infos")} className="client-help-link client-enter client-enter-d4">
              <span><BookOpen size={19} /> Guide et aide</span><ChevronRight size={17} />
            </button>

            {activeRetraits.length > 0 && (
              <section className="space-y-2 pt-1 client-enter client-enter-d4">
                <div className="flex items-center justify-between">
                  <h2 className="h-sec">Vos demandes de retrait</h2>
                  <button onClick={() => setView("retraits")} className="text-xs font-bold text-blue-600">Voir tout</button>
                </div>
                <RetraitsList list={activeRetraits} />
              </section>
            )}
          </>
        )}

        {/* ═══════════ RETRAIT ═══════════ */}
        {view === "retraits" && (
          <>
            {activeRetraits.length === 0
              ? <Empty t="Aucune demande de retrait pour le moment. Sélectionnez vos colis disponibles pour en créer une." />
              : <div className="space-y-2"><RetraitsList list={activeRetraits} /></div>}
          </>
        )}

        {/* ═══════════ DISPONIBLES ═══════════ */}
        {view === "disponibles" && (
          <>
            {disponiblesOnly.length === 0 ? <AvailableEmpty /> : (
              <>
                {dispoEst ? (
                  <div className="space-y-2 px-1">
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3.5 py-2 text-sm font-bold text-sky-900">Shipping fee <b className="font-black">{usd(dispoEst.subtotal)}</b></span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3.5 py-2 text-sm font-bold text-sky-900">Fixed tax <b className="font-black">{dispoEst.fixedTax > 0 ? usd(dispoEst.fixedTax) : "—"}</b></span>
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2.5 text-base font-bold text-white">Total <b className="text-lg font-black">{usd(dispoEst.total)}</b></span>
                    </div>
                  </div>
                ) : (
                  <p className="px-1 text-xs text-amber-700">Le tarif de votre ville n&apos;est pas encore configuré. Contactez-nous sur WhatsApp.</p>
                )}
                <div>
                  {disponiblesOnly.map((p) => <PkgCard key={p.id} p={p} check />)}
                </div>
              </>
            )}
            {sel.size > 0 && (
              <div className="sticky bottom-24 z-20">
                <button className="btn btn-brand w-full justify-center shadow-lift" onClick={notifierRetrait} disabled={busy}>
                  {busy ? <Spinner size={15} /> : <Bell size={15} />} {busy ? "Envoi…" : `Préparer mon retrait (${sel.size})`}
                </button>
              </div>
            )}
          </>
        )}

        {/* ═══════════ COLIS FACTURÉS (pas encore remis) ═══════════ */}
        {view === "colisFactures" && (
          <>
            {outstandingBalanceUsd > 0 && (
              <button type="button" onClick={() => setView("factures")} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left transition hover:bg-amber-100">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Solde de factures</p>
                  <p className="mt-1 text-xl font-black text-amber-800">{usd(outstandingBalanceUsd)}</p>
                  <p className="mt-0.5 text-[11px] text-amber-700">Montant restant à régler</p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-amber-500" />
              </button>
            )}
            {facturesOnly.length === 0 ? <Empty t="Aucun colis facturé en attente de remise." /> : (
              <div>
                {Array.from(new Set(facturesOnly.map((p) => p.invoice_id).filter((id): id is string => !!id))).map((invId) => {
                  const inv = invs.find((f) => f.id === invId);
                  const invoicePkgs = facturesOnly.filter((p) => p.invoice_id === invId);
                  const open = openInvoiceId === invId;
                  return (
                    <div key={invId} className="border-b border-line py-1 last:border-0">
                      <button type="button" onClick={() => setOpenInvoiceId(open ? null : invId)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-navy">{inv?.invoice_number ?? "Facture"}</span>
                          <span className="mt-0.5 block text-xs text-mute">{invoicePkgs.length} colis</span>
                        </span>
                        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
                      </button>
                      {open && (
                        <div className="border-l-2 border-sky-200 pl-3.5 pb-3">
                          {invoicePkgs.map((p) => <PkgCard key={p.id} p={p} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ═══════════ RÉCEPTIONS ═══════════ */}
        {view === "receptions" && (
          <>
            {autres.length === 0 ? <Empty t="Aucun colis reçu à Miami ou en acheminement pour le moment." /> : (
              <>
                <div className="flex flex-wrap gap-2 px-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3.5 py-2 text-sm font-bold text-sky-900">{autres.length} colis</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3.5 py-2 text-sm font-bold text-sky-900">{poidsDe(autres).toFixed(2)} lb</span>
                </div>
                <div>
                  {autres.map((p) => <PkgCard key={p.id} p={p} />)}
                </div>
              </>
            )}
          </>
        )}

        {/* ═══════════ HISTORIQUE ═══════════ */}
        {view === "historique" && (
          <>
            {historique.length === 0 ? <Empty t="Aucun colis dans votre historique." /> : (
              <>
                <Totaux list={historique} reel />
                <div>{historique.map((p) => <PkgCard key={p.id} p={p} />)}</div>
              </>
            )}
          </>
        )}

        {/* ═══════════ FACTURES ═══════════ */}
        {view === "factures" && (
          <>
            {invs.length === 0 ? <Empty t="Aucune facture pour le moment." /> : (
              <div>
                {invs.map((f) => {
                  const open = openInvoiceId === f.id;
                  const invoicePackages = pkgs.filter((p) => p.invoice_id === f.id);
                  const payable = invoicePayableAmounts(f);
                  const paymentStatus = paymentStatusFromAmounts(f);
                  const deliveredCount = invoicePackages.filter(isDelivered).length;
                  const paymentTone = paymentStatus === "Payé" ? "bg-emerald-100 text-emerald-700" : paymentStatus === "Payé partiel" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700";
                  return <div key={f.id} className="border-b border-line py-1 last:border-0">
                    <button type="button" onClick={() => setOpenInvoiceId(open ? null : f.id)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-navy">{f.invoice_number}</span>
                        <span className="mt-0.5 block text-xs text-mute">{dateFr(f.created_at)} · {f.package_count} koli · {Number(f.total_weight).toFixed(2)} lb</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${paymentTone}`}>{paymentStatus}</span>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    <div className="flex items-center justify-between gap-3 pb-3">
                      <div><p className="text-[11px] text-mute">Total de la facture</p><p className="text-base font-extrabold text-ink">{usd(payable.grandTotalUsd)}</p></div>
                      {f.has_pdf || f.pdf_path || f.pdf_url
                        ? <button type="button" onClick={() => void openSecureDocument("invoice", f.id).catch(() => setToast("PDF indisponible. Réessayez plus tard."))} className="text-xs text-navy underline font-semibold">Télécharger le PDF</button>
                        : <span className="text-xs text-slate-400">PDF en préparation</span>}
                    </div>
                    {open && <div className="border-l-2 border-sky-200 pl-3.5 pb-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-900">Solde à payer <b className="font-black">{usd(payable.payableUsd)}</b></span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${deliveredCount === invoicePackages.length && invoicePackages.length ? "bg-emerald-50 text-emerald-800" : "bg-orange-50 text-orange-800"}`}>Remise {deliveredCount}/{invoicePackages.length} livré{deliveredCount > 1 ? "s" : ""}</span>
                      </div>
                      <p className="mb-1 mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Colis facturés dans cette facture</p>
                      {invoicePackages.length ? <div>{invoicePackages.map((p) => <PkgCard key={p.id} p={p} />)}</div> : <p className="py-2 text-sm text-slate-500">Les colis de cette facture seront affichés ici après la synchronisation.</p>}
                    </div>}
                  </div>;
                })}
              </div>
            )}
          </>
        )}

        {/* ═══════════ NOTIFICATIONS ═══════════ */}
        {view === "notifications" && (
          <>
            {clientNotifications.length === 0 ? (
              <Empty t="Aucune notification pour le moment." />
            ) : (
              <div className="client-notification-list">
                {clientNotifications.map((notice) => (
                  <button key={notice.id} onClick={() => openNotice(notice)} className="client-notification-row client-notification-row-full">
                    <span className={`client-notice-icon client-notice-icon-${notice.kind}`}><NotificationIcon kind={notice.kind} size={20} /></span>
                    <span className="min-w-0 flex-1 text-left">
                      <strong>{notice.title}</strong>
                      <small>{notice.description}</small>
                    </span>
                    <span className="client-notice-time">{notice.stamp}</span>
                    {!readNoticeKeys.has(notice.key) && <span className="client-notice-unread-dot" aria-label="Non lu" />}
                    <ChevronRight size={16} className="text-slate-300 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══════════ GUIDE & AIDE ═══════════ */}
        {view === "infos" && (
          <>
            {/* Kijan sa mache */}
            <div className="card p-5">
              <h2 className="text-sm font-bold text-navy uppercase tracking-wide flex items-center gap-2">
                <Truck size={15} /> Comment fonctionne votre expédition
              </h2>
              <ol className="mt-3 space-y-3">
                {([
                  ["Achetez en ligne", `Sur Amazon, SHEIN, eBay… utilisez l'adresse de notre dépôt à Miami et ajoutez le code ${client.customer_code} dans le champ « Address 2 ».`],
                  ["Réception à Miami", "Notre entrepôt enregistre et pèse votre colis. Vous recevez ensuite une notification par e-mail ou WhatsApp."],
                  ["Acheminement du colis", "Votre colis part de Miami vers Haïti, passe les formalités puis rejoint votre agence."],
                  ["Retrait en agence", "Lorsque le statut devient « Disponible », cliquez sur « Préparer mon retrait » afin que votre colis soit prêt à votre arrivée."]
                ] as const).map(([t, d], i) => (
                  <li key={t} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-navy text-white text-[11px] font-bold grid place-items-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-ink leading-tight">{t}</p>
                      <p className="text-[12px] text-mute leading-relaxed mt-0.5">{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Délai */}
            <div className="card p-5">
              <h2 className="text-sm font-bold text-navy uppercase tracking-wide flex items-center gap-2">
                <Clock size={15} /> Délai de livraison
              </h2>
              <p className="text-[12px] text-mute mt-2 leading-relaxed">
                Une fois votre colis reçu à notre entrepôt de Miami, comptez généralement <b>entre 3 et 7 jours ouvrables</b> pour qu&apos;il arrive à votre agence en Haïti.
              </p>
              <p className="text-[12px] text-mute mt-2 leading-relaxed">
                Un <b>jour ouvrable</b> va du lundi au vendredi — les samedis et dimanches ne comptent pas dans ce délai. Un colis reçu un vendredi peut donc arriver le mardi ou mercredi suivant sans retard de notre part.
              </p>
              <p className="text-[11px] text-mute mt-2 leading-relaxed">
                Ce délai peut varier seulement selon la douane, ou si votre code client ne figure pas dans l&apos;adresse du colis : une réclamation doit alors être faite avant que le colis puisse être envoyé en Haïti, ce qui prend du temps. Suivez chaque étape directement dans l&apos;application, sans avoir à nous contacter.
              </p>
            </div>

            {/* Adrès la — jan pou w ekri l */}
            <div className="card p-5">
              <h2 className="text-sm font-bold text-navy uppercase tracking-wide flex items-center gap-2">
                <MapPin size={15} /> Comment renseigner votre adresse
              </h2>
              <p className="text-[12px] text-mute mt-2 leading-relaxed">
                Copiez ces informations <b>exactement</b> lors de vos achats. Votre code client permet d&apos;associer le colis à votre compte.
              </p>
              <div className="mt-3 rounded-xl border border-line divide-y divide-line">
                {([["Full Name", `${client.customer_code} ${non || ""}`.trim()],
                   ["Address 1", DEPOT.address1],
                   ["Address 2", client.customer_code],
                   ["City", DEPOT.city],
                   ["State", DEPOT.state],
                   ["ZIP Code", DEPOT.zip],
                   ["Phone", DEPOT.phone]] as const).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 px-3 py-2">
                    <span className="text-[12px] text-mute shrink-0">{k}</span>
                    <span className={`text-[12px] font-semibold text-right break-all ${k.startsWith("Address 2") || k === "Full Name" ? "text-navy" : "text-ink"}`}>{v}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setView("adresse")} className="btn btn-ghost border border-line w-full justify-center mt-3 !text-xs">
                Voir mon adresse complète
              </button>
            </div>

            {/* Nos agences */}
            <div className="card p-5">
              <h2 className="text-sm font-bold text-navy uppercase tracking-wide flex items-center gap-2">
                <Store size={15} /> Nos agences
              </h2>
              <p className="text-[12px] text-mute mt-2 leading-relaxed">
                Retirez votre colis dans le point de retrait le plus proche de vous.
              </p>
              {agences.length === 0 ? (
                <p className="text-[12px] text-mute mt-3">Contactez-nous sur WhatsApp pour connaître l&apos;agence la plus proche de vous.</p>
              ) : (
                <div className="mt-3 divide-y divide-line">
                  {agences.map((a) => (
                    <div key={a.id ?? a.nom} className="py-2.5">
                      <p className="text-[13px] font-bold text-ink">{a.nom}</p>
                      <p className="text-[12px] text-mute mt-0.5">{a.adresse}</p>
                      {a.horaire_1 && <p className="text-[11px] text-mute mt-0.5">{a.horaire_1}{a.horaire_2 ? ` · ${a.horaire_2}` : ""}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tarif */}
            <div className="card p-5">
              <h2 className="text-sm font-bold text-navy uppercase tracking-wide flex items-center gap-2">
                <Calculator size={15} /> Comment le prix est calculé
              </h2>
              <ul className="mt-3 space-y-2 text-[12px] text-mute leading-relaxed">
                <li className="flex gap-2"><span className="text-navy">•</span>
                  <span>Le prix correspond au <b>poids du colis × tarif de votre ville</b>{client.ville?.name ? <> ({client.ville.name})</> : null}.</span></li>
                <li className="flex gap-2"><span className="text-navy">•</span>
                  <span>Petit colis entre <b>{smallCfg.min} et {smallCfg.max} lb</b> : prix fixe de <b>{usd(smallCfg.price)}</b>.</span></li>
                <li className="flex gap-2"><span className="text-navy">•</span>
                  <span>À partir de <b>{TAX_THRESHOLD_LB} lb</b> au total, une taxe fixe de <b>{usd(TAX_FIXED_USD)}</b> s&apos;applique.</span></li>
                <li className="flex gap-2"><span className="text-navy">•</span>
                  <span>Certains articles comme les téléphones, ordinateurs portables et appareils photo ont un <b>prix forfaitaire</b> — le poids ne s&apos;applique pas.</span></li>
                <li className="flex gap-2"><span className="text-navy">•</span>
                  <span>Le prix affiché dans l&apos;application est une <b>estimation</b>. Le prix final est fixé après la pesée du colis à l&apos;entrepôt.</span></li>
              </ul>
              <button onClick={() => setView("calc")} className="btn btn-ghost border border-line w-full justify-center mt-3 !text-xs">
                <Calculator size={14} /> Ouvrir le calculateur
              </button>
            </div>

            {/* Nos principes */}
            <div className="card p-5">
              <h2 className="text-sm font-bold text-navy uppercase tracking-wide flex items-center gap-2">
                <ShieldCheck size={15} /> Nos principes
              </h2>
              <ul className="mt-3 space-y-2 text-[12px] text-mute leading-relaxed">
                <li className="flex gap-2"><span className="text-navy">•</span>
                  <span><b>Transparence</b> — le prix final correspond toujours au poids réel pesé à l&apos;entrepôt, jamais à une estimation imposée.</span></li>
                <li className="flex gap-2"><span className="text-navy">•</span>
                  <span><b>Sécurité</b> — chaque colis est suivi de sa réception à Miami jusqu&apos;à sa remise à votre agence.</span></li>
                <li className="flex gap-2"><span className="text-navy">•</span>
                  <span><b>Rapidité</b> — vos colis sont acheminés régulièrement vers Haïti, sans attendre un plein chargement.</span></li>
                <li className="flex gap-2"><span className="text-navy">•</span>
                  <span><b>Proximité</b> — une équipe joignable par téléphone et WhatsApp pour répondre à vos questions.</span></li>
              </ul>
              <a href={`tel:${WA_NUM}`} className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-line px-3 py-2.5 text-[13px] font-bold text-navy">
                <Phone size={15} /> {SUPPORT_PHONE}
              </a>
            </div>

            {/* Atik entèdi */}
            <div className="card p-5 border-red-200">
              <h2 className="text-sm font-bold text-red-700 uppercase tracking-wide flex items-center gap-2">
                <Ban size={15} /> Articles interdits
              </h2>
              <p className="text-[12px] text-mute mt-2 leading-relaxed">
                Les compagnies aériennes et la douane interdisent les articles suivants. Ils ne peuvent pas être expédiés :
              </p>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {["Armes et munitions", "Produits inflammables", "Explosifs", "Produits corrosifs",
                  "Batteries au lithium séparées", "Drogues et stupéfiants", "Contenu pornographique", "Animaux vivants",
                  "Espèces", "Produits périssables"].map((a) => (
                  <p key={a} className="text-[12px] text-ink flex gap-1.5">
                    <span className="text-red-500 shrink-0">✕</span>{a}
                  </p>
                ))}
              </div>
              <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mt-3 leading-relaxed">
                <AlertTriangle size={12} className="inline mr-1" />
                Vous êtes responsable du contenu de votre colis. Un article interdit peut être saisi par la douane sans recours.
                En cas de doute, contactez-nous sur WhatsApp avant votre achat.
              </p>
            </div>

            {/* Kesyon */}
            <div className="card p-5">
              <h2 className="text-sm font-bold text-navy uppercase tracking-wide flex items-center gap-2">
                <HelpCircle size={15} /> Questions fréquentes
              </h2>
              <div className="mt-3 divide-y divide-line">
                {([
                  // Repons yo reflete règ sistèm nan EGZAKTEMAN (delè pibliye anwo a,
                  // règ antrepozaj /confidentialite, lib/pricing.ts, flux retrait).
                  // Si youn nan règ sa yo chanje, mete repons lan ajou tou.
                  ["Combien de temps prend mon colis ?",
                   "Une fois votre colis reçu à notre entrepôt de Miami, comptez généralement entre 3 et 7 jours ouvrables pour qu'il arrive à votre agence en Haïti. Ce délai peut varier seulement selon la douane, ou si votre code client ne figure pas dans l'adresse du colis : une réclamation doit alors être faite avant que le colis puisse être envoyé en Haïti, ce qui prend du temps. Ouvrez le colis dans l'application pour voir son étape : Reçu à Miami, En préparation, En transit, Arrivé en Haïti, En route vers agence, puis Disponible."],
                  ["Pourquoi mon colis n'apparaît-il pas encore ?",
                   "Votre colis apparaît dès que notre entrepôt de Miami l'a reçu et enregistré, pas avant. Si le transporteur indique « livré », comptez quelques heures pour l'enregistrement. L'application se met à jour toute seule chaque minute ; vous pouvez aussi toucher le bouton ↻ en haut de l'écran. Si votre colis n'apparaît pas, c'est souvent que l'adresse a été mal saisie lors de l'achat ou que votre code client MC-… n'a pas été mis sur la ligne « Address 2 » : sans ce code, nous ne pouvons pas relier le colis à votre compte. Recopiez toujours exactement l'adresse de la page « Mon adresse ». Dans ce cas, écrivez-nous sur WhatsApp avec votre numéro de tracking pour faire une réclamation."],
                  ["Puis-je envoyer plusieurs colis ensemble ?",
                   "Oui. Vous pouvez commander dans plusieurs boutiques : chaque colis est reçu et pesé séparément à Miami, et tous ceux qui portent votre code client sont regroupés dans votre compte. Les colis disponibles en même temps peuvent être réunis sur une seule facture."],
                  ["Que signifie « Préparer mon retrait » ?",
                   "Quand un colis passe au statut « Disponible », ouvrez « Disponibles », cochez les colis que vous viendrez chercher et touchez « Préparer mon retrait ». L'agence prépare alors vos colis avant votre arrivée : votre demande passe de « En attente » à « Préparé », puis à « Remis » quand vous les avez récupérés. Les factures impayées doivent être réglées à l'agence avant la remise. Vous disposez de 15 jours pour retirer un colis disponible ; à partir du 16e jour, des frais d'entreposage de 5 $ US par jour s'appliquent."],
                  ["J'ai oublié mon mot de passe.",
                   "Écrivez-nous sur WhatsApp : nous vous envoyons un nouveau mot de passe. Connectez-vous avec votre code client MC-XXXXX et ce mot de passe. Vous pouvez ensuite le changer : touchez votre nom en haut de l'écran, puis « Changer mon mot de passe »."],
                  ["Le prix peut-il changer ?",
                   "Oui : le calculateur donne une estimation. Le prix final est celui de votre facture, calculé sur le poids réel pesé à notre entrepôt de Miami, selon le tarif de votre ville. Il peut différer de l'estimation si le poids réel n'est pas celui que vous avez saisi, si le colis contient un article à tarif spécial comme un téléphone, un ordinateur portable, une tablette, une caméra ou un téléviseur, ou si des frais d'entreposage s'ajoutent pour un retrait après 15 jours. Le montant en gourdes est calculé au taux du jour de la facture."]
                ] as const).map(([q, a]) => (
                  <details key={q} className="py-2.5 group">
                    <summary className="text-[13px] font-semibold text-ink cursor-pointer list-none flex items-start gap-2">
                      <ChevronRight size={14} className="text-slate-400 shrink-0 mt-0.5 transition-transform group-open:rotate-90" />
                      <span>{q}</span>
                    </summary>
                    <p className="text-[12px] text-mute leading-relaxed mt-1.5 pl-6">{a}</p>
                  </details>
                ))}
              </div>
            </div>

            <a href={WA_LINK} target="_blank" rel="noreferrer" className="btn btn-wa w-full justify-center">
              <WhatsAppIcon size={15} /> Une question ? Écrivez-nous sur WhatsApp
            </a>
          </>
        )}

        {/* ═══════════ MON ADRESSE ═══════════ */}
        {view === "adresse" && (
          <>
            <div className="card p-5">
              {([["Full Name / Nombre completo", non || "—"],
                 ["Address 1", DEPOT.address1],
                 ["Address 2", client.customer_code],
                 ["City", DEPOT.city],
                 ["State", DEPOT.state],
                 ["ZIP Code", DEPOT.zip],
                 ["Phone", DEPOT.phone]] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line py-2.5 last:border-0">
                  <span className="text-mute text-sm">{k}</span>
                  <span className={`font-semibold text-sm text-right ${k === "Address 2" ? "text-navy" : "text-ink"}`}>{v}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ═══════════ CALCULATRICE ═══════════ */}
        {view === "calc" && (
          <>
            <div className="card p-5 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-mute">Poids du colis (lb)</span>
                <input className="input mt-1.5 text-lg font-semibold" inputMode="decimal" placeholder="Ex: 4.5"
                  value={calcW} onChange={(e) => setCalcW(e.target.value)} />
              </label>

              {calcOk && !calcRes && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  Le tarif de votre ville n&apos;est pas encore configuré. Contactez-nous sur WhatsApp.
                </p>
              )}

              {calcRes && (
                <div className="rounded-xl border border-line divide-y divide-line">
                  <div className="flex justify-between px-4 py-2.5 text-sm">
                    <span className="text-mute">
                      Transport {calcRes.smallCount > 0 ? "· petit colis" : `· ${calcRes.totalWeight.toFixed(2)} lb`}
                    </span>
                    <span className="font-semibold text-ink">{usd(calcRes.subtotal)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 text-sm">
                    <span className="text-mute">Taxe fixe</span>
                    <span className="font-semibold text-ink">
                      {calcRes.fixedTax > 0 ? usd(calcRes.fixedTax) : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-3 bg-mist rounded-b-xl">
                    <span className="font-bold text-ink text-sm">Total estimé</span>
                    <span className="font-extrabold text-navy text-lg">{usd(calcRes.total)}</span>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-mute">
                Une taxe fixe de {usd(TAX_FIXED_USD)} s&apos;applique à partir de {TAX_THRESHOLD_LB} lb au total.
                Petit colis {smallCfg.min}–{smallCfg.max} lb : {usd(smallCfg.price)}.
                Il s&apos;agit d&apos;une <b>estimation</b> — le prix final est fixé après la pesée à l&apos;entrepôt.
              </p>
            </div>
          </>
        )}
      </div>

      {/* ══ DETAY KOLI ══ */}
      {detail && (
        <ClientTrackingDetails
          pkg={detail}
          customerName={non || client.customer_code}
          destination={client.pickup_location || client.ville?.name || client.city || "Votre agence"}
          onClose={() => setDetail(null)}
          onContact={() => window.open(waPkgLink(detail, client.customer_code), "_blank", "noopener,noreferrer")}
        />
      )}

      {showDelete && <DeleteAccountModal whatsappHref={WA_LINK} onClose={() => setShowDelete(false)} />}

      {/* ══ Modal: chanje modpas ══ */}
      {showPwd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowPwd(false)}>
          <div className="card p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="h-sec">Changer mon mot de passe</h2>
              <button className="text-slate-400 hover:text-navy" onClick={() => setShowPwd(false)}><X size={18} /></button>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-mute">Nouveau mot de passe</span>
              <input type="password" className="input mt-1" value={pwd1} onChange={(e) => setPwd1(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-mute">Confirmer le mot de passe</span>
              <input type="password" className="input mt-1" value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && changePassword()} />
            </label>
            <BusyButton className="btn w-full justify-center" onClick={changePassword} busy={pwdBusy}
              busyLabel="Modification en cours…">
              Enregistrer
            </BusyButton>
          </div>
        </div>
      )}

      {/* ══ ✅ CONFIRMATION (pwen 3) — apre chak anrejistreman reyisi ══ */}
      {toast && <SavedToast message={toast} onClose={() => setToast(null)} />}

      {/* ══ Demande de retrait confirmée — gwo tchèk vèt ══ */}
      {retraitConfirmedCount !== null && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-navy/40 p-5"
          onClick={() => setRetraitConfirmedCount(null)}>
          <div className="card w-full max-w-xs p-7 text-center space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center"><SuccessCheck size={88} /></div>
            <h2 className="text-lg font-extrabold text-ink">Demande envoyée</h2>
            <p className="text-sm text-mute leading-relaxed">
              {retraitConfirmedCount} colis · notre équipe a été prévenue et prépare votre retrait à l&apos;agence.
            </p>
            <button className="btn btn-brand w-full justify-center mt-1" onClick={() => setRetraitConfirmedCount(null)}>
              OK
            </button>
          </div>
        </div>
      )}

      {/* ══ BARE NAVIGASYON ANBA ══ */}
      <nav className="client-bottom-nav fixed bottom-0 inset-x-0 z-40 border-t">
        <div className="max-w-3xl mx-auto flex items-stretch px-2 pb-[env(safe-area-inset-bottom)]">
          <NavBtn icon={FileText} label="Factures" to="factures" />
          <NavBtn icon={MapPin} label="Adresse" to="adresse" />
          <button onClick={() => setView("home")} aria-label="Accueil"
            className="flex-1 flex flex-col items-center -mt-5">
            <span className={`client-bottom-home w-14 h-14 rounded-full grid place-items-center p-2
              ${view === "home" ? "ring-2 ring-navy" : ""}`} style={{ background: "#fff" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Accueil" className="h-full w-full object-contain" />
            </span>
            <span className="text-[10px] font-semibold text-navy mt-0.5">Accueil</span>
          </button>
          <NavBtn icon={Calculator} label="Calcul" to="calc" />
          <a href={WA_LINK} target="_blank" rel="noreferrer" className="client-nav-item flex-1 flex flex-col items-center gap-0.5 py-2 text-slate-400">
            <WhatsAppIcon size={20} /><span className="text-[10px] font-semibold">WhatsApp</span>
          </a>
        </div>
      </nav>

      <HermesChat />
    </div>
  );
}
