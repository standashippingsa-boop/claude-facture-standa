"use client";
/*
 * STANDA COMMERCIAL — BANDO ENSTALASYON (V19)
 * ═══════════════════════════════════════════
 * CHANJMAN ENPÒTAN: nou PA BLOKE aksè a ankò.
 *
 * Ansyen vèsyon an te yon miray: kliyan an pa t ka konekte ni enskri toutotan
 * li pa t enstale app la. Sa te fè nou pèdi kliyan — moun ki fenk rive sou sit
 * la ta dwe ka konekte oswa kreye kont yo TOU SWIT, san obstak.
 *
 * Kounye a: yon TI BANDO anwo ekran an ki PWOPOZE enstalasyon an.
 *   • Sou Android/Chrome/Edge: yon sèl tap — NOU fè travay la pou kliyan an
 *     (prompt natif la), li pa gen anyen pou chèche nan meni.
 *   • Sou iPhone: enstriksyon kout ki deplòtye (Safari pa gen prompt natif).
 *   • Nan WhatsApp/Facebook (WebView): enstalasyon enposib la — nou di l
 *     louvri lyen an nan Chrome/Safari, ak yon bouton kopye lyen.
 *
 * Li disparèt nèt lè app la enstale. Si kliyan an fèmen l, li rete fèmen
 * 3 jou — apre sa li repwopoze. Pa gen harcèlement, men nou pa lage l tou.
 *
 * Staff (admin/employé) pa janm wè l.
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Copy, Download, Share, X } from "lucide-react";
import { detectDevice, getInstallSteps, DeviceInfo } from "@/lib/device";

/** Wout kliyan yo SÈLMAN. "/" pa ladan: se dashboard admin an. */
const CLIENT_ROUTES = ["/login", "/espace-client", "/inscription", "/reset-password", "/nouveau-mot-de-passe"];

/** Siyal natif Chrome la (beforeinstallprompt). */
interface NativePrompt { prompt: () => void; userChoice: Promise<{ outcome: string }> }

const KEY = "standa_install_dismissed_v19";
const REPOS_JOURS = 3;

export default function InstallGateway() {
  const pathname = usePathname();
  const [installEvt, setInstallEvt] = useState<NativePrompt | null>(null);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [checked, setChecked] = useState(false);
  const [installed, setInstalled] = useState(false);
  /** true = nou fin tann siyal Chrome la; anvan sa nou pa montre anyen. */
  const [settled, setSettled] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  /**
   * PRAN SIYAL ENSTALASYON AN.
   * Ti script nan <head> la (layout.tsx) deja kapte l epi mete l sou
   * window.__standaBIP — paske Chrome voye l AVAN React monte. Isit la nou
   * jis li sa ki deja kenbe a, epi nou koute pou ka li rive pita.
   */
  useEffect(() => {
    const w = window as unknown as { __standaBIP?: NativePrompt | null };
    if (w.__standaBIP) setInstallEvt(w.__standaBIP);

    const onReady = () => setInstallEvt(w.__standaBIP ?? null);
    const onInstalled = () => setInstalled(true);
    // Fallback: si script la pa t kouri (kach, bloke), nou koute dirèk tou.
    const onBip = (e: Event) => { e.preventDefault(); setInstallEvt(e as unknown as NativePrompt); };

    window.addEventListener("standa:installready", onReady);
    window.addEventListener("standa:installed", onInstalled);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("standa:installready", onReady);
      window.removeEventListener("standa:installed", onInstalled);
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /**
   * ÈSKE APP LA DEJA ENSTALE?
   * Chrome PA voye siyal enstalasyon an lè app la deja enstale sou aparèy la
   * — menm si w ap gade sit la nan yon onglè navigatè. Se sa ki t ap fè
   * bando a montre "Comment" olye "Installer": nou t ap mande yon moun
   * enstale yon bagay li deja genyen.
   */
  useEffect(() => {
    const nav = navigator as Navigator & {
      getInstalledRelatedApps?: () => Promise<unknown[]>;
    };
    if (typeof nav.getInstalledRelatedApps === "function") {
      nav.getInstalledRelatedApps()
        .then((apps) => { if (apps && apps.length) setInstalled(true); })
        .catch(() => { /* pa sipòte — nou kontinye */ });
    }
    // Lanse depi ekran akèy la (Android) oswa ak paramèt manifest la
    if (document.referrer.startsWith("android-app://")) setInstalled(true);
    try {
      if (new URLSearchParams(window.location.search).get("source") === "pwa") setInstalled(true);
    } catch { /* noop */ }
  }, []);

  // Detekte aparèy la + li si kliyan an te fèmen bando a
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(KEY) ?? 0);
      setHidden(!!v && Date.now() - v < REPOS_JOURS * 864e5);
    } catch { setHidden(false); }
    setDevice(detectDevice(!!installEvt));
    setChecked(true);
  }, [installEvt]);

  /**
   * TANN SIYAL LA ANVAN NOU DESIDE.
   * Chrome ka voye `beforeinstallprompt` jiska 2-3 segond apre chajman an.
   * Si nou deside twò vit, nou montre enstriksyon manyèl yo pou granmesi
   * epi bouton "Installer" la pa janm parèt. Nou tann 2.5 s — oswa mwens
   * si siyal la rive anvan.
   */
  useEffect(() => {
    if (installEvt) { setSettled(true); return; }
    const t = setTimeout(() => setSettled(true), 2500);
    return () => clearTimeout(t);
  }, [installEvt]);

  const fermer = () => {
    setHidden(true);
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* noop */ }
  };

  /** NOU fè travay la: yon sèl tap, prompt natif la parèt. */
  const installer = async () => {
    if (!installEvt) return;
    setBusy(true);
    try {
      installEvt.prompt();
      const res = await installEvt.userChoice;
      if (res?.outcome === "accepted") setInstalled(true);
    } catch { /* noop */ } finally {
      setBusy(false); setInstallEvt(null);
      (window as unknown as { __standaBIP?: unknown }).__standaBIP = null;
    }
  };

  const copierLien = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true); setTimeout(() => setCopied(false), 2200);
    } catch { /* noop */ }
  };

  // ── Kondisyon afichaj ───────────────────────────────────────────────────
  if (!checked || !device || !settled) return null;
  if (device.isStandalone || installed) return null;                    // deja enstale
  if (!CLIENT_ROUTES.includes(pathname ?? "")) return null;             // staff -> pa deranje
  if (device.installMethod === "unsupported") return null;              // pa ka enstale ditou
  if (hidden) return null;

  const canNative = device.installMethod === "native" && !!installEvt;
  const isInApp = device.installMethod === "in-app";
  const steps = getInstallSteps(device);

  return (
    // Nan FLI dokiman an (pa fikse): li pa kouvri header la, epi li woule
    // ale lè kliyan an desann — zewo obstak sou travay li.
    <div className="w-full bg-navy-dark">
      <div className="mx-auto max-w-2xl p-2">
        <div className="rounded-xl bg-navy text-white border border-white/10 overflow-hidden">

          {/* Liy prensipal la — toujou yon sèl liy */}
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <div className="w-8 h-8 rounded-lg bg-white grid place-items-center shrink-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-192.png" alt="" className="w-full h-full object-contain p-0.5" />
            </div>

            <p className="text-[12px] leading-tight flex-1 min-w-0">
              <b className="block">Installez l&apos;application</b>
              <span className="text-white/60">
                {isInApp
                ? "Ouvrez ce lien dans Chrome"
                : canNative
                  ? "Un seul appui — nous faisons le reste"
                  : device.platform === "ios"
                    ? "3 étapes avec le bouton Partager"
                    : "Accès rapide depuis votre écran d'accueil"}
              </span>
            </p>

            {canNative ? (
              <button onClick={installer} disabled={busy}
                className="shrink-0 rounded-lg bg-brand hover:bg-brand-dark text-white text-[12px] font-bold px-3 py-2 inline-flex items-center gap-1.5 disabled:opacity-60">
                <Download size={14} />{busy ? "..." : "Installer"}
              </button>
            ) : (
              <button onClick={() => setOpen((v) => !v)}
                className="shrink-0 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12px] font-bold px-3 py-2 inline-flex items-center gap-1.5">
                {device.platform === "ios" ? <Share size={14} /> : <Download size={14} />}
                Comment
                <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
            )}

            <button onClick={fermer} aria-label="Fermer"
              className="shrink-0 text-white/40 hover:text-white p-1">
              <X size={16} />
            </button>
          </div>

          {/* Enstriksyon yo — deplòtye sèlman lè pa gen prompt natif */}
          {open && !canNative && (
            <div className="border-t border-white/10 px-3 py-3 space-y-2.5">
              <p className="text-[11px] font-bold text-white/80">{steps.title}</p>
              <ol className="space-y-1.5">
                {steps.steps.map((st, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-white/10 text-[10px] font-bold grid place-items-center mt-px">
                      {i + 1}
                    </span>
                    <span className="text-[11px] text-white/70 leading-relaxed">{st}</span>
                  </li>
                ))}
              </ol>
              {steps.note && <p className="text-[10px] text-white/40 leading-relaxed">{steps.note}</p>}

              {isInApp && (
                <button onClick={copierLien}
                  className="w-full rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12px] font-bold py-2.5 inline-flex items-center justify-center gap-1.5">
                  {copied ? <><Check size={14} className="text-brand" />Lien copié</> : <><Copy size={14} />Copier le lien</>}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
