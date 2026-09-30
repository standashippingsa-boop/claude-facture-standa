"use client";

import { useEffect, useState } from "react";
import { dismissToast, subscribeToasts, type ToastItem, type ToastTone } from "@/lib/notify";

/**
 * Message plein écran de toute l'application (monté une fois dans app/layout.tsx).
 * Une page blanche couvre l'écran et dit ce qui s'est passé :
 *   succès  -> grand cercle vert avec ✓ (comme « Remise confirmée »)
 *   échec   -> grand cercle rouge avec ✕
 *   avis    -> grand cercle orange avec !
 * Un succès se ferme seul ; un échec reste jusqu'à « Compris » pour être lu.
 */
const TONES: Record<ToastTone, { circle: string; shadow: string; button: string; bar: string }> = {
  success: { circle: "bg-emerald-500", shadow: "shadow-[0_18px_50px_rgba(16,185,129,0.45)]", button: "bg-emerald-600 hover:bg-emerald-700", bar: "bg-emerald-500" },
  error: { circle: "bg-red-600", shadow: "shadow-[0_18px_50px_rgba(220,38,38,0.40)]", button: "bg-red-600 hover:bg-red-700", bar: "bg-red-600" },
  warning: { circle: "bg-amber-500", shadow: "shadow-[0_18px_50px_rgba(245,158,11,0.40)]", button: "bg-[#0a2b61] hover:bg-[#0c397a]", bar: "bg-amber-500" },
  info: { circle: "bg-amber-500", shadow: "shadow-[0_18px_50px_rgba(245,158,11,0.40)]", button: "bg-[#0a2b61] hover:bg-[#0c397a]", bar: "bg-amber-500" }
};

export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => subscribeToasts(setItems), []);
  const current = items[0];
  // Un message à la fois : le suivant apparaît quand le premier est fermé.
  return current ? <MessagePage key={current.id} item={current} waiting={items.length - 1} /> : null;
}

function ToneIcon({ tone }: { tone: ToastTone }) {
  return <svg viewBox="0 0 24 24" className="h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {tone === "success" && <path className="sd-check" d="M5 12.5l4.5 4.5L19 7.5" />}
    {tone === "error" && <><path className="sd-check" d="M7 7l10 10" /><path className="sd-check sd-check-late" d="M17 7L7 17" /></>}
    {(tone === "warning" || tone === "info") && <><path className="sd-check" d="M12 6.5v7" /><path d="M12 17.5h.01" strokeWidth={3.6} /></>}
  </svg>;
}

/**
 * Même message, mais DANS la page : pour un écran qui ne peut pas s'afficher
 * du tout (reçu introuvable, espace indisponible…) — il n'y a rien derrière.
 */
export function MessageScreen({ tone, title, text, actionLabel, onAction, fullPage = false }: {
  tone: ToastTone; title: string; text: string; actionLabel?: string; onAction?: () => void; fullPage?: boolean;
}) {
  const style = TONES[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={`flex flex-col items-center justify-center bg-white px-6 py-12 text-center ${fullPage ? "min-h-screen" : "min-h-[60vh] rounded-3xl"}`}>
    <div className={`sd-pop grid h-32 w-32 place-items-center rounded-full sm:h-36 sm:w-36 ${style.circle} ${style.shadow}`}><ToneIcon tone={tone} /></div>
    <h2 className="mt-7 text-balance text-2xl font-black tracking-tight text-[#0a2b61] sm:text-3xl">{title}</h2>
    <p className="mx-auto mt-3 max-w-md whitespace-pre-line break-words text-base font-semibold leading-relaxed text-slate-600">{text}</p>
    {actionLabel && onAction && <button type="button" onClick={onAction} className={`mt-8 flex min-h-12 w-full max-w-xs items-center justify-center rounded-2xl px-6 text-base font-black text-white shadow-sm outline-none transition focus-visible:ring-4 focus-visible:ring-slate-300 ${style.button}`}>{actionLabel}</button>}
  </div>;
}

function MessagePage({ item, waiting }: { item: ToastItem; waiting: number }) {
  const tone = TONES[item.tone];
  const [leaving, setLeaving] = useState(false);
  const close = () => setLeaving(true);

  useEffect(() => {
    if (!item.duration) return;
    const timer = window.setTimeout(close, item.duration);
    return () => window.clearTimeout(timer);
  }, [item.duration]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => dismissToast(item.id), 160);
    return () => window.clearTimeout(timer);
  }, [leaving, item.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" || event.key === "Enter") close(); };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, []);

  return <div
    role={item.tone === "error" ? "alertdialog" : "status"} aria-live="assertive" aria-modal="true"
    aria-labelledby={`msg-title-${item.id}`} aria-describedby={`msg-text-${item.id}`}
    onClick={item.tone === "success" ? close : undefined}
    className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white px-6 pb-[env(safe-area-inset-bottom)] text-center transition-opacity duration-150 ${leaving ? "opacity-0" : "opacity-100"}`}
  >
    <div className="w-full max-w-xl">
      <div className={`sd-pop mx-auto grid h-32 w-32 place-items-center rounded-full sm:h-36 sm:w-36 ${tone.circle} ${tone.shadow}`}>
        <ToneIcon tone={item.tone} />
      </div>
      <h2 id={`msg-title-${item.id}`} className="mt-7 text-balance text-2xl font-black tracking-tight text-[#0a2b61] sm:text-3xl">{item.title}</h2>
      <p id={`msg-text-${item.id}`} className="mx-auto mt-3 max-w-md whitespace-pre-line text-base font-semibold leading-relaxed text-slate-600">{item.text}</p>
      <button type="button" autoFocus onClick={(event) => { event.stopPropagation(); close(); }} className={`mx-auto mt-8 flex min-h-12 w-full max-w-xs items-center justify-center rounded-2xl px-6 text-base font-black text-white shadow-sm outline-none transition focus-visible:ring-4 focus-visible:ring-slate-300 ${tone.button}`}>
        {item.tone === "error" ? "Compris" : "OK"}
      </button>
      {waiting > 0 && <p className="mt-3 text-xs font-semibold text-slate-400">{waiting} autre{waiting > 1 ? "s" : ""} message{waiting > 1 ? "s" : ""} à suivre</p>}
    </div>
    {item.duration > 0 && !leaving && <span className="absolute inset-x-0 bottom-0 h-1.5 bg-slate-100"><span className={`msg-bar block h-full ${tone.bar}`} style={{ animationDuration: `${item.duration}ms` }} /></span>}
    <style jsx>{`
      .msg-bar { width: 100%; animation-name: msgBar; animation-timing-function: linear; animation-fill-mode: forwards; }
      :global(.sd-check-late) { animation-delay: .5s !important; }
      @keyframes msgBar { from { width: 100%; } to { width: 0%; } }
      @media (prefers-reduced-motion: reduce) { .msg-bar { animation: none; } }
    `}</style>
  </div>;
}
