"use client";
import { useEffect, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";

/**
 * PWA Manager — STANDA COMMERCIAL
 * ════════════════════════════════
 *  - Anrejistre service worker la (/sw.js)
 *  - "Installer l'application" (beforeinstallprompt) — Android/Chrome/Edge
 *  - "Nouvelle version disponible" lè yon SW ap tann -> Mettre à jour / Plus tard
 *  - iOS: pa gen prompt otomatik, se "Ajouter à l'écran d'accueil" nan Safari
 */
export default function PwaManager() {
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Anrejistre SW
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        // Detekte yon nouvo vèsyon k ap tann
        if (reg.waiting) setWaitingSW(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingSW(nw);
            }
          });
        });
      }).catch(() => {});
    };
    window.addEventListener("load", onLoad);

    // Rechaje paj la lè nouvo SW pran kontwòl
    let refreshing = false;
    const onCtrl = () => { if (!refreshing) { refreshing = true; window.location.reload(); } };
    navigator.serviceWorker.addEventListener("controllerchange", onCtrl);

    // Install prompt (Android/desktop)
    const onBip = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e);
      // Pa deranje si deja enstale
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!standalone) setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    return () => {
      window.removeEventListener("load", onLoad);
      window.removeEventListener("beforeinstallprompt", onBip);
      navigator.serviceWorker.removeEventListener("controllerchange", onCtrl);
    };
  }, []);

  const doInstall = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch { /* noop */ }
    setInstallEvt(null); setShowInstall(false);
  };

  const doUpdate = () => {
    if (waitingSW) waitingSW.postMessage("SKIP_WAITING");
    setWaitingSW(null);
  };

  return (
    <>
      {/* Bandeau mizajou */}
      {waitingSW && (
        <div className="fixed bottom-4 inset-x-4 z-[60] mx-auto max-w-sm">
          <div className="bg-navy text-white rounded-2xl shadow-lift p-4 flex items-center gap-3">
            <RefreshCw size={18} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Nouvelle version disponible</p>
              <p className="text-[11px] text-white/70">Mettez à jour pour les dernières améliorations.</p>
            </div>
            <button onClick={doUpdate} className="bg-white text-navy rounded-lg px-3 py-1.5 text-xs font-bold shrink-0">
              Mettre à jour
            </button>
            <button onClick={() => setWaitingSW(null)} className="text-white/60 shrink-0"><X size={16} /></button>
          </div>
        </div>
      )}

      {/* Bandeau enstalasyon */}
      {showInstall && !waitingSW && (
        <div className="fixed bottom-4 inset-x-4 z-[55] mx-auto max-w-sm">
          <div className="bg-white border border-line rounded-2xl shadow-lift p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-navy flex items-center justify-center shrink-0">
              <Download size={17} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">Installer STANDA COMMERCIAL</p>
              <p className="text-[11px] text-mute">Accès rapide, plein écran, comme une app.</p>
            </div>
            <button onClick={doInstall} className="btn !py-1.5 !px-3 !text-xs shrink-0">Installer</button>
            <button onClick={() => setShowInstall(false)} className="text-slate-400 shrink-0"><X size={16} /></button>
          </div>
        </div>
      )}
    </>
  );
}
