import { Apple, Clock3, Play } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Badges visibles avant la publication officielle dans les boutiques.
 * Ils deviennent de vrais liens seulement quand les URL Store vérifiées sont
 * disponibles : aucun visiteur n'est envoyé vers une page vide entre-temps.
 */
export default function StoreBadges({ className = "" }: { className?: string }) {
  return <div className={`flex flex-wrap gap-2 ${className}`} aria-label="Applications mobiles bientôt disponibles">
    <StoreBadge icon={<Play size={19} fill="currentColor" />} eyebrow="Bientôt sur" name="Google Play" />
    <StoreBadge icon={<Apple size={21} fill="currentColor" />} eyebrow="Bientôt sur l’" name="App Store" />
  </div>;
}

function StoreBadge({ icon, eyebrow, name }: { icon: ReactNode; eyebrow: string; name: string }) {
  return <span aria-disabled="true" title={`${name} — bientôt disponible`} className="inline-flex min-h-12 min-w-[148px] cursor-not-allowed items-center gap-2.5 rounded-xl border border-white/20 bg-white/10 px-3 text-left text-white shadow-sm opacity-90">
    <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/12">{icon}</span>
    <span><span className="flex items-center gap-1 text-[9px] font-semibold leading-none text-white/65">{eyebrow}<Clock3 size={10} /></span><b className="mt-1 block text-[15px] leading-none">{name}</b></span>
  </span>;
}
