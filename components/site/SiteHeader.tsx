"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";
import { SITE } from "@/lib/site";

/**
 * STANDA COMMERCIAL — MENI SIT PIBLIK LA
 * ═══════════════════════════════════════
 * Konpozan PATAJE. Tout paj piblik yo (Accueil, Contact, Nos agences)
 * sèvi ak menm youn nan. Chanje yon lyen isit = li chanje toupatou.
 *
 * Style : barre claire et sobre (fond gris très clair, texte encre), lien actif
 * marqué d'un point, bouton principal noir arrondi — même langage que l'accueil.
 *
 * ⚠️ Konpozan sa a se pou SIT PIBLIK la sèlman (pa Shell.tsx / Sidebar.tsx).
 * ⚠️ SITE (imèl/telefòn/WhatsApp/Instagram) vinn nan lib/site.ts ; nou
 *    re-ekspòte l isit la pou ansyen enpòtasyon yo kontinye mache.
 */
export { SITE };

const NAV = [
  { label: "Accueil", href: "/accueil" },
  { label: "Nos agences", href: "/agences" },
  { label: "Contact", href: "/contact" },
  { label: "Mon compte", href: "/login" }
];

const SIGNUP = { label: "S'inscrire", href: "/inscription" };

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const isActive = (href: string) => pathname === href.split("?")[0];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-black/[.06] bg-[#eef0f3]/90 text-ink backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10 xl:px-6">
          <Link href="/accueil" className="flex min-w-0 items-center gap-2.5">
            <Logo size={34} />
            <span className="leading-none">
              <span className="block text-[15px] font-extrabold tracking-tight text-ink">STANDA</span>
              <span className="mt-0.5 block text-[9.5px] font-semibold tracking-[0.2em] text-mute">COMMERCIAL</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Navigation principale">
            {NAV.map((l) => (
              <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined}
                className={`relative py-2 text-[14px] transition ${isActive(l.href) ? "font-semibold text-ink" : "text-ink/70 hover:text-ink"}`}>
                {l.label}
                {isActive(l.href) && <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-ink" />}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-5 md:flex">
            <a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noopener noreferrer" className="hidden text-right leading-tight lg:block">
              <span className="block text-[14px] font-semibold text-ink">{SITE.phone}</span>
              <span className="block text-[11.5px] text-mute">Lun–ven 9h00–17h00</span>
            </a>
            <Link href={SIGNUP.href} className="inline-flex h-11 items-center gap-2 rounded-full bg-ink pl-5 pr-4 text-[14px] font-semibold text-white transition hover:bg-navy">
              {SIGNUP.label} <ArrowRight size={16} />
            </Link>
          </div>

          <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" aria-expanded={open}
            className="grid h-11 w-11 place-items-center rounded-full bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,.06)] md:hidden">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="16" x2="20" y2="16" />
            </svg>
          </button>
        </div>
      </header>

      {/* Menu téléphone */}
      <div onClick={() => setOpen(false)} aria-hidden="true"
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside role="dialog" aria-modal="true" aria-label="Menu"
        className={`fixed right-0 top-0 z-50 flex h-full w-[84%] max-w-[330px] flex-col bg-white text-ink shadow-2xl transition-transform duration-200 ease-out md:hidden ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex h-[4.5rem] shrink-0 items-center justify-between border-b border-line px-5">
          <div className="flex items-center gap-2.5"><Logo size={30} /><span className="text-[14px] font-extrabold tracking-tight">STANDA</span></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le menu" className="grid h-10 w-10 place-items-center rounded-full bg-[#eef0f3]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((l) => (
            <Link key={l.href} href={l.href} className={`mb-1 flex items-center justify-between rounded-2xl px-4 py-3.5 text-[16px] transition ${isActive(l.href) ? "bg-[#eef0f3] font-semibold" : "text-ink/80 hover:bg-[#f5f6f8]"}`}>
              {l.label}<ArrowRight size={16} className="text-ink/40" />
            </Link>
          ))}
          <Link href={SIGNUP.href} className="mt-4 flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-white">
            {SIGNUP.label} <ArrowRight size={16} />
          </Link>
        </nav>
        <div className="shrink-0 space-y-1 border-t border-line px-5 py-4 text-[13px] text-mute">
          <a href={`tel:${SITE.whatsapp}`} className="block py-1.5 font-semibold text-ink">{SITE.phone}</a>
          <a href={`mailto:${SITE.email}`} className="block break-all py-1.5 hover:text-ink">{SITE.email}</a>
          <a href={`https://instagram.com/${SITE.instagram}`} target="_blank" rel="noopener noreferrer" className="block py-1.5 hover:text-ink">Instagram</a>
        </div>
      </aside>
    </>
  );
}
