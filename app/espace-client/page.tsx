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
 *   Fakti/Livre -> soti nan toude -> ale nan HISTORIQUE.
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
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Ban, Bell, BellRing, BookOpen, Calculator, Check, ChevronDown, ChevronLeft,
  ChevronRight, Clock, FileText, HelpCircle, KeyRound, LogOut, MapPin,
  Package, PackageCheck, ReceiptText, RefreshCw, Route, ScanLine, Truck, User, X
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { safeMessage } from "@/lib/safeerror";
import {
  createRetrait, getClientByAuthId, getClientPackagesAndInvoices,
  getClientRetraits, getSmallParcelConfig
} from "@/lib/db";
import { Client, Invoice, Pkg, Retrait } from "@/lib/types";
import { DEPOT } from "@/lib/depot";
import { SUPPORT_PHONE } from "@/lib/branding";
import {
  DEFAULT_SMALL_PARCEL, SmallParcelConfig, TAX_FIXED_USD, TAX_THRESHOLD_LB,
  estimateForPackages, round2
} from "@/lib/pricing";
import { dateFr, usd } from "@/lib/utils";
import Loader, { SavedToast, Spinner, SuccessCheck } from "@/components/Loader";
import StatusBadge from "@/components/StatusBadge";
import { StatusTimeline } from "@/components/StatusFlow";
import { WhatsAppIcon } from "@/components/site/BrandIcons";

type View = "home" | "disponibles" | "receptions" | "factures" | "historique" | "notifications" | "adresse" | "calc" | "infos";
type NoticeKind = "available" | "invoice" | "pickup" | "shipment";
type ClientNotice = {
  id: string;
  title: string;
  description: string;
  stamp: string;
  to: View;
  kind: NoticeKind;
};

const WA_NUM = SUPPORT_PHONE.replace(/\D/g, "");
const WA_LINK = `https://wa.me/${WA_NUM}`;

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

/** Yon koli "fini" (fakti oswa livre) -> li ale nan Historique. */
const isDone = (p: Pkg) => p.status === "Facturé" || p.status === "Livré" || !!p.invoice_id;

/**
 * SUIVI VERTICAL — chaque étape affiche clairement la position du colis.
 * Étape terminée = vert avec ✓ · étape active = bleu animé · le reste = gris.
 */
function SuiviVertical({ p }: { p: Pkg }) {
  const ETAPES: { nom: string; desc: string; date?: string | null }[] = [
    { nom: "Reçu à Miami", desc: "Votre colis a été réceptionné dans notre entrepôt américain", date: p.received_at ?? p.created_date },
    { nom: "En préparation", desc: "Votre colis est préparé pour le départ" },
    { nom: "En transit", desc: "Votre colis voyage vers Haïti" },
    { nom: "Arrivé en Haïti", desc: "Votre colis est arrivé dans le pays" },
    { nom: "En route vers l'agence", desc: "Votre colis est en route vers votre agence" },
    { nom: "Disponible", desc: "Vous pouvez venir le retirer", date: p.verified_at },
    { nom: "Facturé", desc: "Votre facture est disponible", date: p.invoiced_at }
  ];

  const ORDRE = ["Reçu à Miami", "En préparation", "En transit", "Arrivé en Haïti",
                 "En route vers agence", "Disponible", "Livré"];
  let actuel = ORDRE.indexOf(p.status);
  if (p.status === "Facturé" || p.invoice_id) actuel = ETAPES.length - 1;
  if (actuel < 0) actuel = 0;

  return (
    <ol className="space-y-0">
      {ETAPES.map((e, i) => {
        const fini = i < actuel;
        const ici = i === actuel;
        const dernye = i === ETAPES.length - 1;
        return (
          <li key={e.nom} className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <span className={`w-6 h-6 rounded-full grid place-items-center shrink-0 ${
                fini ? "bg-brand text-white" : ici ? "bg-navy text-white" : "bg-line text-slate-400"}`}>
                {fini ? <Check size={13} strokeWidth={3} />
                      : ici ? <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
              </span>
              {!dernye && <span className={`w-0.5 flex-1 min-h-[26px] ${fini ? "bg-brand" : "bg-line"}`} />}
            </div>
            <div className={`min-w-0 flex-1 ${dernye ? "pb-0" : "pb-4"}`}>
              <p className={`text-[13px] font-bold leading-tight ${
                ici ? "text-navy" : fini ? "text-ink" : "text-slate-400"}`}>{e.nom}</p>
              <p className={`text-[11px] leading-snug mt-0.5 ${ici || fini ? "text-mute" : "text-slate-300"}`}>
                {e.desc}
              </p>
              {e.date && (fini || ici) && (
                <p className="text-[11px] font-semibold text-brand-dark mt-0.5">{dateFr(e.date)}</p>
              )}
              {ici && <span className="pill pill-blue mt-1.5"><span className="pill-dot" />Étape en cours</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function EspaceClientPage() {
  // ── HOOKS (tout ansanm, anvan tout return) ──────────────────────────────
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [invs, setInvs] = useState<Invoice[]>([]);
  const [retraits, setRetraits] = useState<Retrait[]>([]);
  const [smallCfg, setSmallCfg] = useState<SmallParcelConfig>(DEFAULT_SMALL_PARCEL);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [view, setView] = useState<View>("home");
  const [detail, setDetail] = useState<Pkg | null>(null);
  const [openRetrait, setOpenRetrait] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdBusy, setPwdBusy] = useState(false);

  const [calcW, setCalcW] = useState("");

  const load = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) { router.replace("/espace-client/connexion"); return; }
    const [c, cfg] = await Promise.all([getClientByAuthId(data.user.id), getSmallParcelConfig()]);
    setClient(c); setSmallCfg(cfg);
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
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await load(); setToast("Mise à jour effectuée"); }
    finally { setRefreshing(false); }
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
      setToast(`Demande de retrait envoyée — ${chosen.length} colis`);
    } catch (e: unknown) { setMsg(safeMessage(e)); }
    finally { setBusy(false); }
  };

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
        </div>
      </div>
    );
  }

  // ── Klasman koli yo ─────────────────────────────────────────────────────
  const historique = pkgs.filter(isDone);
  const receptionsAll = pkgs.filter((p) => !isDone(p));
  const disponibles = receptionsAll.filter((p) => p.status === "Disponible");
  const autres = receptionsAll.filter((p) => p.status !== "Disponible");

  const poidsDe = (list: Pkg[]) => round2(list.reduce((s, p) => s + (Number(p.weight) || 0), 0));
  const estimation = (list: Pkg[]) =>
    estimateForPackages(list.map((p) => Number(p.weight) || 0), client.account_type, client.ville, smallCfg);

  const greetingName = non.split(/\s+/)[0] || client.customer_code;
  const activePackage = autres.find((p) => ["En transit", "Arrivé en Haïti", "En route vers agence"].includes(p.status))
    ?? autres[0]
    ?? disponibles[0]
    ?? null;
  const clientNotifications: ClientNotice[] = [];

  if (disponibles.length > 0) {
    clientNotifications.push({
      id: "available",
      title: disponibles.length === 1 ? "Votre colis est disponible" : `${disponibles.length} colis sont disponibles`,
      description: "Présentez-vous à votre agence avec une pièce d'identité.",
      stamp: "À l'instant",
      to: "disponibles",
      kind: "available"
    });
  }
  if (invs.length > 0) {
    const latestInvoice = invs[0];
    clientNotifications.push({
      id: "invoice",
      title: "Votre facture est prête",
      description: latestInvoice?.invoice_number ? `Facture ${latestInvoice.invoice_number} disponible dans votre espace.` : "Votre facture est disponible dans votre espace.",
      stamp: latestInvoice?.created_at ? dateFr(latestInvoice.created_at) : "Récemment",
      to: "factures",
      kind: "invoice"
    });
  }
  if (retraits.length > 0) {
    const latestRetrait = retraits[0];
    clientNotifications.push({
      id: "pickup",
      title: "Suivi de votre retrait",
      description: latestRetrait?.status === "Préparé" ? "Votre demande est préparée à l'agence." : "Votre demande de retrait est en cours de préparation.",
      stamp: latestRetrait?.created_at ? dateFr(latestRetrait.created_at) : "Récemment",
      to: "disponibles",
      kind: "pickup"
    });
  }
  if (!clientNotifications.length && activePackage) {
    clientNotifications.push({
      id: "shipment",
      title: "Votre colis est en cours d'acheminement",
      description: `${activePackage.tracking_number || "Votre colis"} · ${activePackage.status || "Statut en cours"}`,
      stamp: "Actualisé",
      to: "receptions",
      kind: "shipment"
    });
  }

  const journeyStage = activePackage?.status === "Disponible" || (activePackage ? isDone(activePackage) : false)
    ? 2
    : activePackage?.status === "En transit" || activePackage?.status === "Arrivé en Haïti" || activePackage?.status === "En route vers agence"
      ? 1
      : 0;

  // ── Ti konpozan ─────────────────────────────────────────────────────────
  const MenuRow = ({ icon: Icon, label, count, to, tone, description }: {
    icon: typeof Package; label: string; count: number; to: View;
    tone: "available" | "receive" | "invoice" | "history"; description: string;
  }) => (
    <button onClick={() => setView(to)}
      className="client-stat-card text-left">
      <span className={`client-stat-icon client-stat-icon-${tone}`}><Icon size={22} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold text-ink leading-tight">{label}</span>
        <span className="block text-[11px] text-mute mt-1 truncate">{description}</span>
      </span>
      <span className={`client-stat-count client-stat-count-${tone}`}>{count}</span>
      <ChevronRight size={16} className="text-slate-300 shrink-0" />
    </button>
  );

  const NotificationIcon = ({ kind, size = 18 }: { kind: NoticeKind; size?: number }) => {
    if (kind === "available") return <PackageCheck size={size} />;
    if (kind === "invoice") return <ReceiptText size={size} />;
    if (kind === "pickup") return <BellRing size={size} />;
    return <Route size={size} />;
  };

  /** Rezime yon lis koli: kantite, pwa total, epi pri (reyèl oswa estimasyon). */
  const Totaux = ({ list, reel }: { list: Pkg[]; reel?: boolean }) => {
    const w = poidsDe(list);
    const est = reel ? null : estimation(list);
    const totalReel = reel ? round2(list.reduce((s, p) => s + (Number(p.total_usd) || 0), 0)) : 0;
    return (
      <div className="card p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-mute">Total des colis</p>
            <p className="text-2xl font-extrabold text-ink leading-tight">{list.length}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-mute">Poids total</p>
            <p className="text-2xl font-extrabold text-ink leading-tight">{w.toFixed(2)} <span className="text-sm">lb</span></p>
          </div>
        </div>
        {reel && totalReel > 0 && (
          <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
            <span className="text-[12px] text-mute">Total facturé</span>
            <span className="text-xl font-extrabold text-navy">{usd(totalReel)}</span>
          </div>
        )}
        {est && (
          <div className="mt-3 pt-3 border-t border-line space-y-1.5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-mute">Transport estimé</span>
              <span className="font-semibold text-ink">{usd(est.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-mute">Taxe fixe {est.fixedTax > 0 ? `(≥ ${TAX_THRESHOLD_LB} lb)` : ""}</span>
              <span className="font-semibold text-ink">{est.fixedTax > 0 ? usd(est.fixedTax) : "—"}</span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-line">
              <span className="text-[13px] font-bold text-ink">Total estimé</span>
              <span className="text-xl font-extrabold text-navy">{usd(est.total)}</span>
            </div>
          </div>
        )}
        {!est && !reel && (
          <p className="mt-3 pt-3 border-t border-line text-[11px] text-amber-700">
            Le tarif de votre ville n&apos;est pas encore configuré. Contactez-nous sur WhatsApp.
          </p>
        )}
      </div>
    );
  };

  const PkgCard = ({ p, check }: { p: Pkg; check?: boolean }) => {
    const facture = Number(p.total_usd) > 0 && isDone(p);
    return (
      <div className="relative">
        {check && (
          <input type="checkbox" aria-label="Chwazi koli a"
            className="absolute top-4 right-4 z-10 w-4 h-4"
            checked={sel.has(p.id)} onChange={() => toggleSel(p.id)} />
        )}
        <button onClick={() => setDetail(p)} className="w-full card card-hover p-4 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[13px] font-bold text-ink truncate">{p.tracking_number || "—"}</p>
              {p.tracking_manual && <p className="font-mono text-[11px] text-mute truncate mt-0.5">{p.tracking_manual}</p>}
            </div>
            {!check && <StatusBadge status={p.status} />}
          </div>
          <div className="mt-2.5"><StatusTimeline status={p.status} compact lastStepLabel="Facturé" /></div>
          <div className="flex items-center justify-between gap-2 mt-2.5">
            <span className="text-xs text-mute truncate">{p.content || "—"}</span>
            <span className="text-xs font-semibold text-ink shrink-0">
              {Number(p.weight) > 0 ? `${Number(p.weight).toFixed(2)} lb` : "—"}
            </span>
          </div>
          {facture && (
            <div className="mt-2.5 pt-2.5 border-t border-line flex items-center justify-between">
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

  const SubHeader = ({ title, sub }: { title: string; sub?: string }) => (
    <div className="flex items-center gap-2 mb-4">
      <button onClick={() => setView("home")} className="w-9 h-9 rounded-xl border border-line bg-white grid place-items-center text-navy shrink-0">
        <ChevronLeft size={18} />
      </button>
      <div className="min-w-0">
        <h1 className="text-lg font-extrabold text-ink leading-tight truncate">{title}</h1>
        {sub && <p className="text-xs text-mute truncate">{sub}</p>}
      </div>
    </div>
  );

  // ── Kalkilatris ─────────────────────────────────────────────────────────
  const w = Number(calcW.replace(",", "."));
  const calcOk = Number.isFinite(w) && w > 0;
  const calcRes = calcOk ? estimateForPackages([w], client.account_type, client.ville, smallCfg) : null;

  // ── Bare navigasyon anba ────────────────────────────────────────────────
  const NavBtn = ({ icon: Icon, label, to, href }: {
    icon: typeof Package; label: string; to?: View; href?: string;
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
        <div className="max-w-3xl mx-auto px-4 h-[68px] flex items-center gap-3">
          <div className="client-logo-tile shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-8 object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-[17px] leading-tight truncate">{client.customer_code}</p>
            <p className="text-[11px] text-white/65 truncate">{non || "—"}</p>
          </div>

          <button onClick={refresh} disabled={refreshing} aria-label="Actualiser"
            title="Mettre à jour toutes les données"
            className="w-9 h-9 rounded-lg grid place-items-center text-white/85 hover:text-white hover:bg-white/10 disabled:opacity-60">
            {refreshing
              ? <Spinner size={19} />
              : toast ? <SuccessCheck size={20} /> : <RefreshCw size={19} />}
          </button>

          <button onClick={() => setView("notifications")} aria-label="Notifications" title="Notifications"
            className="client-header-icon relative">
            <BellRing size={19} />
            {clientNotifications.length > 0 && <span className="client-notification-count">{Math.min(clientNotifications.length, 9)}</span>}
          </button>

          <button onClick={() => setView("infos")} aria-label="Guide et aide" title="Guide & Aide"
            className="client-header-icon hidden sm:grid">
            <HelpCircle size={19} />
          </button>

          <a href={WA_LINK} target="_blank" rel="noreferrer" aria-label="WhatsApp"
            className="client-header-icon">
            <WhatsAppIcon size={19} />
          </a>

          <div className="relative">
            <button aria-label="Mon compte" onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-1 text-white/85 hover:text-white rounded-xl px-1.5 py-1.5 hover:bg-white/10">
              <div className="w-7 h-7 rounded-full bg-white/15 grid place-items-center"><User size={15} /></div>
              <ChevronDown size={14} />
            </button>
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
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="client-app-content max-w-3xl mx-auto p-4 space-y-4">

        {/* ═══════════ ACCUEIL ═══════════ */}
        {view === "home" && (
          <>
            <section className="client-welcome client-enter" aria-label="Résumé du compte">
              <div>
                <p className="client-eyebrow">ESPACE CLIENT</p>
                <h1>Bonjour, {greetingName}</h1>
                <p>Suivez vos colis et vos demandes depuis un seul espace.</p>
              </div>
              <button onClick={() => setView("notifications")} className="client-welcome-bell" aria-label="Ouvrir les notifications">
                <BellRing size={20} />
                {clientNotifications.length > 0 && <span>{Math.min(clientNotifications.length, 9)}</span>}
              </button>
            </section>

            {clientNotifications[0] && (
              <button onClick={() => setView(clientNotifications[0].to)} className="client-main-notice client-enter client-enter-d1">
                <span className={`client-notice-icon client-notice-icon-${clientNotifications[0].kind}`}>
                  <NotificationIcon kind={clientNotifications[0].kind} size={21} />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <strong>{clientNotifications[0].title}</strong>
                  <small>{clientNotifications[0].description}</small>
                </span>
                <ChevronRight size={18} className="text-slate-400 shrink-0" />
              </button>
            )}

            <section className="client-stat-grid client-enter client-enter-d2" aria-label="Accès rapides">
              <MenuRow icon={PackageCheck} label="Disponibles" count={disponibles.length} to="disponibles" tone="available" description="Colis prêts au retrait" />
              <MenuRow icon={ScanLine} label="Réceptions" count={receptionsAll.length} to="receptions" tone="receive" description="Colis enregistrés" />
              <MenuRow icon={ReceiptText} label="Factures" count={invs.length} to="factures" tone="invoice" description="Documents disponibles" />
              <MenuRow icon={Route} label="Historique" count={historique.length} to="historique" tone="history" description="Vos derniers envois" />
            </section>

            {activePackage && (
              <section className="client-shipment-card client-enter client-enter-d3">
                <div className="client-shipment-heading">
                  <div>
                    <span className="client-status-label">{activePackage.status || "En cours"}</span>
                    <h2>{activePackage.tracking_number || activePackage.tracking_manual || "Colis en cours"}</h2>
                    <p>{activePackage.content || "Votre colis est pris en charge par STANDA."}</p>
                  </div>
                  <span className="client-map-mark"><MapPin size={19} /></span>
                </div>
                <div className={`client-route-progress client-route-stage-${journeyStage}`} aria-label="Avancement de votre colis">
                  <span className="client-route-stop client-route-stop-start"><b><Package size={15} /></b><small>Miami</small></span>
                  <span className="client-route-stop client-route-stop-middle"><b><Truck size={15} /></b><small>Haïti</small></span>
                  <span className="client-route-stop client-route-stop-end"><b><MapPin size={15} /></b><small>Agence</small></span>
                </div>
                <button onClick={() => { setDetail(activePackage); setView("receptions"); }} className="client-follow-button">
                  Voir le suivi <ChevronRight size={18} />
                </button>
              </section>
            )}

            <section className="client-notifications-preview client-enter client-enter-d4">
              <div className="client-section-title"><h2>Notifications</h2><button onClick={() => setView("notifications")}>Voir tout</button></div>
              {clientNotifications.length === 0 ? (
                <div className="client-empty-notice"><Bell size={18} /> Aucune notification pour le moment.</div>
              ) : clientNotifications.slice(0, 2).map((notice) => (
                <button key={notice.id} onClick={() => setView(notice.to)} className="client-notification-row">
                  <span className={`client-notice-icon client-notice-icon-${notice.kind}`}><NotificationIcon kind={notice.kind} /></span>
                  <span className="min-w-0 flex-1 text-left"><strong>{notice.title}</strong><small>{notice.description}</small></span>
                  <span className="client-notice-time">{notice.stamp}</span>
                </button>
              ))}
            </section>

            <button onClick={() => setView("infos")} className="client-help-link client-enter client-enter-d4">
              <span><BookOpen size={19} /> Guide &amp; aide</span><ChevronRight size={17} />
            </button>

            {retraits.length > 0 && (
              <section className="space-y-2 pt-1 client-enter client-enter-d4">
                <h2 className="h-sec">Vos demandes de retrait</h2>
                {retraits.map((r) => {
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
              </section>
            )}
          </>
        )}

        {/* ═══════════ DISPONIBLES ═══════════ */}
        {view === "disponibles" && (
          <>
            <SubHeader title="Disponibles" sub="Colis prêts à être retirés" />
            {disponibles.length === 0 ? <Empty t="Aucun colis disponible pour le moment." /> : (
              <>
                <Totaux list={disponibles} />
                <p className="text-[12px] text-mute px-1 leading-relaxed">
                  Sélectionnez les colis que vous souhaitez retirer, puis cliquez sur « Préparer mon retrait »
                  afin que notre équipe les prépare avant votre arrivée.
                </p>
                <div className="space-y-3">
                  {disponibles.map((p) => <PkgCard key={p.id} p={p} check />)}
                </div>
              </>
            )}
            {sel.size > 0 && (
              <div className="sticky bottom-24 z-20">
                <button className="btn btn-brand w-full justify-center shadow-lift" onClick={notifierRetrait} disabled={busy}>
                  <Bell size={15} /> Préparer mon retrait ({sel.size})
                </button>
              </div>
            )}
            {msg && <p className="card px-4 py-3 text-sm text-navy">{msg}</p>}
          </>
        )}

        {/* ═══════════ RÉCEPTIONS ═══════════ */}
        {view === "receptions" && (
          <>
            <SubHeader title="Réceptions" sub="Colis reçus · en attente de facturation" />
            {receptionsAll.length === 0 ? <Empty t="Aucun colis reçu pour le moment." /> : (
              <>
                <Totaux list={receptionsAll} />
                <div className="space-y-3">
                  {disponibles.length > 0 && (
                    <p className="text-[11px] font-bold uppercase tracking-wide text-brand-dark pt-1">
                      Disponibles ({disponibles.length})
                    </p>
                  )}
                  {disponibles.map((p) => <PkgCard key={p.id} p={p} />)}
                  {autres.length > 0 && (
                    <p className="text-[11px] font-bold uppercase tracking-wide text-mute pt-2">
                      En cours ({autres.length})
                    </p>
                  )}
                  {autres.map((p) => <PkgCard key={p.id} p={p} />)}
                </div>
              </>
            )}
          </>
        )}

        {/* ═══════════ HISTORIQUE ═══════════ */}
        {view === "historique" && (
          <>
            <SubHeader title="Historique" sub="Colis déjà facturés ou livrés" />
            {historique.length === 0 ? <Empty t="Aucun colis dans votre historique." /> : (
              <>
                <Totaux list={historique} reel />
                <div className="space-y-3">{historique.map((p) => <PkgCard key={p.id} p={p} />)}</div>
              </>
            )}
          </>
        )}

        {/* ═══════════ FACTURES ═══════════ */}
        {view === "factures" && (
          <>
            <SubHeader title="Factures" sub={`${invs.length} facture${invs.length > 1 ? "s" : ""}`} />
            {invs.length === 0 ? <Empty t="Aucune facture pour le moment." /> : (
              <div className="card divide-y divide-line">
                {invs.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-navy">{f.invoice_number}</p>
                      <p className="text-xs text-mute mt-0.5">
                        {dateFr(f.created_at)} · {f.package_count} koli · {Number(f.total_weight).toFixed(2)} lb
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-extrabold text-ink">{usd(f.grand_total)}</p>
                      {f.pdf_url
                        ? <a href={f.pdf_url} target="_blank" rel="noreferrer" className="text-xs text-navy underline font-semibold">Télécharger le PDF</a>
                        : <span className="text-xs text-slate-400">—</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══════════ NOTIFICATIONS ═══════════ */}
        {view === "notifications" && (
          <>
            <SubHeader title="Notifications" sub="Les informations importantes de votre compte" />
            {clientNotifications.length === 0 ? (
              <Empty t="Aucune notification pour le moment." />
            ) : (
              <div className="client-notification-list">
                {clientNotifications.map((notice) => (
                  <button key={notice.id} onClick={() => setView(notice.to)} className="client-notification-row client-notification-row-full">
                    <span className={`client-notice-icon client-notice-icon-${notice.kind}`}><NotificationIcon kind={notice.kind} size={20} /></span>
                    <span className="min-w-0 flex-1 text-left">
                      <strong>{notice.title}</strong>
                      <small>{notice.description}</small>
                    </span>
                    <span className="client-notice-time">{notice.stamp}</span>
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
            <SubHeader title="Guide & Aide" sub="Tout ce qu&apos;il faut savoir sur vos expéditions" />

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
                  <span>Certains articles (téléphones, ordinateurs portables, appareils photo…) ont un <b>prix forfaitaire</b> — le poids ne s&apos;applique pas.</span></li>
                <li className="flex gap-2"><span className="text-navy">•</span>
                  <span>Le prix affiché dans l&apos;application est une <b>estimation</b>. Le prix final est fixé après la pesée du colis à l&apos;entrepôt.</span></li>
              </ul>
              <button onClick={() => setView("calc")} className="btn btn-ghost border border-line w-full justify-center mt-3 !text-xs">
                <Calculator size={14} /> Ouvrir le calculateur
              </button>
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
                  ["Combien de temps prend mon colis ?",
                   "Le délai dépend de son arrivée à Miami et du transport. Consultez chaque étape dans l'application en ouvrant le colis concerné."],
                  ["Pourquoi mon colis n'apparaît-il pas encore ?",
                   "Un colis apparaît lorsque notre dépôt de Miami l'a reçu et enregistré. Si le transporteur indique qu'il est livré, attendez quelques heures puis cliquez sur Actualiser."],
                  ["Puis-je envoyer plusieurs colis ensemble ?",
                   "Oui. Tous les colis associés à votre code client sont regroupés dans votre compte et peuvent être facturés ensemble."],
                  ["Que signifie « Préparer mon retrait » ?",
                   "Cette action indique les colis que vous viendrez chercher afin que notre équipe les prépare avant votre arrivée à l'agence."],
                  ["J'ai oublié mon mot de passe.",
                   "Contactez-nous sur WhatsApp. Nous vous enverrons un mot de passe temporaire que vous pourrez ensuite modifier."],
                  ["Le prix peut-il changer ?",
                   "Le prix indiqué dans l'application est une estimation basée sur le poids. Le prix final est celui de la facture, après la pesée du colis à l'entrepôt."]
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
            <SubHeader title="Mon adresse" sub="Votre adresse de dépôt aux États-Unis" />
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
            <SubHeader title="Calculateur" sub="Estimez le coût de votre expédition" />
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
                      Transport {calcRes.smallCount > 0 ? "(petit colis)" : `(${calcRes.totalWeight.toFixed(2)} lb)`}
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setDetail(null)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-line px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">Détails du colis</h2>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-navy"><X size={19} /></button>
            </div>
            <div className="p-4 space-y-3">
              {/* SUIVI — kote koli a ye, etap pa etap */}
              <div className="rounded-xl bg-mist p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-mute mb-3">Suivi du colis</p>
                <SuiviVertical p={detail} />
              </div>

              <div className="divide-y divide-line">
                {([
                  ["Tracking ID", detail.tracking_number],
                  ["Tracking Number", detail.tracking_manual],
                  ["Contenu", detail.content],
                  ["Poids", Number(detail.weight) > 0 ? `${Number(detail.weight).toFixed(2)} lb` : ""],
                  ["Quantité", detail.quantity ? String(detail.quantity) : ""],
                  ["Statut", detail.status],
                  ["Date de réception", detail.received_at ? dateFr(detail.received_at) : ""],
                  ["Prix", Number(detail.price_usd) > 0 ? usd(detail.price_usd) : ""],
                  ["Taxes", Number(detail.tax_usd) > 0 ? usd(detail.tax_usd) : ""],
                  ["Total", Number(detail.total_usd) > 0 ? usd(detail.total_usd) : ""],
                  ["Facturé", isDone(detail) ? "Oui" : "Non"]
                ] as const).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5">
                    <span className="text-mute text-[13px] shrink-0">{k}</span>
                    <span className="font-semibold text-[13px] text-ink text-right break-all">
                      {String(v ?? "").trim() || "—"}
                    </span>
                  </div>
                ))}
              </div>
              <a href={waPkgLink(detail, client.customer_code)} target="_blank" rel="noreferrer"
                className="btn btn-wa w-full justify-center">
                <WhatsAppIcon size={15} /> Poser une question sur ce colis
              </a>
            </div>
          </div>
        </div>
      )}

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
            {pwdMsg && <p className={`text-sm rounded-lg px-3 py-2 ${pwdMsg.startsWith("✅")
              ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
              : "text-red-600 bg-red-50 border border-red-200"}`}>{pwdMsg}</p>}
            <button className="btn w-full justify-center" onClick={changePassword} disabled={pwdBusy}>
              {pwdBusy ? "Modification en cours…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {/* ══ ✅ CONFIRMATION (pwen 3) — apre chak anrejistreman reyisi ══ */}
      {toast && <SavedToast message={toast} onClose={() => setToast(null)} />}

      {/* ══ BARE NAVIGASYON ANBA ══ */}
      <nav className="client-bottom-nav fixed bottom-0 inset-x-0 z-40 border-t">
        <div className="max-w-3xl mx-auto flex items-stretch px-2 pb-[env(safe-area-inset-bottom)]">
          <NavBtn icon={FileText} label="Factures" to="factures" />
          <NavBtn icon={MapPin} label="Adresse" to="adresse" />
          <button onClick={() => setView("home")} aria-label="Accueil"
            className="flex-1 flex flex-col items-center -mt-5">
            <span className={`client-bottom-home w-14 h-14 rounded-full grid place-items-center
              ${view === "home" ? "bg-navy text-white" : "bg-navy-light text-white"}`}>
              <Package size={24} />
            </span>
            <span className="text-[10px] font-semibold text-navy mt-0.5">Accueil</span>
          </button>
          <NavBtn icon={Calculator} label="Calcul" to="calc" />
          <a href={WA_LINK} target="_blank" rel="noreferrer" className="client-nav-item flex-1 flex flex-col items-center gap-0.5 py-2 text-slate-400">
            <WhatsAppIcon size={20} /><span className="text-[10px] font-semibold">WhatsApp</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
