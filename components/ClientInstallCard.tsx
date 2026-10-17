"use client";
import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { Capacitor } from "@capacitor/core";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const HIDE_KEY = "standa-install-card-hidden";

/**
 * « Ajouter l'application sur mon téléphone » — espace client.
 *  • Android / Chrome : le navigateur propose l'installation → un bouton suffit.
 *  • iPhone (Safari) : Apple n'autorise pas de bouton ; on montre les 2 gestes
 *    (Partager → « Sur l'écran d'accueil »).
 * Rien n'apparaît si l'app est déjà installée, dans l'APK Android, ou si le
 * client a fermé la carte.
 */
export default function ClientInstallCard() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try { dismissed = localStorage.getItem(HIDE_KEY) === "1"; } catch { /* stockage bloqué : on affiche */ }
    if (standalone || Capacitor.isNativePlatform() || dismissed) return;

    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    setIos(isIos);
    if (isIos) setHidden(false);

    const onPrompt = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPromptEvent); setHidden(false); };
    const onInstalled = () => { setPromptEvent(null); setHidden(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || (!ios && !promptEvent)) return null;

  const dismiss = () => {
    try { localStorage.setItem(HIDE_KEY, "1"); } catch { /* noop */ }
    setHidden(true);
  };
  const install = async () => {
    if (ios) { setShowIosSteps((value) => !value); return; }
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => null);
    setPromptEvent(null);
    if (choice?.outcome === "accepted") setHidden(true);
  };

  return (
    <section className="rounded-2xl bg-navy p-4 text-white">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10"><Download size={19} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold">Installer l&apos;application</p>
          <p className="mt-0.5 text-[13px] text-white/75">Ouvrez STANDA directement depuis l&apos;écran d&apos;accueil de votre téléphone.</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Ne plus afficher" className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10"><X size={17} /></button>
      </div>
      <button type="button" onClick={install} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-navy">
        <Download size={16} /> {ios ? "Comment l'installer" : "Installer"}
      </button>
      {ios && showIosSteps && (
        <ol className="mt-3 space-y-2 text-[13px] text-white/90">
          <li className="flex items-center gap-2"><span className="font-bold">1.</span> Touchez <Share size={16} className="shrink-0" /> <b>Partager</b> en bas de Safari.</li>
          <li className="flex items-center gap-2"><span className="font-bold">2.</span> Choisissez <SquarePlus size={16} className="shrink-0" /> <b>Sur l&apos;écran d&apos;accueil</b>, puis <b>Ajouter</b>.</li>
        </ol>
      )}
    </section>
  );
}
