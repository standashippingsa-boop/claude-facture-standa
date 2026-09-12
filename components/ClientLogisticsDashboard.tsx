"use client";

import { useState } from "react";
import {
  BarChart3, Check, ChevronLeft, ChevronRight, Clipboard, Handshake, MessageCircle,
  Navigation, Package, PackageCheck, Search,
  Send, Truck, WalletCards
} from "lucide-react";
import type { Pkg } from "@/lib/types";
import { dateFr, usd } from "@/lib/utils";

export type ClientDashboardDestination = "adresse" | "disponibles" | "receptions" | "historique" | "retraits" | "factures" | "calc" | "notifications";

type DashboardProps = {
  clientName: string;
  destination: string;
  balanceUsd: number;
  estimatedUsd: number;
  activePackage: Pkg | null;
  recentPackages: Pkg[];
  availableCount: number;
  receptionCount: number;
  retraitCount: number;
  invoiceCount: number;
  unreadNotifications: number;
  onNavigate: (destination: ClientDashboardDestination) => void;
  onOpenTracking: (pkg: Pkg) => void;
};

const shipmentState = (pkg: Pkg | null) => {
  if (!pkg) return 0;
  if (["Disponible", "Facturé", "Livré"].includes(pkg.status)) return 2;
  if (["En transit", "Arrivé en Haïti", "En route vers agence"].includes(pkg.status)) return 1;
  return 0;
};

const shipmentLabel = (pkg: Pkg | null) => {
  if (!pkg) return "Aucun colis actif";
  if (["Disponible", "Facturé"].includes(pkg.status)) return "Prêt au retrait";
  if (pkg.status === "Livré") return "Livré";
  return pkg.status || "En cours";
};

function QuickAction({
  icon: Icon, label, hint, tone, count, onClick
}: { icon: typeof Truck; label: string; hint: string; tone: "orange" | "blue" | "cyan" | "purple"; count?: number; onClick: () => void }) {
  const tones = {
    orange: "from-orange-400 to-orange-600 shadow-orange-500/30",
    blue: "from-blue-400 to-blue-600 shadow-blue-500/30",
    cyan: "from-cyan-400 to-cyan-600 shadow-cyan-500/30",
    purple: "from-violet-400 to-violet-600 shadow-violet-500/30"
  };
  return <button type="button" onClick={onClick} className="group flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-3xl bg-white px-2 text-center shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md">
    <span className="relative">
      <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${tones[tone]} text-white shadow-lg transition group-hover:scale-105`}>
        <Icon size={22} strokeWidth={2.25} />
      </span>
      {typeof count === "number" && count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ring-2 ring-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </span>
    <span className="text-xs font-extrabold text-slate-700">{label}</span>
    <span className="text-[10px] font-medium leading-tight text-slate-400">{hint}</span>
  </button>;
}

function ShipmentProgress({ stage }: { stage: number }) {
  const steps = ["Reçu", "En transit", "Disponible"];
  return <div className="mt-5"><div className="relative flex items-center justify-between before:absolute before:left-[12%] before:right-[12%] before:top-3 before:h-1 before:rounded-full before:bg-slate-200"><span className="absolute left-[12%] top-3 h-1 rounded-full bg-blue-600 transition-all duration-700" style={{ width: stage === 0 ? "0%" : stage === 1 ? "38%" : "76%" }} />{steps.map((label, index) => <div key={label} className="relative z-10 flex flex-col items-center gap-2"><span className={`grid h-7 w-7 place-items-center rounded-full border-2 ${index <= stage ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-300"}`}>{index < stage ? <Check size={14} strokeWidth={3} /> : index + 1}</span><span className={`text-[10px] font-bold ${index <= stage ? "text-slate-700" : "text-slate-400"}`}>{label}</span></div>)}</div></div>;
}

export function ClientLogisticsDashboard({ clientName, destination, balanceUsd, estimatedUsd, activePackage, recentPackages, availableCount, receptionCount, retraitCount, invoiceCount, unreadNotifications, onNavigate, onOpenTracking }: DashboardProps) {
  const stage = shipmentState(activePackage);
  return <section className="space-y-5">
    {unreadNotifications > 0 && <button type="button" onClick={() => onNavigate("notifications")} className="flex w-full items-center gap-3 rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 transition hover:shadow-md"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-lg shadow-orange-500/30"><MessageCircle size={21} /></span><span className="min-w-0 flex-1"><b className="block text-sm text-slate-900">{unreadNotifications} nouveau{unreadNotifications > 1 ? "x" : ""} message{unreadNotifications > 1 ? "s" : ""}</b><small className="mt-0.5 block text-xs text-slate-500">Consultez vos notifications</small></span><ChevronRight className="text-slate-400" size={19} /></button>}

    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-sky-400 p-5 text-white shadow-md shadow-blue-600/20">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-blue-100">Solde de factures</p><p className="mt-2 text-3xl font-black tracking-tight">{usd(balanceUsd)}</p><p className="mt-1 text-xs text-blue-100">Montant restant à régler</p></div><button type="button" onClick={() => onNavigate("factures")} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-white/15 px-3 text-xs font-bold ring-1 ring-white/20 transition hover:bg-white/25"><BarChart3 size={16} />Voir le statut</button></div>
      {estimatedUsd > 0 && <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2 text-xs font-semibold text-blue-50"><span>Estimation des colis en cours</span><span className="text-sm font-extrabold text-white">{usd(estimatedUsd)}</span></div>}
      <div className="mt-3 rounded-2xl bg-white/10 px-3 py-2 text-xs font-semibold text-blue-50">Bonjour {clientName}, toutes vos informations sont à jour.</div>
    </section>

    <section><h2 className="mb-3 text-lg font-black tracking-tight text-slate-900">Vos colis</h2><div className="grid grid-cols-4 gap-2.5">
      <QuickAction icon={Truck} label="Miami" hint="Colis reçus" tone="orange" count={receptionCount} onClick={() => onNavigate("receptions")} />
      <QuickAction icon={PackageCheck} label="Disponible" hint="Prêts à retirer" tone="blue" count={availableCount} onClick={() => onNavigate("disponibles")} />
      <QuickAction icon={Clipboard} label="Historique" hint="Colis livrés" tone="cyan" onClick={() => onNavigate("historique")} />
      <QuickAction icon={Handshake} label="Retrait" hint="Vos demandes" tone="purple" count={retraitCount} onClick={() => onNavigate("retraits")} />
    </div></section>

    <section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black tracking-tight text-slate-900">Envoi en cours</h2>{activePackage && <button type="button" onClick={() => onOpenTracking(activePackage)} className="text-xs font-bold text-blue-600">Détails</button>}</div>{activePackage ? <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Numéro de suivi</p><p className="mt-1 truncate font-mono text-lg font-black text-slate-900">#{activePackage.tracking_number || activePackage.tracking_manual}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${stage === 2 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{shipmentLabel(activePackage)}</span></div><ShipmentProgress stage={stage} /><div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs"><div><p className="text-slate-400">Destination</p><p className="mt-1 font-bold text-slate-700">{destination || "Votre agence"}</p></div><div className="text-right"><p className="text-slate-400">Mise à jour</p><p className="mt-1 font-bold text-slate-700">{activePackage.received_at ? dateFr(activePackage.received_at) : "En cours"}</p></div></div><button type="button" onClick={() => onOpenTracking(activePackage)} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-black text-white shadow-sm transition hover:bg-blue-700">Voir le suivi <ChevronRight size={17} /></button></article> : <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">Aucun colis actif pour le moment.</div>}</section>

    <section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black tracking-tight text-slate-900">Envois récents</h2><button type="button" onClick={() => onNavigate("receptions")} className="text-xs font-bold text-blue-600">Voir tout</button></div><div className="space-y-2.5">{recentPackages.slice(0, 2).map((pkg) => <button key={pkg.id} type="button" onClick={() => onOpenTracking(pkg)} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-slate-100 transition hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-md shadow-blue-500/25"><Package size={19} /></span><span className="min-w-0 flex-1"><b className="block truncate text-sm text-slate-800">{pkg.content || "Colis STANDA"}</b><small className="mt-0.5 block truncate font-mono text-[11px] text-slate-500">#{pkg.tracking_number || pkg.tracking_manual}</small></span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${pkg.status === "Livré" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{pkg.status === "Livré" ? "Livré" : pkg.status || "En cours"}</span></button>)}{!recentPackages.length && <p className="rounded-2xl bg-white px-4 py-5 text-center text-sm text-slate-500 shadow-sm">Vos prochains envois apparaîtront ici.</p>}</div></section>

    <div className="sr-only">{availableCount} colis disponibles, {receptionCount} réceptions et {invoiceCount} factures.</div>
  </section>;
}

const trackingSteps = ["Reçu à Miami", "Départ de Miami", "Arrivé en Haïti", "En route vers l’agence", "Disponible"];

function activeTrackingStep(pkg: Pkg) {
  if (["Disponible", "Facturé", "Livré"].includes(pkg.status)) return 4;
  if (pkg.status === "En route vers agence") return 3;
  if (pkg.status === "Arrivé en Haïti") return 2;
  if (pkg.status === "En transit") return 1;
  return 0;
}

export function ClientTrackingDetails({ pkg, customerName, destination, onClose, onContact }: { pkg: Pkg; customerName: string; destination: string; onClose: () => void; onContact: () => void }) {
  const [copied, setCopied] = useState(false);
  const current = activeTrackingStep(pkg);
  const tracking = pkg.tracking_number || pkg.tracking_manual || "—";
  const copyTracking = async () => {
    try { await navigator.clipboard?.writeText(tracking); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); }
  };
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-b from-sky-100 to-white p-3 sm:grid sm:place-items-center sm:p-5"><div className="mx-auto w-full max-w-md pb-5"><header className="flex items-center justify-between py-3"><button type="button" onClick={onClose} aria-label="Retour" className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm"><ChevronLeft size={21} /></button><h2 className="text-base font-black text-slate-900">Détails du suivi</h2><span className="w-10" /></header><section className="rounded-3xl bg-white p-5 shadow-md ring-1 ring-slate-100"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Expédition</p><div className="mt-1 flex items-center gap-2"><h3 className="font-mono text-xl font-black text-slate-900">#{tracking}</h3><button type="button" onClick={() => void copyTracking()} className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600" aria-label="Copier le numéro de suivi"><Clipboard size={15} /></button></div></div><span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black text-violet-700">{shipmentLabel(pkg)}</span></div><div className="mt-6"><div className="flex justify-between text-xs font-bold text-slate-500"><span>Miami</span><span>{destination || "Agence"}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-100"><span className="block h-full rounded-full bg-blue-600 transition-all duration-700" style={{ width: `${Math.max(14, (current + 1) * 20)}%` }} /></div></div><div className="mt-5 grid grid-cols-2 gap-3 text-xs"><div className="rounded-2xl bg-sky-50 p-3"><p className="text-slate-400">Créé</p><b className="mt-1 block text-slate-700">{pkg.created_date ? dateFr(pkg.created_date) : "—"}</b></div><div className="rounded-2xl bg-sky-50 p-3"><p className="text-slate-400">Statut</p><b className="mt-1 block text-slate-700">{pkg.status || "En cours"}</b></div></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className="text-slate-400">Expéditeur</p><b className="mt-1 block text-slate-700">STANDA Miami</b></div><div><p className="text-slate-400">Destinataire</p><b className="mt-1 block truncate text-slate-700">{customerName}</b></div><div><p className="text-slate-400">Facture</p><b className="mt-1 block text-slate-700">{pkg.invoice_id ? "Émise" : "À venir"}</b></div></div></section><section className="relative mt-4 overflow-hidden rounded-3xl bg-blue-600 p-5 text-white shadow-md"><div className="relative z-10"><h3 className="text-base font-black">Parcours du colis</h3><ol className="mt-5 space-y-4">{trackingSteps.map((step, index) => <li key={step} className="flex gap-3"><div className="flex flex-col items-center"><span className={`grid h-6 w-6 place-items-center rounded-full ${index < current ? "bg-white text-blue-600" : index === current ? "bg-amber-300 text-blue-900 ring-4 ring-white/20" : "bg-white/20 text-white/70"}`}>{index < current ? <Check size={13} strokeWidth={3} /> : <span className="text-[10px] font-black">{index + 1}</span>}</span>{index < trackingSteps.length - 1 && <span className={`mt-1 h-7 w-px ${index < current ? "bg-white/80" : "bg-white/25"}`} />}</div><div className="pt-0.5"><b className="block text-sm">{step}</b><small className="mt-0.5 block text-xs text-white/75">{index < current ? "Étape terminée" : index === current ? "Étape en cours" : "À venir"}</small></div></li>)}</ol></div><div className="absolute -bottom-6 -right-5 grid h-28 w-28 rotate-[-12deg] place-items-center rounded-3xl bg-amber-300/90 text-amber-800 shadow-lg"><Package size={52} strokeWidth={1.5} /></div></section><button type="button" onClick={onContact} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-blue-600 bg-white text-sm font-black text-blue-600 transition hover:bg-blue-50"><Navigation size={17} />Suivi en direct</button>{copied && <p className="mt-2 text-center text-xs font-bold text-emerald-700">Numéro de suivi copié.</p>}</div></div>;
}
