import { Apple } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Les liens viennent de Vercel, jamais d'une valeur saisie par un visiteur.
 * Ajoutez les adresses officielles après publication : les badges deviennent
 * alors de vrais boutons sans modifier le design du site.
 */
const safeStoreUrl = (value: string | undefined) => {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch { return ""; }
};

const GOOGLE_PLAY_URL = safeStoreUrl(process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL);
const APP_STORE_URL = safeStoreUrl(process.env.NEXT_PUBLIC_APP_STORE_URL);

export default function StoreBadges({ className = "" }: { className?: string }) {
  return <div className={`flex flex-wrap gap-2 ${className}`} aria-label="Télécharger les applications mobiles STANDA">
    <StoreBadge href={GOOGLE_PLAY_URL} icon={<GooglePlayMark />} eyebrow="GET IT ON" name="Google Play" />
    <StoreBadge href={APP_STORE_URL} icon={<Apple size={29} fill="currentColor" strokeWidth={1.8} />} eyebrow="Download on the" name="App Store" />
  </div>;
}

function StoreBadge({ href, icon, eyebrow, name }: { href: string; icon: ReactNode; eyebrow: string; name: string }) {
  const content = <><span className="grid h-9 w-9 shrink-0 place-items-center text-white">{icon}</span><span className="min-w-0"><span className="block text-[8px] font-semibold leading-none tracking-[.04em] text-white/90">{eyebrow}</span><b className="mt-1 block whitespace-nowrap text-[17px] font-medium leading-none tracking-[-.04em] text-white">{name}</b></span></>;
  const classes = "inline-flex min-h-12 min-w-[154px] items-center gap-2 rounded-lg border border-white/40 bg-black px-2.5 text-left shadow-[0_5px_12px_rgba(0,0,0,.18)] transition";
  if (!href) return <span aria-disabled="true" title={`${name} — bientôt disponible`} className={`${classes} cursor-not-allowed opacity-70`}>{content}</span>;
  return <a href={href} target="_blank" rel="noopener noreferrer" title={`Télécharger sur ${name}`} className={`${classes} hover:-translate-y-0.5 hover:border-white hover:shadow-[0_8px_18px_rgba(0,0,0,.28)]`}>{content}</a>;
}

function GooglePlayMark() {
  return <svg viewBox="0 0 48 48" width="31" height="31" aria-hidden="true"><path fill="#00d6ff" d="M5 4.8v38.4L27.5 24z" /><path fill="#00ac78" d="M5 4.8 32.5 20 27.5 24z" /><path fill="#ffce00" d="m5 43.2 27.5-15.2L27.5 24z" /><path fill="#ff3f75" d="M32.5 20 42 25.2a2.1 2.1 0 0 1 0 3.6L32.5 34 27.5 28z" /></svg>;
}
