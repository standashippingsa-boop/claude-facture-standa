"use client";
/*
 * LISTE DE CHOIX MODERNE (remplace la liste native d'Android / iOS).
 * Téléphone : panneau qui monte du bas de l'écran. Ordinateur : fenêtre au centre.
 * Chaque choix est une ligne large, facile à toucher ; le choix actif est
 * marqué en bleu marine avec une coche. Échap ou un toucher à côté ferme.
 * Rendu dans <body> (portal) : il n'est pas déformé par le zoom des pages de connexion.
 */
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type Choice = { value: string; label: string; hint?: string };

export default function ChoicePicker({ id, title, placeholder, value, options, onChange, disabled, invalid, display, className = "" }: {
  id?: string;
  /** Titre du panneau (ex. « Choisissez votre ville »). */
  title: string;
  placeholder: string;
  value: string;
  options: Choice[];
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Texte affiché dans le champ pour le choix actif (par défaut : son libellé). */
  display?: (choice: Choice) => string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);          // pour l'animation d'entrée
  const [mounted, setMounted] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const current = options.find((o) => o.value === value) ?? null;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    // Le choix actif (ou le premier) reçoit le focus.
    setTimeout(() => {
      const el = listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]') ?? listRef.current?.querySelector<HTMLButtonElement>("button");
      el?.focus();
      el?.scrollIntoView({ block: "nearest" });
    }, 60);
    return () => { cancelAnimationFrame(raf); document.body.style.overflow = prevOverflow; window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setShown(false);
    setTimeout(() => { setOpen(false); triggerRef.current?.focus(); }, 180);
  }
  function pick(v: string) { onChange(v); close(); }

  // Flèches haut / bas pour passer d'un choix à l'autre au clavier.
  function onListKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-choice]") ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  }

  return (
    <>
      <button ref={triggerRef} id={id} type="button" disabled={disabled} onClick={() => setOpen(true)}
        aria-haspopup="dialog" aria-expanded={open} aria-invalid={invalid || undefined}
        className={`input flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed ${invalid ? "!border-red-400" : ""} ${className}`}>
        <span className={`min-w-0 truncate ${current ? "text-ink" : "text-slate-400"}`}>{current ? (display ? display(current) : current.label) : placeholder}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400"><path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
          <div onClick={close} className={`absolute inset-0 bg-[#0b1733]/45 backdrop-blur-[2px] transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`} />
          <div role="dialog" aria-modal="true" aria-labelledby={titleId}
            className={`relative flex max-h-[78vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-12px_40px_-12px_rgba(11,23,51,.35)] transition-transform duration-200 ease-out sm:max-w-md sm:rounded-[24px] sm:shadow-2xl ${shown ? "translate-y-0 sm:scale-100" : "translate-y-full sm:translate-y-4 sm:scale-95"}`}>
            <div className="mx-auto mt-2.5 h-1.5 w-11 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
            <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3 sm:pt-5">
              <h2 id={titleId} className="text-[17px] font-bold text-navy">{title}</h2>
              <button type="button" onClick={close} aria-label="Fermer"
                className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div ref={listRef} role="listbox" aria-labelledby={titleId} onKeyDown={onListKey}
              className="overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <button key={o.value} type="button" role="option" aria-selected={active} data-choice onClick={() => pick(o.value)}
                    className={`mb-1.5 flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-navy/40 ${active ? "bg-navy text-white" : "bg-[#f4f6fa] text-ink hover:bg-[#e9edf5]"}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15.5px] font-semibold leading-tight">{o.label}</span>
                      {o.hint && <span className={`mt-0.5 block truncate text-[12.5px] ${active ? "text-white/75" : "text-slate-500"}`}>{o.hint}</span>}
                    </span>
                    <span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${active ? "bg-white text-navy" : "border-2 border-slate-300"}`}>
                      {active && <svg viewBox="0 0 20 20" className="h-3.5 w-3.5"><path d="m5 10.5 3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
