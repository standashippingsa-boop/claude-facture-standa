"use client";
import { Check, Truck } from "lucide-react";
import { INTERNAL_STATUSES } from "@/lib/types";

/**
 * Konpozan estati reutilizab — STANDA COMMERCIAL
 * ══════════════════════════════════════════════
 * <StatusPill status="Disponible" />  -> ti badge kolore
 * <StatusTimeline status="En transit" /> -> etap konekte (estil suivi livrezon)
 *
 * Koulè yo swiv pwogresyon koli a. Pa gen okenn lojik metye isit —
 * se afichaj sèlman.
 */

// Map estati -> koulè pill
const PILL: Record<string, string> = {
  "Reçu à Miami": "pill-blue",
  "En préparation": "pill-blue",
  "En transit": "pill-amber",
  "Arrivé en Haïti": "pill-amber",
  "En route vers agence": "pill-amber",
  "Disponible": "pill-green",
  "Livré": "pill-gray",
  "Facturé": "pill-green"
};

export function StatusPill({ status }: { status: string }) {
  const cls = PILL[status] ?? "pill-gray";
  return (
    <span className={`pill ${cls}`}>
      <span className="pill-dot" /> {status}
    </span>
  );
}

/**
 * Route de progression : une ligne unique, avec un camion qui avance
 * dessus selon l'étape atteinte (au lieu d'une suite de petits points).
 * Livré = coche à l'arrivée. Étape actuelle = position du camion.
 */
export function StatusTimeline({ status, compact = false }: {
  status: string; compact?: boolean;
}) {
  // Les deux dernières étapes font partie de l'affichage client, sans
  // modifier la machine de statuts utilisée par les opérations.
  const operationalSteps = (INTERNAL_STATUSES as readonly string[]).filter((step) => step !== "Livré");
  const steps = [...operationalSteps, "Facturé", "Livré"];
  let idx = operationalSteps.indexOf(status);
  if (status === "Facturé") idx = steps.indexOf("Facturé");
  if (status === "Livré") idx = steps.length - 1;
  if (idx < 0) idx = 0;
  const delivered = status === "Livré";
  const percent = Math.min(100, Math.max(6, ((idx + 1) / steps.length) * 100));
  const markerSize = compact ? 16 : 22;
  const iconSize = compact ? 9 : 12;

  return (
    <div className="w-full">
      <div className={`relative w-full rounded-full bg-slate-200 ${compact ? "h-1" : "h-1.5"}`} style={{ marginTop: markerSize / 2, marginBottom: markerSize / 2 }}>
        <span className="absolute inset-y-0 left-0 rounded-full bg-brand transition-all duration-500" style={{ width: `${percent}%` }} />
        <span
          className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-brand text-white shadow-sm transition-all duration-500"
          style={{ left: `${percent}%`, height: markerSize, width: markerSize }}
        >
          {delivered ? <Check size={iconSize} strokeWidth={3} /> : <Truck size={iconSize} strokeWidth={2.5} />}
        </span>
      </div>
      {!compact && (
        <div className="flex items-center justify-between text-[10px] font-semibold text-mute">
          <span>Miami</span>
          <span className={delivered ? "text-ink" : undefined}>{steps[steps.length - 1]}</span>
        </div>
      )}
    </div>
  );
}
