"use client";
/*
 * STANDA COMMERCIAL — INSTALLATION OBLIGATOIRE (V13)
 * ═══════════════════════════════════════════════════
 * Lè yon kliyan klike sou lyen an, li DWE enstale aplikasyon an pou l kontinye.
 * Pa gen "Continuer sur le web" ankò lè enstalasyon an posib.
 *
 * CHEMEN PA APARÈY:
 *   Android/Chrome/Edge/Desktop  -> prompt natif (beforeinstallprompt)  [BLOKE]
 *   iPhone/iPad Safari           -> Partager > Sur l'écran d'accueil    [BLOKE]
 *   iPhone/iPad lòt navigatè     -> "louvri nan Safari"                 [BLOKE]
 *   Firefox / Samsung / Opera    -> menu navigatè a                     [BLOKE]
 *   WebView WhatsApp/FB/Insta    -> "louvri nan Chrome/Safari"          [BLOKE + kopi lyen]
 *   Aparèy ki PA ka enstale      -> aksè web otorize                    [PA BLOKE]
 *
 * ⚠️ GAD SEKIRITE BIZNIS (enpòtan):
 *   Nou BLOKE sèlman lè gen yon chemen enstalasyon reyèl. Si aparèy la pa
 *   ka enstale PWA ditou (installMethod = "unsupported"), nou kite kliyan an
 *   pase — sinon li ta pèdi aksè nèt a koli ak fakti li, epi li ta rele w.
 *
 * Staff (admin/employé) PA JANM bloke.
 * Deep link konsève: nou pa redirije, nou jis kouvri ekran an.
 * Zewo aksè done: gateway la pa li ni ekri okenn done kliyan.
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Copy, Download, Globe, RefreshCw, Smartphone } from "lucide-react";
import { detectDevice, getInstallSteps, DeviceInfo } from "@/lib/device";

/** Wout kliyan yo SÈLMAN. "/" pa ladan: se dashboard admin an. */
const CLIENT_ROUTES = ["/login", "/espace-client", "/inscription", "/reset-password", "/nouveau-mot-de-passe"];

export default function InstallGateway() {
  const pathname = usePathname();
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [checked, setChecked] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bypass, setBypass] = useState(false);

  // 1) Kapte prompt natif la (Android/Chrome/Edge/Desktop/Chromebook)
  useEffect(() => {
    const onBip = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", onBip);
    const onInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // 2) Detekte aparèy la (ti reta pou kite beforeinstallprompt rive)
  useEffect(() => {
    const t = setTimeout(() => { setDevice(detectDevice(!!installEvt)); setChecked(true); }, 900);
    return () => clearTimeout(t);
  }, [installEvt]);

  const installer = async () => {
    if (!installEvt) return;
    setInstalling(true);
    try {
      installEvt.prompt();
      const res = await installEvt.userChoice;
      if (res?.outcome === "accepted") setInstalled(true);
    } catch { /* noop */ } finally { setInstalling(false); setInstallEvt(null); }
  };

  const copierLien = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true); setTimeout(() => setCopied(false), 2200);
    } catch { /* noop */ }
  };

  // ── Kondisyon afichaj ───────────────────────────────────────────────────
  if (!checked || !device) return null;
  if (device.isStandalone || installed || bypass) return null;          // deja enstale -> pa deranje
  if (!CLIENT_ROUTES.includes(pathname ?? "")) return null;             // staff -> pa deranje

  // Sèl ka kote nou PA bloke: aparèy la pa gen okenn chemen enstalasyon.
  const peutInstaller = device.installMethod !== "unsupported";
  if (!peutInstaller) return null;

  const canNative = device.installMethod === "native" && !!installEvt;
  const isInApp = device.installMethod === "in-app";
  const steps = getInstallSteps(device);

  return (
    <div className="fixed inset-0 z-[100] bg-[#081226] overflow-y-auto"
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
              Pour accéder à votre espace, installez l&apos;application sur votre appareil.
            </p>
          </div>

          {/* Kat prensipal */}
          <div className="rounded-3xl bg-[#0D1F3F]/90 border border-white/10 shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-400 text-[11px]">
              <Smartphone size={13} /> <span>{device.label}</span>
            </div>

            {canNative ? (
              <>
                <p className="text-white text-sm font-semibold">Installation requise</p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Appuyez sur le bouton ci-dessous. L&apos;application s&apos;ajoutera à votre écran
                  d&apos;accueil et s&apos;ouvrira en plein écran.
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

                {/* WebView WhatsApp/FB: kopye lyen an pou kole nan vre navigatè a */}
                {isInApp && (
                  <button onClick={copierLien}
                    className="w-full rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white
                               font-semibold py-3 text-sm flex items-center justify-center gap-2 transition">
                    {copied ? <><Check size={16} className="text-brand" /> Lien copié</> : <><Copy size={16} /> COPIER LE LIEN</>}
                  </button>
                )}

                <button onClick={() => window.location.reload()}
                  className="w-full rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300
                             font-semibold py-3 text-sm flex items-center justify-center gap-2 transition">
                  <RefreshCw size={15} /> J&apos;AI INSTALLÉ — VÉRIFIER
                </button>
              </>
            )}
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

          {/*
            SÒTI SEKOU — pa yon bouton nòmal. Li parèt sèlman apre 12 segond
            epi li mande yon konfimasyon. Se pou kliyan ki VRÈMAN bloke
            (vye telefòn, navigatè ki pa sipòte) pa pèdi aksè a koli yo.
          */}
          <EscapeHatch onUse={() => setBypass(true)} />
        </div>
      </div>
    </div>
  );
}

/** Sòti sekou: apre 12 s, yon ti lyen diskrè ak konfimasyon. */
function EscapeHatch({ onUse }: { onUse: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 12000); return () => clearTimeout(t); }, []);
  if (!visible) return null;
  return (
    <button
      onClick={() => {
        if (confirm("L'installation ne fonctionne pas sur votre appareil ?\n\nVous pouvez continuer sur le web, mais nous vous recommandons d'installer l'application pour une meilleure expérience.")) onUse();
      }}
      className="w-full text-slate-600 hover:text-slate-400 text-[11px] mt-6 py-2 flex items-center justify-center gap-1.5">
      <Globe size={12} /> L&apos;installation ne fonctionne pas sur mon appareil
    </button>
  );
}
