"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Menu, Phone, X } from "lucide-react";
import Logo from "@/components/Logo";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/cn";

/**
 * STANDA COMMERCIAL · MENU DU SITE PUBLIC (partagé par Accueil, Agences, Contact).
 * Barre collante : fond clair, ombre légère dès que la page défile.
 * Téléphone : menu latéral Radix (focus piégé, fermeture au clavier).
 */
export { SITE };

const NAV = [
  { label: "Accueil", href: "/accueil" },
  { label: "Nos services", href: "/accueil#services" },
  { label: "Comment ça marche ?", href: "/accueil#comment" },
  { label: "Nos agences", href: "/agences" },
  { label: "Contact", href: "/contact" },
];
const ACCOUNT = { label: "Mon compte", href: "/login" };
const SIGNUP = { label: "S'inscrire", href: "/inscription" };

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => !href.includes("#") && pathname === href;

  return (
    <header className={cn(
      "sticky top-0 z-40 border-b bg-white/90 backdrop-blur-xl transition-shadow",
      scrolled ? "border-std-navy/10 shadow-[0_6px_24px_-12px_rgba(16,33,61,.25)]" : "border-transparent"
    )}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/accueil" className="flex min-w-0 items-center gap-2.5" aria-label="STANDA COMMERCIAL, accueil">
          <Logo size={30} />
          <span className="leading-none">
            <span className="block text-[14px] font-extrabold tracking-tight text-std-navy">STANDA</span>
            <span className="mt-0.5 block text-[8.5px] font-semibold tracking-[0.22em] text-std-orangeDark">COMMERCIAL</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
          {NAV.map((l) => (
            <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined}
              className={cn(
                "relative rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-std-orange",
                isActive(l.href) ? "text-std-navy" : "text-std-ink/70 hover:bg-std-bg hover:text-std-navy"
              )}>
              {l.label}
              {isActive(l.href) && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-std-orange" />}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href={ACCOUNT.href} className="rounded-lg px-3 py-2 text-[13.5px] font-semibold text-std-navy transition hover:bg-std-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-std-orange">
            {ACCOUNT.label}
          </Link>
          <Link href={SIGNUP.href} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-std-orange px-4 text-[13.5px] font-semibold text-std-navy shadow-sm transition hover:bg-std-orangeDark hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-std-navy focus-visible:ring-offset-2">
            {SIGNUP.label} <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button type="button" aria-label="Ouvrir le menu" className="grid h-10 w-10 place-items-center rounded-xl border border-std-navy/10 text-std-navy lg:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-std-orange">
              <Menu size={20} aria-hidden="true" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-std-navy/50 backdrop-blur-sm" />
            <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[86%] max-w-[340px] flex-col bg-white shadow-2xl focus:outline-none">
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-std-navy/10 px-5">
                <Dialog.Title className="flex items-center gap-2.5 text-[14px] font-extrabold text-std-navy"><Logo size={26} /> STANDA</Dialog.Title>
                <Dialog.Close asChild>
                  <button type="button" aria-label="Fermer le menu" className="grid h-10 w-10 place-items-center rounded-xl bg-std-bg text-std-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-std-orange">
                    <X size={18} aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">Navigation du site STANDA COMMERCIAL</Dialog.Description>
              <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Menu">
                {[...NAV, ACCOUNT].map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                    className={cn("mb-1 flex items-center justify-between rounded-xl px-4 py-3 text-[15px] transition",
                      isActive(l.href) ? "bg-std-bg font-semibold text-std-navy" : "text-std-ink/80 hover:bg-std-bg")}>
                    {l.label}<ArrowRight size={15} className="text-std-mute" aria-hidden="true" />
                  </Link>
                ))}
                <Link href={SIGNUP.href} onClick={() => setOpen(false)} className="mt-4 flex h-11 items-center justify-center gap-2 rounded-full bg-std-orange text-[15px] font-semibold text-std-navy">
                  {SIGNUP.label} <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </nav>
              <div className="shrink-0 border-t border-std-navy/10 px-5 py-4 text-[13px] text-std-mute">
                <a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-1.5 font-semibold text-std-navy"><Phone size={15} aria-hidden="true" /> {SITE.phone}</a>
                <a href={`mailto:${SITE.email}`} className="block break-all py-1.5 hover:text-std-navy">{SITE.email}</a>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  );
}
