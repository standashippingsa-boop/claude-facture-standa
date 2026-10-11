"use client";
/*
 * STANDA COMMERCIAL — Ba anpile pou montre pwopòsyon estati kliyan
 * ═══════════════════════════════════════════════════════════════
 * 2 (oswa 3) kategori -> legend OBLIGATWA (idantite pa ka kouche sou
 * koulè sèlman). Chak segman gen yon ti espas blan ant yo (pa yon sèl
 * blòk kontinyel), ak chif + pousantaj ekri an tèks, pa sèlman koulè.
 */
import type { StatusSlice } from "@/lib/dashboard-charts";

export default function StatusStackedBar({ slices }: { slices: StatusSlice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const nonEmpty = slices.filter((s) => s.value > 0);

  return (
    <div>
      <div
        role="img"
        aria-label={slices.map((s) => `${s.label} : ${s.value}`).join(", ")}
        className="flex h-5 w-full gap-[2px]"
      >
        {nonEmpty.length ? nonEmpty.map((s) => (
          <div key={s.label} title={`${s.label} : ${s.value}`}
            className="h-full rounded-full"
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }} />
        )) : <div className="h-full w-full rounded-full bg-line" />}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="font-bold text-ink">{s.value}</span>
            <span className="text-mute">{s.label}</span>
            <span className="text-mute">({Math.round((s.value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
