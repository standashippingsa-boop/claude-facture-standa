"use client";
/**
 * ESPACE CLIENT — langage visuel « étiquette d'expédition ».
 * Chaque colis ressemble à une vraie étiquette : numéro en chasse fixe, trajet
 * Miami → Transit → Haïti → Agence, ligne pointillée détachable (encoches
 * découpées par un masque CSS, donc transparentes sur n'importe quel fond).
 * Présentation seulement : toutes les données et actions viennent des props.
 */
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Check } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { Pkg } from "@/lib/types";

const STOPS = ["Miami", "Transit", "Haïti", "Agence"] as const;
const usd = (n: number) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lb = (n: number) => `${Number(n || 0).toFixed(2)} lb`;

/** Position du colis sur le trajet : 0 = Miami … 3 = Agence (valeurs intermédiaires = entre deux arrêts). */
export function routePosition(status: string): number {
  switch (status) {
    case "Reçu à Miami": return 0;
    case "En préparation": return 0.45;
    case "En transit": return 1;
    case "Arrivé en Haïti": return 2;
    case "En route vers agence": return 2.5;
    case "Disponible": case "Facturé": case "Livré": return 3;
    default: return 0;
  }
}

/** Étape regroupée pour les compteurs du manifeste. */
export function stageOf(status: string): 0 | 1 | 2 | 3 {
  const pos = routePosition(status);
  return pos < 1 ? 0 : pos < 2 ? 1 : pos < 3 ? 2 : 3;
}

function stageTone(status: string) {
  if (status === "Livré") return "bg-emerald-50 text-emerald-700";
  if (status === "Facturé") return "bg-blue-50 text-blue-700";
  if (status === "Disponible") return "bg-orange-50 text-[#c2410c]";
  if (stageOf(status) === 2) return "bg-violet-50 text-violet-700";
  return "bg-sky-50 text-sky-800";
}

export function RouteStrip({ status, onDark = false }: { status: string; onDark?: boolean }) {
  const pos = routePosition(status);
  const done = status === "Livré";
  const pct = (pos / 3) * 100;
  return <div className="pt-1" aria-label={`Trajet : ${status}`}>
    <div className="relative mx-[5px] h-[3px] rounded-full" style={{ background: onDark ? "rgba(255,255,255,.18)" : "rgba(18,43,92,.10)" }}>
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: done ? "#059669" : onDark ? "#fff" : "#122B5C" }} />
      {STOPS.map((stop, i) => {
        const reached = pos >= i;
        const current = !done && Math.floor(pos) === i && (pos === i || i === 3);
        return <span key={stop} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{
          left: `${(i / 3) * 100}%`, width: current ? 11 : 7, height: current ? 11 : 7,
          background: reached ? (done ? "#059669" : onDark ? "#fff" : "#122B5C") : onDark ? "#3b5384" : "#d6dde9",
          boxShadow: current ? "0 0 0 4px rgba(228,101,10,.22)" : undefined,
          outline: current ? "2px solid #E4650A" : undefined
        }} />;
      })}
      {!Number.isInteger(pos) && !done && <span className="absolute top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E4650A]" style={{ left: `${pct}%`, boxShadow: "0 0 0 4px rgba(228,101,10,.22)" }} />}
    </div>
    <div className="mt-2 grid grid-cols-4 text-[10px] font-medium tracking-[.06em]">
      {STOPS.map((stop, i) => <span key={stop} className={`${i === 0 ? "text-left" : i === 3 ? "text-right" : "text-center"} ${pos >= i ? (onDark ? "text-white" : "text-navy") : onDark ? "text-white/40" : "text-navy/35"}`}>{stop.toUpperCase()}</span>)}
    </div>
  </div>;
}

/** Encoches latérales à `fromBottom` px du bas (masque CSS : vraiment découpées). */
export function notchMask(fromBottom: number) {
  const m = `radial-gradient(circle 8px at 0 calc(100% - ${fromBottom}px), transparent 98%, #000 100%) left / 51% 100% no-repeat, radial-gradient(circle 8px at 100% calc(100% - ${fromBottom}px), transparent 98%, #000 100%) right / 51% 100% no-repeat`;
  return { WebkitMask: m, mask: m } as const;
}

/** Code-barres décoratif, stable pour un même texte. */
export function Barcode({ value, className = "", color = "#122B5C" }: { value: string; className?: string; color?: string }) {
  const bars: number[] = [];
  for (const ch of (value || "STANDA").repeat(3).slice(0, 36)) { const c = ch.charCodeAt(0); bars.push(1 + (c % 3), 1 + ((c >> 2) % 2)); }
  let x = 0;
  const rects = bars.map((w, i) => { const r = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={40} fill={color} /> : null; x += w + 0.6; return r; });
  return <svg aria-hidden="true" viewBox={`0 0 ${x} 40`} preserveAspectRatio="none" className={className}>{rects}</svg>;
}

export function ParcelCard({ p, onOpen, price, invoicedPrice, special, selector }: {
  p: Pkg; onOpen: () => void; price?: number | null; invoicedPrice?: number | null; special?: boolean;
  selector?: { selected: boolean; disabled: boolean; title?: string; onToggle: () => void };
}) {
  const weight = Number(p.weight) || 0;
  const shown = invoicedPrice ?? price ?? null;
  return <motion.article layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    className={cn("relative mb-3 overflow-hidden rounded-[22px] bg-white transition-shadow", selector?.selected ? "ring-2 ring-[#E4650A]" : "ring-1 ring-[#122B5C]/[.07]")} style={notchMask(54)}>
    <button type="button" onClick={onOpen} className="block w-full text-left">
      <div className="px-4 pb-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-[.16em] text-navy/40">N° DE SUIVI</p>
            <p className="mt-0.5 truncate font-mono text-[15px] font-semibold tracking-tight text-navy">{p.tracking_number || "·"}</p>
            {p.tracking_manual && <p className="truncate font-mono text-[11px] text-navy/45">{p.tracking_manual}</p>}
          </div>
          {!selector && <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${stageTone(p.status)}`}>{p.status}</span>}
        </div>
        {(special || selector) && <div className="mt-2 flex flex-wrap gap-1">
          {selector && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stageTone(p.status)}`}>{p.status}</span>}
          {special && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Colis spécial</span>}
        </div>}
        <div className="mt-4"><RouteStrip status={p.status} /></div>
      </div>
      {/* Ligne détachable */}
      <div className="mx-3 border-t border-dashed border-navy/15" />
      <div className="flex h-[54px] items-center justify-between gap-3 px-4">
        <span className="min-w-0 truncate text-[12.5px] text-navy/55">{p.content || "Contenu non précisé"} · <span className="font-mono text-navy/70">{weight > 0 ? lb(weight) : "·"}</span></span>
        {shown != null
          ? <span className={`shrink-0 text-[17px] font-semibold tracking-tight ${invoicedPrice != null ? "text-navy" : "text-[#E4650A]"}`}>{usd(shown)}</span>
          : special && selector ? <span className="shrink-0 text-[11.5px] font-semibold text-amber-700">Prix à confirmer</span> : null}
      </div>
    </button>
    {selector && <button type="button" role="checkbox" aria-checked={selector.selected} aria-label="Choisir ce colis" disabled={selector.disabled} title={selector.title} onClick={selector.onToggle}
      className={`absolute right-3.5 top-3.5 grid h-7 w-7 place-items-center rounded-full border-2 transition disabled:opacity-30 ${selector.selected ? "border-[#E4650A] bg-[#E4650A] text-white" : "border-navy/20 bg-white text-transparent"}`}>
      <Check size={14} />
    </button>}
  </motion.article>;
}

/** Écran « Miami » : manifeste façon tableau des départs, à la place des deux pastilles. */
export function ManifestCard({ list }: { list: Pkg[] }) {
  const counts = [0, 0, 0, 0];
  let weight = 0;
  for (const p of list) { counts[stageOf(p.status)]++; weight += Number(p.weight) || 0; }
  const max = Math.max(1, ...counts.slice(0, 3));
  const rows: Array<[string, number]> = [["Reçus à Miami", counts[0]], ["En transit", counts[1]], ["Arrivés en Haïti", counts[2]]];
  return <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="mb-4 overflow-hidden rounded-[26px] bg-navy text-white">
    <div className="flex items-end justify-between gap-4 px-5 pb-4 pt-5">
      <div>
        <p className="text-[10.5px] font-medium tracking-[.18em] text-[#ffb27a]">MANIFESTE · EN ROUTE VERS VOUS</p>
        <p className="mt-2 text-[44px] font-semibold leading-none tracking-[-0.04em]">{list.length}<span className="ml-2 text-[15px] font-medium tracking-normal text-white/60">colis</span></p>
      </div>
      <div className="text-right">
        <p className="text-[10.5px] tracking-[.18em] text-white/45">POIDS TOTAL</p>
        <p className="mt-1 font-mono text-[22px] font-semibold">{weight.toFixed(2)}<span className="ml-1 text-[13px] text-white/60">lb</span></p>
      </div>
    </div>
    <div className="divide-y divide-white/10 border-t border-white/10">
      {rows.map(([label, n]) => <div key={label} className="flex items-center gap-3 px-5 py-2.5">
        <span className="w-[118px] shrink-0 text-[12.5px] text-white/70">{label}</span>
        <span className="h-[6px] flex-1 overflow-hidden rounded-full bg-white/10"><motion.span className="block h-full rounded-full bg-white" initial={{ width: 0 }} animate={{ width: `${(n / max) * 100}%` }} transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }} style={{ opacity: n ? 1 : 0 }} /></span>
        <span className="w-7 shrink-0 text-right font-mono text-[15px] font-semibold">{String(n).padStart(2, "0")}</span>
      </div>)}
    </div>
  </motion.section>;
}

/** Écran « Disponible » : pass de retrait (façon carte d'embarquement). */
export function PickupPass({ agency, code, count, weight, total, shipping, fixedTax, specialCount, footer }: {
  agency: string; code: string; count: number; weight: number; total: number | null; shipping: number | null; fixedTax: number | null; specialCount: number; footer?: ReactNode;
}) {
  const Field = ({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) => <div className="min-w-0">
    <p className="text-[9.5px] font-medium tracking-[.16em] text-navy/40">{label}</p>
    <p className={`mt-1 truncate ${strong ? "text-[17px] font-semibold text-navy" : "font-mono text-[14px] font-semibold text-navy"}`}>{value}</p>
  </div>;
  return <motion.section initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="mb-4 overflow-hidden rounded-[26px] bg-white ring-1 ring-[#122B5C]/[.07]" style={notchMask(118)}>
    <div className="bg-navy px-5 pb-6 pt-5 text-white">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10.5px] font-medium tracking-[.18em] text-[#ffb27a]">PASS DE RETRAIT</p>
        <p className="font-mono text-[12px] text-white/70">{code}</p>
      </div>
      <p className="mt-3 text-[10.5px] tracking-[.16em] text-white/45">À RETIRER À</p>
      <p className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.02em]">{agency.replace(/\s+[—–]\s+/g, ", ")}</p>
    </div>
    <div className="grid grid-cols-4 gap-3 px-5 py-4">
      <Field label="COLIS" value={String(count).padStart(2, "0")} />
      <Field label="POIDS" value={`${weight.toFixed(2)}`} />
      <Field label="EXPÉDITION" value={shipping != null ? usd(shipping) : "·"} />
      <Field label="TAXE FIXE" value={fixedTax ? usd(fixedTax) : "·"} />
    </div>
    <div className="mx-3 border-t border-dashed border-navy/15" />
    <div className="flex h-[118px] items-center justify-between gap-4 px-5">
      <div>
        <p className="text-[9.5px] font-medium tracking-[.16em] text-navy/40">TOTAL ESTIMÉ</p>
        <p className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.04em] text-[#E4650A]">{total != null ? usd(total) : "·"}</p>
        {specialCount > 0 && <p className="mt-2 text-[11.5px] font-medium text-amber-700">+ {specialCount} colis spécial{specialCount > 1 ? "aux" : ""} : prix sur la facture</p>}
      </div>
      <div className="w-[38%] shrink-0 text-right">
        <Barcode value={code} className="h-12 w-full" />
        <p className="mt-1 font-mono text-[10px] tracking-[.2em] text-navy/50">{code}</p>
      </div>
    </div>
    {footer}
  </motion.section>;
}
