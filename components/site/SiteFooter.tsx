"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";
import { SITE } from "@/lib/site";
import { DEPOT } from "@/lib/depot";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "./BrandIcons";

/**
 * STANDA COMMERCIAL — FOOTER SIT PIBLIK LA
 * Konpozan PATAJE. Kontak yo soti nan SITE (lib/site.ts) ak adrès depo a nan
 * DEPOT (lib/depot.ts) : yo pa retape isit la, konsa yo chanje toupatou ansanm.
 */
const NAV = [
  { label: "Accueil", href: "/accueil" },
  { label: "Nos agences", href: "/agences" },
  { label: "Contact", href: "/contact" },
  { label: "Mon compte", href: "/login" }
];

export default function SiteFooter() {
  const year = new Date().getFullYear();
  const socials = [
    { label: "WhatsApp", href: `https://wa.me/${SITE.whatsapp}`, icon: WhatsAppIcon },
    { label: "Instagram", href: SITE.instagramUrl, icon: InstagramIcon },
    { label: "Facebook", href: SITE.facebookUrl, icon: FacebookIcon },
    { label: "TikTok", href: SITE.tiktokUrl, icon: TikTokIcon }
  ];
  return (
    <footer className="bg-[#eef0f3] px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="mx-auto max-w-[88rem] rounded-[28px] bg-ink px-6 py-12 text-white sm:px-10 lg:px-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <Logo size={38} tone="light" />
              <span className="leading-none"><span className="block text-[15px] font-extrabold tracking-tight">STANDA</span><span className="mt-0.5 block text-[9.5px] font-semibold tracking-[0.2em] text-white/55">COMMERCIAL</span></span>
            </div>
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-white/60">Vos achats aux USA, reçus à Miami et livrés dans votre agence en Haïti, avec un suivi à chaque étape.</p>
            <Link href="/inscription" className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-white pl-5 pr-4 text-[14px] font-semibold text-ink transition hover:bg-[#eef0f3]">
              Créer mon compte <ArrowRight size={16} />
            </Link>
          </div>

          <div>
            <h3 className="text-[13px] text-white/45">Navigation</h3>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              {NAV.map((item) => <li key={item.href}><Link href={item.href} className="text-white/80 transition hover:text-white">{item.label}</Link></li>)}
              <li><Link href="/inscription" className="text-white/80 transition hover:text-white">S&apos;inscrire</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-[13px] text-white/45">Contact</h3>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              <li><a href={`tel:${SITE.whatsapp}`} className="text-white/80 transition hover:text-white">{SITE.phone}</a></li>
              <li><a href={`mailto:${SITE.email}`} className="break-all text-white/80 transition hover:text-white">{SITE.email}</a></li>
            </ul>
            <div className="mt-5 flex gap-2">
              {socials.map(({ label, href, icon: Icon }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/85 transition hover:bg-white hover:text-ink">
                  <Icon size={17} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[13px] text-white/45">Notre dépôt à Miami</h3>
            <address className="mt-4 not-italic text-[14px] leading-relaxed text-white/80">
              {DEPOT.address1}<br />{DEPOT.city}, {DEPOT.state} {DEPOT.zip}<br />
              <a href={`tel:${DEPOT.phone.replace(/[^\d+]/g, "")}`} className="transition hover:text-white">{DEPOT.phone}</a>
            </address>
            <p className="mt-4 rounded-2xl bg-white/[.07] px-4 py-3 text-[13px] leading-relaxed text-white/75">N&apos;oubliez jamais votre <b className="text-white">code MC</b> sur chaque colis.</p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-[12.5px] text-white/45">© {year} {SITE.name}. Tous droits réservés.</p>
          <Link href="/confidentialite" className="text-[12.5px] text-white/45 transition hover:text-white/80">Politique de confidentialité</Link>
        </div>
      </div>
    </footer>
  );
}
