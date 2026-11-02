"use client";

import Link from "next/link";
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
    <footer className="bg-[#eef2f8] px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="mx-auto max-w-5xl rounded-2xl bg-navy-dark px-5 py-8 text-white sm:px-8">
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Logo size={30} tone="light" />
              <span className="leading-none"><span className="block text-[15px] font-extrabold tracking-tight">STANDA</span><span className="mt-0.5 block text-[9.5px] font-semibold tracking-[0.2em] text-white/55">COMMERCIAL</span></span>
            </div>
            <Link href="/inscription" className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3.5 text-[13px] font-semibold text-navy transition hover:bg-[#eef2f8]">
              Créer un compte
            </Link>
          </div>

          <div>
            <h3 className="text-[12px] text-white/45">Navigation</h3>
            <ul className="mt-3 space-y-2 text-[13px]">
              {NAV.map((item) => <li key={item.href}><Link href={item.href} className="text-white/80 transition hover:text-white">{item.label}</Link></li>)}
              <li><Link href="/inscription" className="text-white/80 transition hover:text-white">S&apos;inscrire</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-[12px] text-white/45">Contact</h3>
            <ul className="mt-3 space-y-2 text-[13px]">
              <li><a href={`tel:${SITE.whatsapp}`} className="text-white/80 transition hover:text-white">{SITE.phone}</a></li>
              <li><a href={`mailto:${SITE.email}`} className="break-all text-white/80 transition hover:text-white">{SITE.email}</a></li>
            </ul>
            <div className="mt-5 flex gap-2">
              {socials.map(({ label, href, icon: Icon }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/85 transition hover:bg-white hover:text-navy">
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[12px] text-white/45">Notre dépôt à Miami</h3>
            <address className="mt-3 not-italic text-[13px] leading-relaxed text-white/80">
              {DEPOT.address1}<br />{DEPOT.city}, {DEPOT.state} {DEPOT.zip}<br />
              <a href={`tel:${DEPOT.phone.replace(/[^\d+]/g, "")}`} className="transition hover:text-white">{DEPOT.phone}</a>
            </address>
          </div>
        </div>

        <div className="mt-7 flex flex-col items-center justify-between gap-2 border-t border-white/10 pt-4 sm:flex-row">
          <p className="text-[11.5px] text-white/45">© {year} {SITE.name}. Tous droits réservés.</p>
          <Link href="/confidentialite" className="text-[11.5px] text-white/45 transition hover:text-white/80">Politique de confidentialité</Link>
        </div>
      </div>
    </footer>
  );
}
