"use client";

import Link from "next/link";
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import Logo from "@/components/Logo";
import { SITE } from "@/lib/site";
import { DEPOT } from "@/lib/depot";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "./BrandIcons";

/**
 * STANDA COMMERCIAL · PIED DE PAGE DU SITE PUBLIC (partagé).
 * Contacts : SITE (lib/site.ts) ; adresse du dépôt : DEPOT (lib/depot.ts).
 */
const NAV = [
  { label: "Accueil", href: "/accueil" },
  { label: "Comment ça marche ?", href: "/accueil#comment" },
  { label: "Nos agences", href: "/agences" },
  { label: "Contact", href: "/contact" },
  { label: "Mon compte", href: "/login" },
  { label: "S'inscrire", href: "/inscription" },
];
const SERVICES = [
  { label: "Achat en ligne", href: "/accueil#services" },
  { label: "Adresse gratuite à Miami", href: "/accueil#services" },
  { label: "Expédition USA vers Haïti", href: "/accueil#services" },
  { label: "Suivi de colis", href: "/accueil#suivi" },
  { label: "Retrait en agence", href: "/agences" },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();
  const socials = [
    { label: "WhatsApp", href: `https://wa.me/${SITE.whatsapp}`, icon: WhatsAppIcon },
    { label: "Instagram", href: SITE.instagramUrl, icon: InstagramIcon },
    { label: "Facebook", href: SITE.facebookUrl, icon: FacebookIcon },
    { label: "TikTok", href: SITE.tiktokUrl, icon: TikTokIcon },
  ];
  const col = "text-[12px] font-semibold uppercase tracking-[0.14em] text-white/45";
  const link = "text-[13.5px] text-white/75 transition hover:text-std-orange focus:outline-none focus-visible:text-std-orange";

  return (
    <footer className="bg-std-navy text-white">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div>
            <Link href="/accueil" className="inline-flex items-center gap-2.5" aria-label="STANDA COMMERCIAL, accueil">
              <Logo size={32} tone="light" />
              <span className="leading-none"><span className="block text-[15px] font-extrabold tracking-tight">STANDA</span><span className="mt-0.5 block text-[8.5px] font-semibold tracking-[0.22em] text-std-orange">COMMERCIAL S.A.</span></span>
            </Link>
            <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-white/60">Expédition de colis des USA vers Haïti : adresse gratuite à Miami, suivi de vos colis et retrait dans nos agences.</p>
            <div className="mt-5 flex gap-2">
              {socials.map(({ label, href, icon: Icon }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/85 transition hover:bg-std-orange hover:text-std-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-std-orange">
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className={col}>Navigation</h3>
            <ul className="mt-4 space-y-2.5">{NAV.map((i) => <li key={i.label}><Link href={i.href} className={link}>{i.label}</Link></li>)}</ul>
          </div>

          <div>
            <h3 className={col}>Services</h3>
            <ul className="mt-4 space-y-2.5">{SERVICES.map((i) => <li key={i.label}><Link href={i.href} className={link}>{i.label}</Link></li>)}</ul>
          </div>

          <div>
            <h3 className={col}>Contact</h3>
            <ul className="mt-4 space-y-3 text-[13.5px] text-white/75">
              <li><a href={`tel:${SITE.whatsapp}`} className="flex items-center gap-2.5 transition hover:text-std-orange"><Phone size={15} className="shrink-0 text-std-orange" aria-hidden="true" />{SITE.phone}</a></li>
              <li><a href={`mailto:${SITE.email}`} className="flex items-center gap-2.5 break-all transition hover:text-std-orange"><Mail size={15} className="shrink-0 text-std-orange" aria-hidden="true" />{SITE.email}</a></li>
              <li className="flex gap-2.5"><MapPin size={15} className="mt-0.5 shrink-0 text-std-orange" aria-hidden="true" /><span>Dépôt de Miami<br />{DEPOT.address1}, {DEPOT.city}, {DEPOT.state} {DEPOT.zip}</span></li>
            </ul>
            <Link href="/agences" className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-std-orange hover:underline">Trouver une agence <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-[12px] text-white/45 sm:flex-row">
          <p>© {year} {SITE.name}, Standa Shipping S.A. Tous droits réservés.</p>
          <Link href="/confidentialite" className="transition hover:text-white/80">Politique de confidentialité</Link>
        </div>
      </div>
    </footer>
  );
}
