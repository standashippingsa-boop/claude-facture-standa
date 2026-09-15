"use client";
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
 * Timeline orizontal ki montre kote koli a ye nan pwosesis la.
 * Etap ki fèt = ranpli (vèt/navy), etap aktyèl = mete aksan, rès = gri.
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

  return (
    <div className={`flex items-center w-full ${compact ? "gap-0" : "gap-0"}`}>
      {steps.map((s, i) => {
        const done = i < idx;
        const current = i === idx;
        const reached = i <= idx;
        return (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <span className={`block rounded-full transition-all ${
                compact ? "h-3 w-3" : "h-4 w-4"} ${
                current ? "bg-brand ring-4 ring-brand-light"
                  : done ? "bg-brand"
                  : "bg-slate-200"}`} />
              {!compact && (
                <span className={`mt-1.5 text-[10px] text-center leading-tight max-w-[64px] ${
                  reached ? "text-ink font-semibold" : "text-mute"}`}>{s}</span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${compact ? "mb-0" : "mb-5"} ${i < idx ? "bg-brand" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
