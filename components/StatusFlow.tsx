"use client";
import { Check } from "lucide-react";
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
export function StatusTimeline({ status, compact = false }: { status: string; compact?: boolean }) {
  // "Facturé" konte kòm "Livré" nan liy tan an (fen pwosesis)
  const steps = INTERNAL_STATUSES as readonly string[];
  let idx = steps.indexOf(status);
  if (status === "Facturé") idx = steps.length - 1;
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
              <div className={`flex items-center justify-center rounded-full transition-colors ${
                compact ? "w-5 h-5" : "w-7 h-7"} ${
                current ? "bg-brand text-white ring-4 ring-brand-light"
                  : done ? "bg-brand text-white"
                  : "bg-slate-200 text-slate-400"}`}>
                {done || current ? <Check size={compact ? 11 : 14} /> : <span className={`rounded-full ${compact ? "w-1.5 h-1.5" : "w-2 h-2"} bg-current`} />}
              </div>
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
