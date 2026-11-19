"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "@/components/icons";

/**
 * Briques de l'écran Paramètres (style réglages Android) : groupes de lignes
 * sur fond blanc, icône ronde, titre, sous-titre, flèche ou interrupteur.
 */

export function Switch({ checked, onChange, label, disabled = false }: {
  checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-40 ${checked ? "bg-navy" : "bg-slate-300"}`}>
      <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h2 className="px-4 pb-1.5 text-[13px] font-semibold text-navy">{title}</h2>}
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">{children}</div>
    </section>
  );
}

function RowInner({ icon, title, sub, right }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return <>
    {icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy/[.07] text-navy">{icon}</span>}
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-semibold text-ink">{title}</span>
      {sub && <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-500">{sub}</span>}
    </span>
    {right}
  </>;
}

const ROW = "flex min-h-[64px] w-full items-center gap-3.5 px-4 py-3 text-left";

/** Ligne qui ouvre une page (lien) ou un panneau (onClick). */
export function SettingsRow({ icon, title, sub, href, onClick }: {
  icon?: ReactNode; title: ReactNode; sub?: ReactNode; href?: string; onClick?: () => void;
}) {
  const right = <ChevronRight size={18} className="shrink-0 text-slate-300" />;
  if (href) return <Link href={href} className={`${ROW} transition hover:bg-mist`}><RowInner icon={icon} title={title} sub={sub} right={right} /></Link>;
  return <button type="button" onClick={onClick} className={`${ROW} transition hover:bg-mist`}><RowInner icon={icon} title={title} sub={sub} right={right} /></button>;
}

/** Ligne avec interrupteur on/off. */
export function SwitchRow({ title, sub, checked, onChange }: {
  title: ReactNode; sub?: ReactNode; checked: boolean; onChange: (next: boolean) => void;
}) {
  return (
    <div className={ROW}>
      <RowInner title={title} sub={sub} right={<Switch checked={checked} onChange={onChange} label={typeof title === "string" ? title : "Activer"} />} />
    </div>
  );
}
