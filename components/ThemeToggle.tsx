"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "@getpapillon/papicons";

/**
 * Choix du thème : Auto (suit le téléphone) → Sombre → Clair.
 * Le choix est gardé dans localStorage « standa:theme » ; le script de
 * app/layout.tsx l'applique avant l'affichage de chaque page.
 */
type Theme = "auto" | "dark" | "light";
const NEXT: Record<Theme, Theme> = { auto: "dark", dark: "light", light: "auto" };
const LABEL: Record<Theme, string> = { auto: "Auto", dark: "Sombre", light: "Clair" };

function readTheme(): Theme {
  try { const t = localStorage.getItem("standa:theme"); return t === "dark" || t === "light" ? t : "auto"; } catch { return "auto"; }
}

export default function ThemeToggle({ className = "", withLabel = false }: { className?: string; withLabel?: boolean }) {
  const [theme, setTheme] = useState<Theme>("auto");
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setTheme(readTheme());
    setDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  const change = () => {
    const next = NEXT[theme];
    try { localStorage.setItem("standa:theme", next); } catch { /* navigation privée : le choix vaut pour cette page */ }
    setTheme(next);
    const apply = (window as Window & { __standaApplyTheme?: () => void }).__standaApplyTheme;
    if (apply) apply();
    else document.documentElement.classList.toggle("dark", next === "dark");
  };
  const Icon = dark ? Moon : Sun;
  return (
    <button type="button" onClick={change} aria-label={`Thème : ${LABEL[theme]} (toucher pour changer)`} title={`Thème : ${LABEL[theme]}`}
      className={`inline-flex items-center gap-2 ${className}`}>
      <Icon size={18} />
      {withLabel && <span>Thème : {LABEL[theme]}</span>}
    </button>
  );
}
