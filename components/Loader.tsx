"use client";
/*
 * STANDA COMMERCIAL — CHARGEMENT & CONFIRMATION (yon sèl sous pou TOUT sistèm nan)
 * ═══════════════════════════════════════════════════════════════════════════════
 * Règ: PA GEN TÈKS "Ap chaje...", "Ap verifye aksè...", "Chargement…".
 *      Se ILUSTRASYON an k ap vire ki parèt — menm bagay la toupatou:
 *      admin, employé, kliyan, sit wèb.
 *
 *   <Loader />            -> ekran konplè (logo STANDA nan yon sèk k ap vire)
 *   <Loader inline />     -> ti spinner nan mitan yon paj/tablo
 *   <Spinner size={16} /> -> spinner tou piti pou anndan yon bouton
 *   <SuccessCheck />      -> ✅ vèt anime, parèt apre yon anrejistreman reyisi
 *   <SavedToast msg />    -> notifikasyon « Enregistré » (lib/notify + Toaster)
 *
 * Zewo depandans: tout bagay se SVG + CSS. Pa gen GIF pou telechaje,
 * donk li parèt menm lè koneksyon an fèb.
 */
import { useEffect } from "react";
import { notify } from "@/lib/notify";

/* ───────────────────────── SPINNER (sèk k ap vire) ───────────────────────── */
export function Spinner({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-full border-current border-t-transparent animate-spin align-[-2px] ${className}`}
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 9)) }}
    />
  );
}

/* ───────────────────────── LOADER (logo k ap vire) ───────────────────────── */
export default function Loader({
  inline = false, size = 96, className = ""
}: { inline?: boolean; size?: number; className?: string }) {
  const ring = (
    <span className="relative grid place-items-center" style={{ width: size, height: size }}>
      <span className="absolute inset-0 rounded-full border-4 border-line" />
      <span className="absolute inset-0 rounded-full border-4 border-transparent border-t-navy border-r-navy animate-spin" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" aria-hidden="true"
        className="object-contain animate-pulse" style={{ height: Math.round(size * 0.5) }} />
    </span>
  );

  if (inline) {
    return <div className={`w-full grid place-items-center py-10 ${className}`} role="status" aria-label="Chargement">{ring}</div>;
  }
  return (
    <div className={`min-h-screen bg-mist grid place-items-center ${className}`} role="status" aria-label="Chargement">
      {ring}
    </div>
  );
}

/* ─────────────────── ✅ VÈT ANIME (apre yon anrejistreman) ─────────────────── */
export function SuccessCheck({ size = 68, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-grid place-items-center ${className}`} style={{ width: size, height: size }} role="img" aria-label="Enregistré">
      <svg viewBox="0 0 52 52" width={size} height={size}>
        <circle cx="26" cy="26" r="23" fill="none" stroke="#16A34A" strokeWidth="3"
          strokeLinecap="round" className="sc-ring" />
        <path d="M15 27 l8 8 l15 -16" fill="none" stroke="#16A34A" strokeWidth="4"
          strokeLinecap="round" strokeLinejoin="round" className="sc-tick" />
      </svg>
      <style jsx>{`
        .sc-ring { stroke-dasharray: 145; stroke-dashoffset: 145; animation: scRing .45s ease-out forwards; }
        .sc-tick { stroke-dasharray: 40; stroke-dashoffset: 40; animation: scTick .35s .35s ease-out forwards; }
        @keyframes scRing { to { stroke-dashoffset: 0; } }
        @keyframes scTick { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .sc-ring, .sc-tick { animation: none; stroke-dashoffset: 0; }
        }
      `}</style>
    </span>
  );
}

/**
 * Confirmation d'enregistrement : passe désormais par le système central de
 * notifications (components/Toaster.tsx) pour que toute l'application affiche
 * les mêmes cartes propres. L'API du composant reste la même pour les pages.
 */
export function SavedToast({
  message = "Enregistré", onClose
}: { message?: string; onClose?: () => void; duration?: number }) {
  useEffect(() => {
    notify.auto(message);
    onClose?.();
    // Une notification par message affiché.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);
  return null;
}
