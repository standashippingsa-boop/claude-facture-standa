"use client";
import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

/**
 * PWA Manager — STANDA COMMERCIAL
 * ════════════════════════════════
 *  - Anrejistre service worker la (/sw.js)
 *  - "Nouvelle version disponible" lè yon SW ap tann -> Mettre à jour / Plus tard
 *
 * NÒT: ENSTALASYON app la jere pa <InstallGateway /> (deteksyon inivèsèl:
 * Android, iPhone/iPad, Windows, Mac, Chromebook, fallback web). Nou pa
 * dwaplike lojik enstalasyon isit la.
 */
export default function PwaManager() {
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
            if (nw.state === "installed" && navigator.serviceWorker.controller) setWaitingSW(nw);
          });
        });
      }).catch(() => {});
    };
    window.addEventListener("load", onLoad);

    // Rechaje paj la lè nouvo SW pran kontwòl
    let refreshing = false;
    const onCtrl = () => { if (!refreshing) { refreshing = true; window.location.reload(); } };
    navigator.serviceWorker.addEventListener("controllerchange", onCtrl);

    return () => {
      window.removeEventListener("load", onLoad);
      navigator.serviceWorker.removeEventListener("controllerchange", onCtrl);
    };
  }, []);

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
              <p className="text-[11px] text-white/70">Mettez à jour pour obtenir les dernières améliorations.</p>
            </div>
            <button onClick={doUpdate}
              className="bg-white text-navy rounded-lg px-3 py-1.5 text-xs font-bold shrink-0">
              Mettre à jour
            </button>
            <button onClick={() => setWaitingSW(null)} className="text-white/60 shrink-0"><X size={16} /></button>
          </div>
        </div>
      )}
    </>
  );
}
