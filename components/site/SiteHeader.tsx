"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { SITE } from "@/lib/site";

/**
 * STANDA COMMERCIAL — MENI SIT PIBLIK LA
 * ═══════════════════════════════════════
 * Konpozan PATAJE. Tout paj piblik yo (Accueil, Contact, Nos agences)
 * sèvi ak menm youn nan. Chanje yon lyen isit = li chanje toupatou.
 *
 * ⚠️ Konpozan sa a se pou SIT PIBLIK la sèlman.
 *    Li pa gen okenn rapò ak Shell.tsx / Sidebar.tsx (zouti admin yo).
 *    Pa mele yo — se de sistèm apa.
 *
 * ⚠️ SITE a (imèl/telefòn/WhatsApp/Instagram) vinn nan lib/site.ts kounye a
 *    (PA defini isit ankò) — paske yon paj SÈVÈ (app/contact/page.tsx) pa
 *    ka li yon valè ki soti nan yon fichye "use client" san danje.
 *    Nou re-ekspòte SITE isit la pou ansyen enpòtasyon yo (ContactForm,
 *    SiteFooter) kontinye mache san chanjman.
 */
export { SITE };

/* Lyen meni an — 5 antre, nan lòd yo parèt */
const NAV = [
  { label: "Accueil", href: "/accueil" },
  { label: "Contact", href: "/contact" },
  { label: "Nos agences", href: "/agences" },
  { label: "Mon compte", href: "/login" }
];

const SIGNUP = { label: "S'inscrire", href: "/inscription" };

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  /* Fèmen barre a chak fwa vizitè a chanje paj */
  useEffect(() => { setOpen(false); }, [pathname]);

  /* Bloke defilman paj la pandan barre a louvri + fèmen ak Escape */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = (href: string) => {
    const base = href.split("?")[0];
    return pathname === base;
  };

  return (
    <>
      {/* ══════════ BARRE ANLÈ A ══════════ */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-navy/95 text-white shadow-soft backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10 xl:px-6">
          <div className="flex h-[4.5rem] items-center justify-between gap-3">

            {/* Logo + non */}
            <Link href="/accueil" className="flex items-center gap-2.5 min-w-0">
              <Logo size={36} />
              <span className="font-black tracking-tight leading-none truncate">
                <span className="block text-[15px]">STANDA</span>
                <span className="block text-[10px] font-semibold text-white/70 tracking-[0.18em]">
                  COMMERCIAL
                </span>
              </span>
            </Link>

            {/* ── Meni òdinatè (kache sou telefòn) ── */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition
                    ${isActive(l.href)
                      ? "text-accent bg-white/10"
                      : "text-white/80 hover:text-white hover:bg-white/10"}`}
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href={SIGNUP.href}
                className="ml-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-accent
                           hover:bg-accent-dark text-white transition shadow-card"
              >
                {SIGNUP.label}
              </Link>
            </nav>

            {/* ── Bouton ☰ (telefòn sèlman) ── */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Ouvrir le menu"
              aria-expanded={open}
              className="md:hidden grid place-items-center h-11 w-11 rounded-lg
                         hover:bg-white/10 active:bg-white/20 transition"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ══════════ FON FONSE DÈYÈ BARRE A ══════════ */}
      <div
        onClick={() => setOpen(false)}
        className={`md:hidden fixed inset-0 z-50 bg-black/60 transition-opacity duration-200
          ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        aria-hidden="true"
      />

      {/* ══════════ BARRE LATERAL (TELEFÒN) ══════════ */}
      <aside
        className={`md:hidden fixed top-0 right-0 z-50 h-full w-[82%] max-w-[320px]
          bg-navy-dark text-white shadow-lift flex flex-col
          transition-transform duration-250 ease-out
          ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
      >
        {/* Tèt barre a */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="font-black text-sm tracking-tight">STANDA</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
            className="grid place-items-center h-10 w-10 rounded-lg hover:bg-white/10 transition"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        {/* Lyen yo */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center px-4 py-3.5 rounded-xl mb-1 text-[15px] font-semibold transition
                ${isActive(l.href)
                  ? "bg-accent/15 text-accent"
                  : "text-white/85 hover:bg-white/10 hover:text-white"}`}
            >
              {l.label}
            </Link>
          ))}

          <Link
            href={SIGNUP.href}
            className="mt-3 flex items-center justify-center px-4 py-3.5 rounded-xl
                       bg-accent hover:bg-accent-dark text-white text-[15px] font-bold transition"
          >
            {SIGNUP.label}
          </Link>
        </nav>

        {/* ── Anba: imèl · telefòn · Instagram ── */}
        <div className="shrink-0 border-t border-white/10 px-4 py-4 space-y-1">
          <a
            href={`mailto:${SITE.email}`}
            className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-white/75
                       hover:text-white hover:bg-white/10 transition text-[13px] break-all"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" className="shrink-0">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m2 7 10 6 10-6" />
            </svg>
            {SITE.email}
          </a>

          <a
            href={`tel:${SITE.whatsapp}`}
            className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-white/75
                       hover:text-white hover:bg-white/10 transition text-[13px]"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" className="shrink-0">
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
            </svg>
            {SITE.phone}
          </a>

          <a
            href={`https://instagram.com/${SITE.instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-white/75
                       hover:text-white hover:bg-white/10 transition text-[13px]"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" className="shrink-0">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            @{SITE.instagram}
          </a>
        </div>
      </aside>
    </>
  );
}
