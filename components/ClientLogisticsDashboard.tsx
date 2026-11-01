"use client";

import { useState } from "react";
import {
  ChevronLeft, ChevronRight, CircleCheck, Copy as Clipboard, Clock, MessageCircle,
  Navigation, Package, Receipt, Store, Warehouse
} from "@/components/icons";
import { motion } from "motion/react";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import type { Pkg } from "@/lib/types";
import { RouteStrip, notchMask } from "@/components/ClientParcelUI";
import { dateFr } from "@/lib/utils";

export type ClientDashboardDestination = "adresse" | "disponibles" | "colisFactures" | "receptions" | "historique" | "retraits" | "factures" | "calc" | "notifications";

type DashboardProps = {
  /** Colis au statut "Disponible" uniquement (pas encore facturé). */
  availableCount: number;
  /** Colis au statut "Facturé" (déjà facturé, pas encore remis). */
  invoicedCount: number;
  receptionCount: number;
  retraitCount: number;
  deliveredCount: number;
  unreadNotifications: number;
  onNavigate: (destination: ClientDashboardDestination) => void;
};

const shipmentLabel = (pkg: Pkg | null) => {
  if (!pkg) return "Aucun colis actif";
  if (pkg.status === "Disponible") return "Disponible";
  if (pkg.status === "Facturé") return "Facturé";
  if (pkg.status === "Livré") return "Livré";
  return pkg.status || "En cours";
};

function QuickAction({
  icon: Icon, label, hint, count, onClick
}: { icon: typeof Package; label: string; hint: string; count?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-[0_12px_30px_-24px_rgba(12,67,143,.55)] ring-1 ring-sky-100 transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy text-white">
        <Icon size={20} strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-slate-700">{label}</span>
        <span className="block text-[11px] font-medium leading-tight text-slate-400">{hint}</span>
      </span>
      {typeof count === "number" && count > 0 && (
        <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-navy px-1.5 text-[11px] font-black text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
      <ChevronRight size={16} className="shrink-0 text-slate-300" />
    </button>
  );
}

export function ClientLogisticsDashboard({ availableCount, invoicedCount, receptionCount, retraitCount, deliveredCount, unreadNotifications, onNavigate }: DashboardProps) {
  return (
    <section className="space-y-5">
      {unreadNotifications > 0 && (
        <button type="button" onClick={() => onNavigate("notifications")} className="flex w-full items-center gap-3 rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 transition hover:shadow-md">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-lg shadow-orange-500/30"><MessageCircle size={21} /></span>
          <span className="min-w-0 flex-1"><b className="block text-sm text-slate-900">{unreadNotifications} nouveau{unreadNotifications > 1 ? "x" : ""} message{unreadNotifications > 1 ? "s" : ""}</b><small className="mt-0.5 block text-xs text-slate-500">Consultez vos notifications</small></span>
          <ChevronRight className="text-slate-400" size={19} />
        </button>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-black tracking-tight text-slate-900">Vos colis</h2>
          <button type="button" onClick={() => onNavigate("historique")} className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600">
            <Clock size={12} /> Historique
          </button>
        </div>
        <div className="space-y-2">
          <QuickAction icon={Warehouse} label="Miami" hint="Colis reçus" count={receptionCount} onClick={() => onNavigate("receptions")} />
          <QuickAction icon={Package} label="Disponible" hint="À l'agence" count={availableCount} onClick={() => onNavigate("disponibles")} />
          <QuickAction icon={Receipt} label="Facturé" hint="À régler/retirer" count={invoicedCount} onClick={() => onNavigate("colisFactures")} />
          <QuickAction icon={Store} label="Retrait" hint="Vos demandes" count={retraitCount} onClick={() => onNavigate("retraits")} />
        </div>
      </section>

      <div className="sr-only">{availableCount} colis disponibles, {invoicedCount} colis facturés, {receptionCount} réceptions et {deliveredCount} colis livrés.</div>
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

/** Date lisible du colis : la première date valide (MCPACK, réception, création). Jamais « Invalid Date ». */
function parcelDate(pkg: Pkg): string {
  const candidates = [pkg.created_date, pkg.received_at, (pkg as Pkg & { created_at?: string }).created_at];
  for (const value of candidates) {
    if (!value) continue;
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T12:00:00" : value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  }
  return "·";
}

export function ClientTrackingDetails({ pkg, customerName, destination, onClose, onContact }: { pkg: Pkg; customerName: string; destination: string; onClose: () => void; onContact: () => void }) {
  const [copiedField, setCopiedField] = useState<"guia" | "manual" | null>(null);
  const current = activeTrackingStep(pkg);
  const weight = Number(pkg.weight) || 0;

  const copyValue = async (value: string, field: "guia" | "manual") => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedField(field);
      toast.success(field === "guia" ? "Numéro de suivi copié" : "Numéro du transporteur copié");
      window.setTimeout(() => setCopiedField(null), 1500);
    } catch {
      setCopiedField(null);
    }
  };

  const Field = ({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) => <div className={`min-w-0 ${wide ? "col-span-2" : ""}`}>
    <p className="text-[9.5px] font-medium tracking-[.16em] text-navy/40">{label}</p>
    <p className={`mt-1 text-[13.5px] font-semibold leading-snug text-navy ${wide ? "" : "truncate"}`}>{value}</p>
  </div>;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#eef2f8] p-3 sm:grid sm:place-items-center sm:p-5">
      <motion.div initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="mx-auto w-full max-w-md pb-5">
        <header className="flex items-center justify-between py-3">
          <button type="button" onClick={onClose} aria-label="Retour" className="grid h-11 w-11 place-items-center rounded-full bg-white text-navy shadow-[0_1px_2px_rgba(0,0,0,.05)]"><ChevronLeft size={20} /></button>
          <h2 className="text-[15px] font-semibold text-navy">Détails du suivi</h2>
          <span className="w-11" />
        </header>

        {/* Étiquette du colis */}
        <section className="overflow-hidden rounded-[26px] bg-white ring-1 ring-[#122B5C]/[.07]" style={notchMask(150)}>
          <div className="bg-navy px-5 pb-5 pt-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[10.5px] font-medium tracking-[.18em] text-[#ffb27a]">N° DE SUIVI</p>
              <span className="shrink-0 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-semibold">{shipmentLabel(pkg)}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <h3 className="min-w-0 truncate font-mono text-[20px] font-semibold tracking-tight">{pkg.tracking_number || "·"}</h3>
              {pkg.tracking_number && <button type="button" onClick={() => void copyValue(pkg.tracking_number, "guia")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/12 text-white" aria-label="Copier le numéro de suivi"><Clipboard size={14} /></button>}
            </div>
            {pkg.tracking_manual && <div className="mt-1 flex items-center gap-2">
              <p className="min-w-0 truncate font-mono text-[12.5px] text-white/60">{pkg.tracking_manual}</p>
              <button type="button" onClick={() => void copyValue(pkg.tracking_manual, "manual")} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/12 text-white" aria-label="Copier le numéro du transporteur"><Clipboard size={12} /></button>
            </div>}
            <div className="mt-5"><RouteStrip status={pkg.status} onDark /></div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-4 px-5 py-5">
            <Field label="DE" value="STANDA · Miami" />
            <Field label="POUR" value={customerName} />
            <Field label="AGENCE DE RETRAIT" value={destination || "Votre agence"} wide />
          </div>
          <div className="mx-3 border-t border-dashed border-navy/15" />
          <div className="grid h-[150px] grid-cols-2 content-center gap-x-4 gap-y-4 px-5">
            <Field label="REÇU LE" value={parcelDate(pkg)} />
            <Field label="POIDS" value={weight > 0 ? `${weight.toFixed(2)} lb` : "·"} />
            <Field label="CONTENU" value={pkg.content || "Non précisé"} />
            <Field label="FACTURE" value={pkg.invoice_id ? "Émise" : "À venir"} />
          </div>
        </section>

        {/* Parcours */}
        <section className="mt-3 rounded-[26px] bg-white p-5 ring-1 ring-[#122B5C]/[.07]">
          <h3 className="text-[15px] font-semibold text-navy">Parcours du colis</h3>
          <ol className="mt-4">
            {trackingSteps.map((step, index) => {
              const done = index < current || (step === "Livré" && current === index);
              const now = index === current && step !== "Livré";
              return <li key={step} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${done ? (step === "Livré" ? "bg-emerald-600 text-white" : "bg-navy text-white") : now ? "bg-[#E4650A] text-white ring-4 ring-[#E4650A]/20" : "border-2 border-navy/15 bg-white"}`}>
                    {done ? <CircleCheck size={13} /> : now ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                  </span>
                  {index < trackingSteps.length - 1 && <span className={`my-1 w-[2px] flex-1 rounded-full ${index < current ? "bg-navy" : "bg-navy/10"}`} style={{ minHeight: 22 }} />}
                </div>
                <div className={`pb-4 ${index < trackingSteps.length - 1 ? "" : "pb-0"}`}>
                  <p className={`text-[14px] leading-6 ${done || now ? "font-semibold text-navy" : "text-navy/40"}`}>{step}</p>
                  <p className={`text-[12px] ${now ? "font-medium text-[#c2410c]" : "text-navy/45"}`}>{step === "Livré" && current === index ? "Livraison terminée" : done ? "Étape terminée" : now ? "Étape en cours" : "À venir"}</p>
                </div>
              </li>;
            })}
          </ol>
        </section>

        <Button onClick={onContact} size="lg" block className="mt-3"><MessageCircle size={17} />Une question sur ce colis ? WhatsApp</Button>
      </motion.div>
    </div>
  );
}
