"use client";

import { useState } from "react";
import {
  BarChart3, ChevronLeft, ChevronRight, Clipboard, Handshake, MapPin, MessageCircle,
  Navigation, Package, PackageCheck, Sparkles, Truck
} from "lucide-react";
import type { Pkg } from "@/lib/types";
import { dateFr, usd } from "@/lib/utils";

export type ClientDashboardDestination = "adresse" | "disponibles" | "receptions" | "historique" | "retraits" | "factures" | "calc" | "notifications";

type DashboardProps = {
  clientName: string;
  destination: string;
  balanceUsd: number;
  estimatedUsd: number;
  availableCount: number;
  receptionCount: number;
  retraitCount: number;
  deliveredCount: number;
  unreadNotifications: number;
  onNavigate: (destination: ClientDashboardDestination) => void;
};

const shipmentLabel = (pkg: Pkg | null) => {
  if (!pkg) return "Aucun colis actif";
  if (pkg.status === "Disponible") return "Prêt au retrait";
  if (pkg.status === "Facturé") return "Facturé";
  if (pkg.status === "Livré") return "Livré";
  return pkg.status || "En cours";
};

function QuickAction({
  icon: Icon, label, hint, count, onClick
}: { icon: typeof Truck; label: string; hint: string; count?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex min-h-[108px] flex-col items-center justify-center gap-1.5 rounded-3xl bg-white px-2 text-center shadow-[0_12px_30px_-24px_rgba(12,67,143,.55)] ring-1 ring-sky-100 transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md">
      <span className="relative grid h-12 w-12 place-items-center rounded-2xl border border-sky-100 bg-[#eaf4ff] text-[#145ca8] transition-colors group-hover:bg-[#dcebff]">
        <Icon className="text-[#145ca8]" size={22} strokeWidth={2.1} />
        {typeof count === "number" && count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 z-10 grid h-5 min-w-5 place-items-center rounded-full bg-[#145ca8] px-1 text-[10px] font-black text-white ring-2 ring-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      <span className="text-xs font-extrabold text-slate-700">{label}</span>
      <span className="text-[10px] font-medium leading-tight text-slate-400">{hint}</span>
    </button>
  );
}

function HomeParcelIllustration() {
  return (
    <div aria-hidden className="relative h-[126px] w-[132px] shrink-0 overflow-visible">
      <span className="absolute -right-5 -top-4 h-28 w-28 rounded-full border border-sky-100 bg-sky-50" />
      <span className="absolute right-2 top-6 h-[72px] w-[77px] rotate-[-7deg] rounded-2xl border border-[#e8b878] bg-gradient-to-br from-[#ffd9a1] via-[#e6a05a] to-[#b8692f] shadow-[0_15px_24px_rgba(16,72,141,.16)]" />
      <span className="absolute right-7 top-[10px] h-[75px] w-3 rotate-[-7deg] bg-[#fff0d2]/85" />
      <span className="absolute right-[32px] top-[42px] h-[19px] w-[35px] rotate-[-7deg] rounded-md bg-white/90" />
      <span className="absolute right-[39px] top-[48px] h-1.5 w-[17px] rotate-[-7deg] rounded bg-[#57a7e9]" />
      <span className="absolute bottom-2 left-1 grid h-12 w-12 place-items-center rounded-2xl bg-[#145ca8] text-white shadow-lg shadow-blue-900/20"><PackageCheck size={23} /></span>
    </div>
  );
}

function JourneyLine() {
  const steps = ["Miami", "Disponible", "Facturé", "Livré"];
  return (
    <div className="mt-5 flex items-start">
      {steps.map((step, index) => (
        <div key={step} className="flex min-w-0 flex-1 items-start last:flex-none">
          <div className="flex min-w-0 flex-col items-center">
            <span className="h-3.5 w-3.5 rounded-full border-[3px] border-[#145ca8] bg-white shadow-[0_0_0_3px_rgba(20,92,168,.08)]" />
            <span className="mt-2 max-w-[60px] text-center text-[9px] font-bold leading-tight text-slate-600">{step}</span>
          </div>
          {index < steps.length - 1 && <span className="mt-[6px] h-px min-w-2 flex-1 bg-[#9ec5ed]" />}
        </div>
      ))}
    </div>
  );
}

export function ClientLogisticsDashboard({ clientName, destination, balanceUsd, estimatedUsd, availableCount, receptionCount, retraitCount, deliveredCount, unreadNotifications, onNavigate }: DashboardProps) {
  return (
    <section className="space-y-5">
      {unreadNotifications > 0 && (
        <button type="button" onClick={() => onNavigate("notifications")} className="flex w-full items-center gap-3 rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 transition hover:shadow-md">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-lg shadow-orange-500/30"><MessageCircle size={21} /></span>
          <span className="min-w-0 flex-1"><b className="block text-sm text-slate-900">{unreadNotifications} nouveau{unreadNotifications > 1 ? "x" : ""} message{unreadNotifications > 1 ? "s" : ""}</b><small className="mt-0.5 block text-xs text-slate-500">Consultez vos notifications</small></span>
          <ChevronRight className="text-slate-400" size={19} />
        </button>
      )}

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-sky-400 p-5 text-white shadow-md shadow-blue-600/20">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-blue-100">Solde de factures</p><p className="mt-2 text-3xl font-black tracking-tight">{usd(balanceUsd)}</p><p className="mt-1 text-xs text-blue-100">Montant restant à régler</p></div><button type="button" onClick={() => onNavigate("factures")} className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-white/15 px-3 text-xs font-bold ring-1 ring-white/20 transition hover:bg-white/25"><BarChart3 size={16} />Voir le statut</button></div>
        {estimatedUsd > 0 && <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2 text-xs font-semibold text-blue-50"><span>Estimation des colis en cours</span><span className="text-sm font-extrabold text-white">{usd(estimatedUsd)}</span></div>}
        <div className="mt-3 rounded-2xl bg-white/10 px-3 py-2 text-xs font-semibold text-blue-50">Bonjour {clientName}, toutes vos informations sont à jour.</div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black tracking-tight text-slate-900">Vos colis</h2><span className="text-[11px] font-bold text-slate-400">Vue d&apos;ensemble</span></div>
        <div className="grid grid-cols-4 gap-2.5">
          <QuickAction icon={Truck} label="Miami" hint="Colis reçus" count={receptionCount} onClick={() => onNavigate("receptions")} />
          <QuickAction icon={PackageCheck} label="Disponible" hint="Prêts à retirer" count={availableCount} onClick={() => onNavigate("disponibles")} />
          <QuickAction icon={Clipboard} label="Historique" hint="Colis livrés" count={deliveredCount} onClick={() => onNavigate("historique")} />
          <QuickAction icon={Handshake} label="Retrait" hint="Vos demandes" count={retraitCount} onClick={() => onNavigate("retraits")} />
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-white via-[#f8fbff] to-[#eaf5ff] p-5 shadow-[0_14px_32px_-28px_rgba(14,83,172,.6)]">
        <span aria-hidden className="absolute -right-12 -bottom-14 h-40 w-40 rounded-full bg-sky-100/70 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3"><div className="min-w-0"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf4ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#145ca8]"><Sparkles size={12} /> Suivi simplifié</span><h2 className="mt-3 text-lg font-black tracking-tight text-slate-900">Votre parcours, en un coup d&apos;œil</h2><p className="mt-1.5 max-w-[225px] text-xs leading-relaxed text-slate-500">Chaque colis avance au même rythme dans votre espace personnel.</p></div><HomeParcelIllustration /></div>
        <JourneyLine />
        <div className="relative mt-4 flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2.5 text-xs font-semibold text-slate-600 ring-1 ring-sky-100"><MapPin size={15} className="shrink-0 text-[#145ca8]" /><span className="truncate">Agence de retrait : {destination || "Votre agence"}</span></div>
      </section>

      <div className="sr-only">{availableCount} colis disponibles, {receptionCount} réceptions et {deliveredCount} colis livrés.</div>
    </section>
  );
}

const trackingSteps = ["Reçu à Miami", "Départ de Miami", "Arrivé en Haïti", "En route vers l’agence", "Disponible", "Facturé", "Livré"];

function activeTrackingStep(pkg: Pkg) {
  if (pkg.status === "Livré") return 6;
  if (pkg.status === "Facturé") return 5;
  if (pkg.status === "Disponible") return 4;
  if (pkg.status === "En route vers agence") return 3;
  if (pkg.status === "Arrivé en Haïti") return 2;
  if (pkg.status === "En transit") return 1;
  return 0;
}

export function ClientTrackingDetails({ pkg, customerName, destination, onClose, onContact }: { pkg: Pkg; customerName: string; destination: string; onClose: () => void; onContact: () => void }) {
  const [copiedField, setCopiedField] = useState<"guia" | "manual" | null>(null);
  const current = activeTrackingStep(pkg);

  const copyValue = async (value: string, field: "guia" | "manual") => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1500);
    } catch {
      setCopiedField(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-b from-sky-100 to-white p-3 sm:grid sm:place-items-center sm:p-5">
      <div className="mx-auto w-full max-w-md pb-5">
        <header className="flex items-center justify-between py-3"><button type="button" onClick={onClose} aria-label="Retour" className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm"><ChevronLeft size={21} /></button><h2 className="text-base font-black text-slate-900">Détails du suivi</h2><span className="w-10" /></header>
        <section className="rounded-3xl bg-white p-5 shadow-md ring-1 ring-slate-100">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Tracking ID (Guía)</p><div className="mt-1 flex items-center gap-2"><h3 className="truncate font-mono text-lg font-black text-slate-900">#{pkg.tracking_number || "—"}</h3>{pkg.tracking_number && <button type="button" onClick={() => void copyValue(pkg.tracking_number, "guia")} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600" aria-label="Copier le Tracking ID (Guía)"><Clipboard size={14} /></button>}</div>{pkg.tracking_manual && <><p className="mt-3 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Tracking Number</p><div className="mt-1 flex items-center gap-2"><h4 className="truncate font-mono text-sm font-bold text-slate-700">#{pkg.tracking_manual}</h4><button type="button" onClick={() => void copyValue(pkg.tracking_manual, "manual")} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600" aria-label="Copier le Tracking Number"><Clipboard size={13} /></button></div></>}{copiedField && <p className="mt-2 text-xs font-bold text-emerald-700">{copiedField === "guia" ? "Tracking ID (Guía) copié." : "Tracking Number copié."}</p>}</div><span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black text-violet-700">{shipmentLabel(pkg)}</span></div>
          <div className="mt-6"><div className="flex justify-between text-xs font-bold text-slate-500"><span>Miami</span><span>{destination || "Agence"}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-100"><span className="block h-full rounded-full bg-blue-600 transition-all duration-700" style={{ width: `${Math.max(14, ((current + 1) / trackingSteps.length) * 100)}%` }} /></div></div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-xs"><div className="rounded-2xl bg-sky-50 p-3"><p className="text-slate-400">Créé</p><b className="mt-1 block text-slate-700">{pkg.created_date ? dateFr(pkg.created_date) : "—"}</b></div><div className="rounded-2xl bg-sky-50 p-3"><p className="text-slate-400">Statut</p><b className="mt-1 block text-slate-700">{pkg.status || "En cours"}</b></div></div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className="text-slate-400">Expéditeur</p><b className="mt-1 block text-slate-700">STANDA Miami</b></div><div><p className="text-slate-400">Destinataire</p><b className="mt-1 block truncate text-slate-700">{customerName}</b></div><div><p className="text-slate-400">Facture</p><b className="mt-1 block text-slate-700">{pkg.invoice_id ? "Émise" : "À venir"}</b></div></div>
        </section>
        <section className="relative mt-4 overflow-hidden rounded-3xl bg-blue-600 p-5 text-white shadow-md"><div className="relative z-10"><h3 className="text-base font-black">Parcours du colis</h3><ol className="mt-5 space-y-4">{trackingSteps.map((step, index) => <li key={step} className="flex gap-3"><div className="flex flex-col items-center"><span className={`grid h-6 w-6 place-items-center rounded-full ${index < current ? "bg-white text-blue-600" : index === current ? "bg-amber-300 text-blue-900 ring-4 ring-white/20" : "border border-white/35 bg-transparent text-white/70"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" /></span>{index < trackingSteps.length - 1 && <span className={`mt-1 h-7 w-px ${index < current ? "bg-white/80" : "bg-white/25"}`} />}</div><div className="pt-0.5"><b className="block text-sm">{step}</b><small className="mt-0.5 block text-xs text-white/75">{index < current ? "Étape terminée" : index === current ? "Étape en cours" : "À venir"}</small></div></li>)}</ol></div><div className="absolute -bottom-6 -right-5 grid h-28 w-28 rotate-[-12deg] place-items-center rounded-3xl bg-amber-300/90 text-amber-800 shadow-lg"><Package size={52} strokeWidth={1.5} /></div></section>
        <button type="button" onClick={onContact} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-blue-600 bg-white text-sm font-black text-blue-600 transition hover:bg-blue-50"><Navigation size={17} />Suivi en direct</button>
      </div>
    </div>
  );
}
