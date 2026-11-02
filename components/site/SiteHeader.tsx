"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight } from "@getpapillon/papicons";
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
      <header className="sticky top-0 z-40 border-b border-black/[.06] bg-[#eef2f8]/90 text-navy backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/accueil" className="flex min-w-0 items-center gap-2.5">
            <Logo size={28} />
            <span className="leading-none">
              <span className="block text-[13.5px] font-extrabold tracking-tight text-navy">STANDA</span>
              <span className="mt-0.5 block text-[8.5px] font-semibold tracking-[0.2em] text-mute">COMMERCIAL</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Navigation principale">
            {NAV.map((l) => (
              <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined}
                className={`relative py-2 text-[13px] transition ${isActive(l.href) ? "font-semibold text-navy" : "text-navy/70 hover:text-navy"}`}>
                {l.label}
                {isActive(l.href) && <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-5 md:flex">
            <a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noopener noreferrer" className="hidden text-right leading-tight lg:block">
              <span className="block text-[12.5px] font-semibold text-navy">{SITE.phone}</span>
              <span className="block text-[10.5px] text-mute">Lun. au ven. · 9h à 17h</span>
            </a>
            <Link href={SIGNUP.href} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-white transition hover:bg-accent-dark">
              {SIGNUP.label} <ArrowRight size={16} />
            </Link>
          </div>

          <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" aria-expanded={open}
            className="grid h-9 w-9 place-items-center rounded-lg bg-white text-navy shadow-[0_1px_2px_rgba(0,0,0,.06)] md:hidden">
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
        className={`fixed right-0 top-0 z-50 flex h-full w-[84%] max-w-[330px] flex-col bg-white text-navy shadow-2xl transition-transform duration-200 ease-out md:hidden ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
          <div className="flex items-center gap-2.5"><Logo size={30} /><span className="text-[14px] font-extrabold tracking-tight">STANDA</span></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le menu" className="grid h-10 w-10 place-items-center rounded-full bg-[#eef2f8]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((l) => (
            <Link key={l.href} href={l.href} className={`mb-1 flex items-center justify-between rounded-xl px-4 py-2.5 text-[14px] transition ${isActive(l.href) ? "bg-[#eef2f8] font-semibold" : "text-navy/80 hover:bg-[#f2f5fa]"}`}>
              {l.label}<ArrowRight size={16} className="text-navy/40" />
            </Link>
          ))}
          <Link href={SIGNUP.href} className="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg bg-accent text-[14px] font-semibold text-white">
            {SIGNUP.label} <ArrowRight size={16} />
          </Link>
        </nav>
        <div className="shrink-0 space-y-1 border-t border-line px-5 py-4 text-[13px] text-mute">
          <a href={`tel:${SITE.whatsapp}`} className="block py-1.5 font-semibold text-navy">{SITE.phone}</a>
          <a href={`mailto:${SITE.email}`} className="block break-all py-1.5 hover:text-navy">{SITE.email}</a>
          <a href={`https://instagram.com/${SITE.instagram}`} target="_blank" rel="noopener noreferrer" className="block py-1.5 hover:text-navy">Instagram</a>
        </div>
      </aside>
    </>
  );
}
