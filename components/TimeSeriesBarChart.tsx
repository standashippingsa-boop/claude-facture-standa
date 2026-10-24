"use client";
/*
 * STANDA COMMERCIAL — Grafik ba (tandans tan) pou Dashboard admin
 * ═══════════════════════════════════════════════════════════════
 * Yon sèl seri (yon koulè) — pa gen legend (tit la deja di sa l ye).
 * Ba "pic" la (pi gwo valè a) rete an koulè plen; lòt yo pi klè — konsa
 * je a jwenn pi gwo a san li bezwen li chak chif. Valè egzak yo disponib
 * nan tooltip (hover) ak nan `aria-label` (aksè san siye/klavye).
 */
import { useId, useState } from "react";
import type { SeriesPoint } from "@/lib/dashboard-charts";
import { peakIndex } from "@/lib/dashboard-charts";

export default function TimeSeriesBarChart({
  series, color, unit = "colis", height = 140,
}: { series: SeriesPoint[]; color: string; unit?: string; height?: number }) {
  const uid = useId();
  const [hoverI, setHoverI] = useState<number | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const max = Math.max(1, ...series.map((p) => p.value));
  const peak = peakIndex(series);
  const showLabel = (i: number) =>
    series.length <= 8 || i === 0 || i === series.length - 1 || i === peak;

  return (
    <div className="relative">
      <div
        role="img"
        aria-label={series.map((p) => `${p.label} : ${p.value} ${unit}`).join(", ")}
        className="flex items-end gap-[3px]"
        style={{ height }}
      >
        {series.map((p, i) => {
          const h = p.value > 0 ? Math.max(3, Math.round((p.value / max) * (height - 6))) : 1;
          const isPeak = i === peak;
          return (
            <div
              key={`${uid}-${p.key}`}
              className="group relative flex h-full min-w-0 flex-1 cursor-default flex-col items-center justify-end"
              onMouseEnter={(e) => { setHoverI(i); setPos({ x: e.clientX, y: e.clientY }); }}
              onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHoverI(null)}
            >
              <div
                className="w-full rounded-t-[4px] transition-[opacity,height] duration-150"
                style={{ height: h, backgroundColor: color, opacity: isPeak ? 1 : 0.4 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px]" aria-hidden="true">
        {series.map((p, i) => (
          <div key={`${uid}-lbl-${p.key}`} className="min-w-0 flex-1 text-center">
            {showLabel(i) && (
              <span className={`text-[9.5px] whitespace-nowrap ${i === peak ? "font-bold text-ink" : "text-mute"}`}>
                {p.label}
              </span>
            )}
          </div>
        ))}
      </div>

      {hoverI !== null && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg bg-navy px-2.5 py-1.5 text-xs font-semibold text-white shadow-lift"
          style={{
            left: Math.min(pos.x + 12, (typeof window !== "undefined" ? window.innerWidth : 1200) - 170),
            top: Math.max(8, pos.y - 44),
          }}
        >
          {series[hoverI].label}  {series[hoverI].value} {unit}
        </div>
      )}
    </div>
  );
}
