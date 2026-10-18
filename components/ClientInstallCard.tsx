"use client";
import { useEffect, useState } from "react";
import { Download, EllipsisVertical, Share, SquarePlus, X } from "lucide-react";
import { Capacitor } from "@capacitor/core";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const HIDE_KEY = "standa-install-card-hidden";

/**
 * « Installer l'application » — espace client (et page de connexion).
 * La carte est TOUJOUR visible (sauf app déjà installée, APK Android, ou carte
 * fermée par le client) :
 *  • Chrome propose l'installation → le bouton ouvre la fenêtre d'installation ;
 *  • sinon (Chrome n'a pas encore proposé, autre navigateur Android, iPhone) →
 *    le bouton montre les gestes à faire dans le menu du navigateur.
 */
export default function ClientInstallCard({ className = "" }: { className?: string }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try { dismissed = localStorage.getItem(HIDE_KEY) === "1"; } catch { /* stockage bloqué : on affiche */ }
    if (standalone || Capacitor.isNativePlatform() || dismissed) return;

    const ua = navigator.userAgent;
    setIos(/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1));
    setHidden(false);

    const onPrompt = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPromptEvent); };
    const onInstalled = () => { setPromptEvent(null); setHidden(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    try { localStorage.setItem(HIDE_KEY, "1"); } catch { /* noop */ }
    setHidden(true);
  };
  const install = async () => {
    if (!promptEvent) { setShowSteps((value) => !value); return; }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => null);
    setPromptEvent(null);
    if (choice?.outcome === "accepted") setHidden(true);
  };

  return (
    <section className={`rounded-2xl bg-navy p-4 text-left text-white ${className}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10"><Download size={19} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold">Installer l&apos;application</p>
          <p className="mt-0.5 text-[13px] text-white/75">Ouvrez STANDA directement depuis l&apos;écran d&apos;accueil de votre téléphone.</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Ne plus afficher" className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10"><X size={17} /></button>
      </div>
      <button type="button" onClick={install} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-navy">
        <Download size={16} /> {promptEvent ? "Installer" : "Comment l'installer"}
      </button>
      {showSteps && !promptEvent && (ios ? (
        <ol className="mt-3 space-y-2 text-[13px] text-white/90">
          <li className="flex items-center gap-2"><span className="font-bold">1.</span> Ouvrez ce site dans <b>Safari</b>, puis touchez <Share size={16} className="shrink-0" /> <b>Partager</b>.</li>
          <li className="flex items-center gap-2"><span className="font-bold">2.</span> Choisissez <SquarePlus size={16} className="shrink-0" /> <b>Sur l&apos;écran d&apos;accueil</b>, puis <b>Ajouter</b>.</li>
        </ol>
      ) : (
        <ol className="mt-3 space-y-2 text-[13px] text-white/90">
          <li className="flex items-center gap-2"><span className="font-bold">1.</span> Dans Chrome, touchez le menu <EllipsisVertical size={16} className="shrink-0" /> en haut à droite.</li>
          <li className="flex items-center gap-2"><span className="font-bold">2.</span> Choisissez <b>Installer l&apos;application</b> ou <b>Ajouter à l&apos;écran d&apos;accueil</b>.</li>
          <li className="flex items-center gap-2"><span className="font-bold">3.</span> Confirmez avec <b>Installer</b>.</li>
        </ol>
      ))}
    </section>
  );
}
