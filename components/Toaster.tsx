"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { dismissToast, subscribeToasts, type ToastItem, type ToastTone } from "@/lib/notify";

const TONES: Record<ToastTone, { icon: typeof Info; ring: string; iconBox: string; bar: string }> = {
  success: { icon: CheckCircle2, ring: "ring-emerald-100", iconBox: "bg-emerald-50 text-emerald-600", bar: "bg-emerald-500" },
  error: { icon: XCircle, ring: "ring-red-100", iconBox: "bg-red-50 text-red-600", bar: "bg-red-500" },
  warning: { icon: AlertTriangle, ring: "ring-amber-100", iconBox: "bg-amber-50 text-amber-600", bar: "bg-amber-500" },
  info: { icon: Info, ring: "ring-blue-100", iconBox: "bg-blue-50 text-[#122B5C]", bar: "bg-[#122B5C]" }
};

/** Pile de notifications de l'application — montée une seule fois dans app/layout.tsx. */
export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => subscribeToasts(setItems), []);
  return <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex flex-col items-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:items-end sm:px-0 sm:pb-0">
    {items.map((item) => <ToastCard key={item.id} item={item} />)}
  </div>;
}

function ToastCard({ item }: { item: ToastItem }) {
  const tone = TONES[item.tone];
  const Icon = tone.icon;
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (paused || leaving) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => setLeaving(true), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => dismissToast(item.id), 180);
    return () => window.clearTimeout(timer);
  }, [leaving, item.id]);

  return <div
    role={item.tone === "error" ? "alert" : "status"}
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
    className={`standa-toast pointer-events-auto relative w-full max-w-[380px] overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_rgba(15,23,42,0.16)] ring-1 ${tone.ring} ${leaving ? "standa-toast-out" : ""}`}
  >
    <div className="flex items-start gap-3 py-3 pl-3 pr-2">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone.iconBox}`}><Icon size={19} strokeWidth={2.4} /></span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[13.5px] font-bold leading-tight text-[#0F172A]">{item.title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-slate-600">{item.text}</p>
      </div>
      <button type="button" onClick={() => setLeaving(true)} aria-label="Fermer la notification" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"><X size={15} /></button>
    </div>
    <span className={`standa-toast-bar absolute bottom-0 left-0 h-[3px] ${tone.bar}`} style={{ animationDuration: `${item.duration}ms`, animationPlayState: paused || leaving ? "paused" : "running" }} />
    <style jsx>{`
      .standa-toast { animation: toastIn .22s cubic-bezier(.2,.8,.2,1); }
      .standa-toast-out { animation: toastOut .18s ease-in forwards; }
      .standa-toast-bar { width: 100%; opacity: .55; animation-name: toastBar; animation-timing-function: linear; animation-fill-mode: forwards; }
      @keyframes toastIn { from { opacity: 0; transform: translateY(-8px) scale(.98); } to { opacity: 1; transform: none; } }
      @keyframes toastOut { to { opacity: 0; transform: translateY(-6px) scale(.98); } }
      @keyframes toastBar { from { width: 100%; } to { width: 0%; } }
      @media (prefers-reduced-motion: reduce) { .standa-toast, .standa-toast-out, .standa-toast-bar { animation: none; } }
    `}</style>
  </div>;
}
