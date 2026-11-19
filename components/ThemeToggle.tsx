"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "@getpapillon/papicons";

/**
 * Choix du thème : Auto (suit le téléphone) → Sombre → Clair.
 * Le choix est gardé dans localStorage « standa:theme » ; le script de
 * app/layout.tsx l'applique avant l'affichage de chaque page.
 */
export type Theme = "auto" | "dark" | "light";
const NEXT: Record<Theme, Theme> = { auto: "dark", dark: "light", light: "auto" };
const LABEL: Record<Theme, string> = { auto: "Auto", dark: "Sombre", light: "Clair" };

function readTheme(): Theme {
  try { const t = localStorage.getItem("standa:theme"); return t === "dark" || t === "light" ? t : "auto"; } catch { return "auto"; }
}

/** État du thème + changement, partagé par le bouton et l'écran Paramètres. */
export function useTheme(): { theme: Theme; dark: boolean; setTheme: (next: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>("auto");
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setThemeState(readTheme());
    setDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  const setTheme = (next: Theme) => {
    try { localStorage.setItem("standa:theme", next); } catch { /* navigation privée : le choix vaut pour cette page */ }
    setThemeState(next);
    const apply = (window as Window & { __standaApplyTheme?: () => void }).__standaApplyTheme;
    if (apply) apply();
    else document.documentElement.classList.toggle("dark", next === "dark");
  };
  return { theme, dark, setTheme };
}

export default function ThemeToggle({ className = "", withLabel = false }: { className?: string; withLabel?: boolean }) {
  const { theme, dark, setTheme } = useTheme();
  const Icon = dark ? Moon : Sun;
  return (
    <button type="button" onClick={() => setTheme(NEXT[theme])} aria-label={`Thème : ${LABEL[theme]} (toucher pour changer)`} title={`Thème : ${LABEL[theme]}`}
      className={`inline-flex items-center gap-2 ${className}`}>
      <Icon size={18} />
      {withLabel && <span>Thème : {LABEL[theme]}</span>}
    </button>
  );
}
