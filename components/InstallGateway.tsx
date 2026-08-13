"use client";
/*
 * STANDA COMMERCIAL — Universal App Installation Gateway
 * ═══════════════════════════════════════════════════════
 * Ekran onboarding pwofesyonèl ki ADAPTE ak chak aparèy:
 *   Android/Chrome/Edge/Chromebook/Desktop -> prompt natif (beforeinstallprompt)
 *   iPhone/iPad Safari                     -> Partager > Sur l'écran d'accueil
 *   iPhone/iPad lòt navigatè               -> "ouvri nan Safari"
 *   Firefox/Samsung/Opera                  -> enstriksyon menu navigatè a
 *   Aparèy ki pa sipòte                    -> fallback web (JANM bloke)
 *
 * RÈG:
 *  • Si app la DEJA enstale (standalone) -> pa janm parèt.
 *  • Si kliyan an di "Continuer sur le web" -> nou sonje, pa spam li.
 *  • Deep link konsève: nou pa redirije, nou jis kouvri ekran an.
 *  • Zewo aksè done: gateway la pa li ni ekri okenn done kliyan.
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Globe, Check, X, Smartphone } from "lucide-react";
import { detectDevice, getInstallSteps, DeviceInfo } from "@/lib/device";

const DISMISS_KEY = "sc_install_dismissed_v1";

/** Wout kliyan yo sèlman — staff ki ap travay nan admin pa dwe deranje. */
const CLIENT_ROUTES = ["/", "/login", "/espace-client", "/inscription", "/reset-password", "/nouveau-mot-de-passe"];

export default function InstallGateway() {
  const pathname = usePathname();
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  // 1) Kapte prompt natif la (Android/Chrome/Edge/Desktop/Chromebook)
  useEffect(() => {
    const onBip = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", onBip);
    const onInstalled = () => { setInstalled(true); setOpen(false); };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // 2) Detekte aparèy la epi deside si nou montre gateway la
  useEffect(() => {
    const t = setTimeout(() => {
      const d = detectDevice(!!installEvt);
      setDevice(d);
      if (d.isStandalone) return;                    // deja enstale -> pa deranje
      let dismissed = false;
      try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch { /* noop */ }
      if (!dismissed) setOpen(true);
    }, 900);                                          // ti reta: kite beforeinstallprompt rive
    return () => clearTimeout(t);
  }, [installEvt]);

  const continuerWeb = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* noop */ }
    setOpen(false);
  };

  const installer = async () => {
    if (!installEvt) return;
    setInstalling(true);
    try {
      installEvt.prompt();
      const res = await installEvt.userChoice;
      if (res?.outcome === "accepted") { setInstalled(true); setOpen(false); }
    } catch { /* noop */ } finally { setInstalling(false); setInstallEvt(null); }
  };

  if (!open || !device || device.isStandalone || installed) return null;
  if (!CLIENT_ROUTES.includes(pathname ?? "")) return null;   // admin/staff: pa deranje

  const canNative = device.installMethod === "native" && !!installEvt;
  const steps = getInstallSteps(device);

  return (
    <div className="fixed inset-0 z-[90] bg-[#081226] overflow-y-auto"
      style={{ background: "radial-gradient(ellipse at top, #0E2145 0%, #081226 55%, #060D1C 100%)" }}>
      <div className="min-h-full flex items-center justify-center p-5">
        <div className="w-full max-w-md">

          {/* Logo + idantite */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-white shadow-2xl flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-192.png" alt="STANDA COMMERCIAL" className="w-full h-full object-contain p-1.5" />
            </div>
            <h1 className="text-white text-xl font-extrabold mt-4 tracking-tight">STANDA COMMERCIAL</h1>
            <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
              Votre espace personnel pour suivre vos colis,
              consulter vos factures et gérer vos informations.
            </p>
          </div>

          {/* Kat prensipal */}
          <div className="rounded-3xl bg-[#0D1F3F]/90 border border-white/10 shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-400 text-[11px]">
              <Smartphone size={13} /> <span>{device.label}</span>
            </div>

            {canNative ? (
              <>
                <p className="text-white text-sm font-semibold">Installez l&apos;application</p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Accès rapide depuis votre écran d&apos;accueil, en plein écran, comme une vraie application.
                </p>
                <button onClick={installer} disabled={installing}
                  className="w-full rounded-xl bg-brand hover:bg-brand-dark text-white font-bold py-3.5 text-sm
                             flex items-center justify-center gap-2 transition disabled:opacity-60">
                  <Download size={17} />
                  {installing ? "Installation…" : "INSTALLER L'APPLICATION"}
                </button>
              </>
            ) : (
              <>
                <p className="text-white text-sm font-semibold">{steps.title}</p>
                <ol className="space-y-2.5">
                  {steps.steps.map((s, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 text-white text-[11px]
                                       font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                      <span className="text-slate-300 text-xs leading-relaxed pt-1">{s}</span>
                    </li>
                  ))}
                </ol>
                {steps.note && (
                  <p className="text-slate-500 text-[11px] leading-relaxed border-t border-white/10 pt-3">
                    {steps.note}
                  </p>
                )}
              </>
            )}

            <button onClick={continuerWeb}
              className="w-full rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300
                         font-semibold py-3 text-sm flex items-center justify-center gap-2 transition">
              <Globe size={16} /> CONTINUER SUR LE WEB
            </button>
          </div>

          {/* Avantaj */}
          <div className="mt-5 space-y-2">
            {["Suivi de vos colis en temps réel",
              "Vos factures toujours accessibles",
              "Notifications dès qu'un colis est disponible"].map((t) => (
              <div key={t} className="flex items-center gap-2.5 text-slate-400 text-xs">
                <Check size={14} className="text-brand shrink-0" /> {t}
              </div>
            ))}
          </div>

          <button onClick={continuerWeb}
            className="w-full text-slate-500 hover:text-slate-300 text-[11px] mt-5 py-2 flex items-center justify-center gap-1.5">
            <X size={12} /> Ne plus afficher
          </button>
        </div>
      </div>
    </div>
  );
}
