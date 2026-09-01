"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import { SITE } from "@/lib/site";
import { DEPOT } from "@/lib/depot";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "./BrandIcons";

/**
 * STANDA COMMERCIAL — FOOTER SIT PIBLIK LA
 * ═════════════════════════════════════════
 * Konpozan PATAJE — tout paj piblik yo sèvi ak menm youn nan.
 *
 * ⚠️ NÒT ENPÒTAN SOU DONE YO:
 *   • Kontak yo (imèl/telefòn/Instagram) soti nan SITE — components/site/SiteHeader.tsx
 *   • Adrès depo a soti nan DEPOT — lib/depot.ts
 *   Nou PA retape yo nan men isit la. Konsa lè yon adrès oswa yon nimewo
 *   chanje, li chanje toupatou an menm tan (WhatsApp, sit la, PDF yo).
 *   Se sa ki anpeche de vèsyon diferan ap sikile an menm tan.
 */

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy-dark text-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10 xl:px-6">

        <div className="grid gap-10 md:grid-cols-4">

          {/* ── Kolòn 1: mak la ── */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <Logo size={40} />
              <span className="font-black tracking-tight leading-none">
                <span className="block text-[15px]">STANDA</span>
                <span className="block text-[10px] font-semibold text-white/60 tracking-[0.18em]">
                  COMMERCIAL
                </span>
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-white/65">
              Expédition et livraison de colis entre les États-Unis et Haïti.
              Rapide, fiable, suivi de bout en bout.
            </p>
          </div>

          {/* ── Kolòn 2: navigasyon ── */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50 mb-4">
              Navigation
            </h3>
            <ul className="space-y-2.5 text-[14px]">
              <li><Link href="/accueil" className="text-white/80 hover:text-accent transition">Accueil</Link></li>
              <li><Link href="/contact" className="text-white/80 hover:text-accent transition">Contact</Link></li>
              <li><Link href="/agences" className="text-white/80 hover:text-accent transition">Nos agences</Link></li>
              <li><Link href="/login" className="text-white/80 hover:text-accent transition">Mon compte</Link></li>
              <li><Link href="/inscription" className="text-accent font-semibold hover:text-white transition">S&apos;inscrire</Link></li>
            </ul>
          </div>

          {/* ── Kolòn 3: kontak ── */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50 mb-4">
              Contact
            </h3>
            <ul className="space-y-2.5 text-[14px]">
              <li>
                <a href={`mailto:${SITE.email}`}
                  className="text-white/80 hover:text-accent transition break-all">
                  {SITE.email}
                </a>
              </li>
              <li>
                <a href={`tel:${SITE.whatsapp}`}
                  className="text-white/80 hover:text-accent transition">
                  {SITE.phone}
                </a>
              </li>
              <li>
                <a href={`https://wa.me/${SITE.whatsapp}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-white/80 hover:text-accent transition">
                  <WhatsAppIcon size={16} /> WhatsApp
                </a>
              </li>
              <li>
                <a href={SITE.instagramUrl}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-white/80 hover:text-accent transition">
                  <InstagramIcon size={16} /> @{SITE.instagram}
                </a>
              </li>
              <li>
                <a href={SITE.facebookUrl}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-white/80 hover:text-accent transition">
                  <FacebookIcon size={16} /> Facebook
                </a>
              </li>
              <li>
                <a href={SITE.tiktokUrl}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-white/80 hover:text-accent transition">
                  <TikTokIcon size={16} /> TikTok
                </a>
              </li>
            </ul>
          </div>

          {/* ── Kolòn 4: depo Miami ── */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50 mb-4">
              Notre dépôt
            </h3>
            <address className="not-italic text-[14px] leading-relaxed text-white/80">
              {DEPOT.address1}<br />
              {DEPOT.city}, {DEPOT.state}<br />
              {DEPOT.zip}<br />
              <a href={`tel:${DEPOT.phone.replace(/[^\d+]/g, "")}`}
                className="hover:text-accent transition">
                {DEPOT.phone}
              </a>
            </address>
            <p className="mt-3 text-[12px] leading-relaxed text-accent/90 font-semibold">
              N&apos;oubliez jamais votre code MC sur chaque colis.
            </p>
          </div>
        </div>

        {/* ── Ba anba a ── */}
        <div className="mt-10 pt-6 border-t border-white/10
                        flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-white/50 text-center sm:text-left">
            © {year} {SITE.name}. Tous droits réservés.
          </p>
          <Link href="/confidentialite"
            className="text-[12px] text-white/50 hover:text-white/85 transition">
            Politique de confidentialité
          </Link>
        </div>
      </div>
    </footer>
  );
}
