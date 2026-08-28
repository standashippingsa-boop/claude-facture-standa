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
 * MIZAJOU OTOMATIK — SAN KLIYAN AN PEZE ANYEN (v3)
 * ────────────────────────────────────────────────
 * Lè yon nouvo vèsyon rive pandan app la louvri, nou PA tann yon tap ankò.
 * Nou aplike l poukont nou depi moman an SAN DANJE — sa vle di:
 *   • okenn fenèt modal ouvè (fakti, detay koli)
 *   • pèsonn pa ap tape nan yon chan
 *   • paj la vizib
 * Nou eseye chak 10 segond epi chak fwa moun nan retounen sou app la.
 *
 * Si apre 2 minit li poko janm san danje (yon fakti rete ouvè), nou montre
 * yon bando: se li ki chwazi lè. Nou pa janm efase travay yon moun.
 *
 * NÒT: ENSTALASYON app la jere pa <InstallGateway />.
 */
export default function PwaManager() {
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null);

  /**
   * Èske li san danje pou nou aplike mizajou a kounye a?
   * Aplike yon mizajou = rechaje paj la. Si yon moun ap ranpli yon fakti,
   * sa ta efase travay li.
   */
  const safeToApply = () => {
    if (document.visibilityState !== "visible") return false;
    if (document.querySelector(".fixed.inset-0")) return false;   // fenèt ouvè
    const el = document.activeElement as HTMLElement | null;
    const tag = el?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return false;
    return true;
  };

  /** Eseye aplike yon vèsyon k ap tann — an silans, depi li san danje. */
  useEffect(() => {
    if (!waitingSW) return;
    const apply = () => {
      if (!safeToApply()) return false;
      waitingSW.postMessage("SKIP_WAITING");
      return true;
    };
    if (apply()) return;

    const timer = setInterval(() => { if (apply()) clearInterval(timer); }, 10000);
    const onVisible = () => { if (apply()) clearInterval(timer); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    // Apre 2 minit san okazyon, nou sispann eseye epi bando a rete vizib.
    const stop = setTimeout(() => clearInterval(timer), 120000);
    return () => {
      clearInterval(timer); clearTimeout(stop);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [waitingSW]);

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
