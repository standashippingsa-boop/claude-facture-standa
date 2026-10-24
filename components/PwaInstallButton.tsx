"use client";
import { useEffect, useState } from "react";
import { Download, EllipsisVertical, Share, SquarePlus, X } from "lucide-react";
import { Capacitor } from "@capacitor/core";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// Chrome n'envoie « beforeinstallprompt » qu'une fois, souvent avant que le
// bouton soit affiché : on le garde ici pour toute la session de la page.
let savedPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); savedPrompt = event as InstallPromptEvent; listeners.forEach((fn) => fn()); });
  window.addEventListener("appinstalled", () => { savedPrompt = null; listeners.forEach((fn) => fn()); });
}

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Bouton « Installer l'application » (PWA) — espace client, point de retrait,
 * réception, affiliés. Toujours disponible tant que l'application n'est pas
 * installée : Chrome propose l'installation → fenêtre d'installation ; sinon
 * (iPhone, autre navigateur, Chrome pas encore prêt) → les gestes à faire.
 *   variant « icon » : rond pour un en-tête foncé ;
 *   variant « row »  : ligne de menu / paramètres.
 */
export default function PwaInstallButton({ variant = "icon", appName = "STANDA", className = "" }: { variant?: "icon" | "row"; appName?: string; className?: string }) {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [ios, setIos] = useState(false);
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    const sync = () => { setCanPrompt(Boolean(savedPrompt)); setInstalled(isStandalone()); };
    const ua = navigator.userAgent;
    setIos(/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1));
    sync();
    setReady(true);
    listeners.add(sync);
    return () => { listeners.delete(sync); };
  }, []);

  if (!ready || installed || Capacitor.isNativePlatform()) return null;

  const install = async () => {
    if (!savedPrompt) { setSteps(true); return; }
    const event = savedPrompt;
    await event.prompt();
    await event.userChoice.catch(() => null);
    savedPrompt = null;
    setCanPrompt(false);
    setInstalled(isStandalone());
  };

  const trigger = variant === "icon"
    ? <button type="button" onClick={() => void install()} aria-label="Installer l'application" title="Installer l'application"
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/90 transition hover:bg-white/10 ${className}`}><Download size={19} /></button>
    : <button type="button" onClick={() => void install()}
        className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 ${className}`}>
        <Download size={18} className="shrink-0 text-slate-500" /><span className="flex-1">Installer l&apos;application</span>
        {canPrompt && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Prêt</span>}
      </button>;

  return <>
    {trigger}
    {steps && <div role="dialog" aria-modal="true" aria-label="Installer l'application" className="fixed inset-0 z-[160] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4" onClick={() => setSteps(false)}>
      <div className="w-full max-w-sm rounded-t-3xl bg-white p-5 text-slate-800 sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#0b2a5b] text-white"><Download size={19} /></span>
          <div className="min-w-0 flex-1"><p className="text-[15px] font-bold text-slate-900">Installer {appName}</p><p className="mt-0.5 text-[13px] text-slate-500">L&apos;application s&apos;ouvrira directement depuis l&apos;écran d&apos;accueil.</p></div>
          <button type="button" onClick={() => setSteps(false)} aria-label="Fermer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X size={17} /></button>
        </div>
        {ios ? <ol className="mt-4 space-y-3 text-[14px]">
          <li className="flex items-center gap-2"><b>1.</b> Ouvrez cette page dans <b>Safari</b>, puis touchez <Share size={17} className="shrink-0" /> <b>Partager</b>.</li>
          <li className="flex items-center gap-2"><b>2.</b> Choisissez <SquarePlus size={17} className="shrink-0" /> <b>Sur l&apos;écran d&apos;accueil</b>, puis <b>Ajouter</b>.</li>
        </ol> : <ol className="mt-4 space-y-3 text-[14px]">
          <li className="flex items-center gap-2"><b>1.</b> Dans Chrome, touchez le menu <EllipsisVertical size={17} className="shrink-0" /> en haut à droite.</li>
          <li className="flex items-center gap-2"><b>2.</b> Choisissez <b>Installer l&apos;application</b> ou <b>Ajouter à l&apos;écran d&apos;accueil</b>.</li>
          <li className="text-[12px] text-slate-500">Sur ordinateur : icône d&apos;installation à droite de la barre d&apos;adresse de Chrome.</li>
        </ol>}
        <button type="button" onClick={() => setSteps(false)} className="mt-5 flex h-11 w-full items-center justify-center rounded-xl bg-[#0b2a5b] text-sm font-semibold text-white">Compris</button>
      </div>
    </div>}
  </>;
}
