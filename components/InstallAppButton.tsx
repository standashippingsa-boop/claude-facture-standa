"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** Bouton « Installer l'application » : visible seulement quand le navigateur propose l'installation. */
export default function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPromptEvent); };
    const onInstalled = () => setPromptEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!promptEvent) return null;

  const install = async () => {
    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => null);
    setPromptEvent(null);
  };

  return (
    <button type="button" onClick={install}
      className="fixed bottom-4 left-1/2 z-[55] inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-navy px-4 py-2.5 text-sm font-bold text-white shadow-lift">
      <Download size={16} /> Installer l&apos;application
    </button>
  );
}
