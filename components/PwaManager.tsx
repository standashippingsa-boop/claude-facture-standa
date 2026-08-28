"use client";
import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

/**
 * PWA Manager — STANDA COMMERCIAL (v3)
 * ════════════════════════════════════
 * Anrejistre service worker la epi asire kliyan an TOUJOU wè dènye vèsyon an.
 *
 * ⚠️ TWA TWOU KI TE FÈ KLIYAN YO RETE SOU ANSYEN VÈSYON
 * ─────────────────────────────────────────────────────
 *  1) NOU PA T JANM MANDE NAVIGATÈ A TCHEKE.
 *     `reg.update()` pa t janm rele. Yon navigatè tcheke pou kont li sèlman
 *     lè yon moun navige — men nan yon app enstale, moun rete sou menm paj
 *     la pandan jou. Yo pa t janm konnen yon nouvo vèsyon egziste.
 *     -> Kounye a nou tcheke: nan chajman, lè app la retounen an premye
 *        plan, epi chak 5 minit.
 *
 *  2) SCRIPT SW LA MENM TE KA SOTI NAN CACHE.
 *     San `updateViaCache: "none"`, navigatè a ka sèvi ak yon ansyen kopi
 *     /sw.js — donk li pa t menm wè gen yon nouvo vèsyon.
 *
 *  3) YON NOUVO VÈSYON TE KA RETE AP TANN SAN LIMIT.
 *     Li te bezwen yon tap sou yon bouton. Kounye a: si yon nouvo vèsyon
 *     DEJA ap tann lè paj la fèk chaje, nou aplike l TOU SWIT — yon moun
 *     ki fèk rafrechi pa gen travay an kou, donk pa gen risk.
 *
 * POUKISA NOU PA FÒSE MIZAJOU A NENPÒT LÈ
 * ───────────────────────────────────────
 * Si yon nouvo vèsyon rive PANDAN yon moun ap travay (yon fakti ouvè, yon
 * fòm ranpli), yon rechajman otomatik ta pèdi travay li. Nan ka sa a nou
 * montre yon bando epi se li ki chwazi lè.
 *
 * NÒT: ENSTALASYON app la jere pa <InstallGateway />.
 */
export default function PwaManager() {
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const register = async () => {
      try {
        // updateViaCache "none": script SW la pa janm soti nan cache HTTP
        reg = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });

        // Yon vèsyon DEJA ap tann lè paj la fèk chaje -> aplike l tou swit.
        // Moun nan fèk rafrechi: pa gen travay an kou pou pèdi.
        if (reg.waiting) { reg.waiting.postMessage("SKIP_WAITING"); return; }

        // Yon vèsyon ki rive PANDAN li ap travay -> mande l anvan.
        reg.addEventListener("updatefound", () => {
          const nw = reg?.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) setWaitingSW(nw);
          });
        });

        check();
      } catch { /* SW pa disponib — app la travay kanmenm */ }
    };

    /** Mande navigatè a: èske gen yon nouvo vèsyon? */
    const check = () => { reg?.update().catch(() => { /* san rezo */ }); };

    const onVisible = () => { if (document.visibilityState === "visible") check(); };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    timer = setInterval(check, 5 * 60 * 1000);   // chak 5 minit

    // Lè nouvo SW la pran kontwòl -> rechaje yon SÈL fwa
    let refreshing = false;
    const onCtrl = () => { if (!refreshing) { refreshing = true; window.location.reload(); } };
    navigator.serviceWorker.addEventListener("controllerchange", onCtrl);

    return () => {
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (timer) clearInterval(timer);
      navigator.serviceWorker.removeEventListener("controllerchange", onCtrl);
    };
  }, []);

  const doUpdate = () => {
    if (waitingSW) waitingSW.postMessage("SKIP_WAITING");
    setWaitingSW(null);
  };

  return (
    <>
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
