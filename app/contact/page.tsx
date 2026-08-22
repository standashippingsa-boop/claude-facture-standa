import type { Metadata } from "next";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import ContactForm from "@/components/site/ContactForm";
import { SITE } from "@/lib/site";
import { DEPOT } from "@/lib/depot";

/**
 * STANDA COMMERCIAL — PAJ CONTACT PIBLIK
 * ═══════════════════════════════════════
 * Paj sa a se pou VIZITÈ — menm règ ak /accueil:
 *   - Pa gen koneksyon obligatwa (li nan PUBLIC_PREFIXES nan lib/access.ts).
 *   - Header/Footer VINN nan components/site/ — PATAJE ak /accueil, /agences.
 *     Nou pa retouche yo isit la, nou jis IMPÒTE yo.
 *   - Enfòmasyon kontak (telefòn/WhatsApp/imèl/Instagram) soti nan SITE
 *     (components/site/SiteHeader.tsx) ak DEPOT (lib/depot.ts) — YON SÈL sous verite.
 *   - SEO: layout.tsx jeneral la bloke endeksman; isit nou ranvèse règ la
 *     POU PAJ SA A SÈLMAN, menm jan ak /accueil.
 */
export const metadata: Metadata = {
  title: "Contact — STANDA COMMERCIAL",
  description:
    "Contactez STANDA COMMERCIAL par téléphone, WhatsApp ou email. Adresse de notre dépôt aux États-Unis, horaires d'ouverture et formulaire de contact.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/contact" }
};

/* Orè biznis la — yon sèl kote pou chanje yo */
const HOURS = [
  { d: "Lundi – Vendredi", h: "9h00 – 17h00" },
  { d: "Samedi", h: "9h00 – 12h00" },
  { d: "Dimanche", h: "Fermé" }
];

/* Rezo sosyal STANDA COMMERCIAL */
const SOCIALS = [
  {
    label: "Instagram",
    handle: `@${SITE.instagram}`,
    href: `https://instagram.com/${SITE.instagram}`,
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    )
  },
  {
    label: "Facebook",
    handle: "STANDA COMMERCIAL",
    href: "https://www.facebook.com/share/1DSwxDWqq5/",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.91h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94Z" />
      </svg>
    )
  },
  {
    label: "TikTok",
    handle: "@standa_commercials.a",
    href: "https://www.tiktok.com/@standa_commercials.a",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.6 5.82c-.9-.8-1.4-1.94-1.4-3.14h-3.05v13.44c0 1.5-1.22 2.72-2.72 2.72a2.72 2.72 0 0 1 0-5.44c.28 0 .55.04.8.12V10.4a5.77 5.77 0 0 0-.8-.06 5.77 5.77 0 1 0 5.77 5.77V9.4a8.36 8.36 0 0 0 4.9 1.57V7.93a5.2 5.2 0 0 1-3.5-2.11Z" />
      </svg>
    )
  },
  {
    label: "WhatsApp",
    handle: SITE.phone,
    href: `https://wa.me/${SITE.whatsapp}`,
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.8 14.3c-.25.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-5-4.3-5.1-4.5-.15-.2-1.2-1.6-1.2-3.1 0-1.5.8-2.2 1.1-2.5.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.25.6.8 2 .9 2.2.1.2.15.4 0 .6-.1.2-.2.3-.4.5-.2.2-.4.5-.5.6-.2.2-.4.4-.2.8.2.4.9 1.5 1.9 2.4 1.3 1.2 2.4 1.5 2.8 1.7.4.2.6.15.8-.1.2-.25.9-1 1.1-1.4.2-.4.4-.3.7-.2.3.1 1.9.9 2.2 1 .3.15.5.2.6.35.1.15.1.85-.15 1.55Z" />
      </svg>
    )
  }
];

const MAP_ADDRESS = `${DEPOT.address1}, ${DEPOT.city}, ${DEPOT.state} ${DEPOT.zip}`;
const MAP_QUERY = encodeURIComponent(MAP_ADDRESS);

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* ══════════════ BANYÈ TÈT PAJ LA ══════════════ */}
      <section className="relative bg-navy overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            background: "radial-gradient(70% 55% at 78% 8%, #16A34A 0%, transparent 62%)"
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-10 sm:pt-16 sm:pb-14">
          <span className="inline-flex items-center gap-2 rounded-full
                           bg-brand/15 ring-1 ring-brand/30 px-3 py-1.5
                           text-[12px] font-bold text-brand">
            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
            Nous sommes là pour vous aider
          </span>

          <h1 className="mt-4 text-[30px] leading-[1.15] sm:text-[42px] sm:leading-[1.1]
                         font-black text-white tracking-tight">
            Contactez-nous
          </h1>
          <p className="mt-3 text-[15px] sm:text-[17px] leading-relaxed text-white/75 max-w-lg">
            Une question sur un colis, une facture ou l&apos;ouverture d&apos;un compte ?
            Appelez-nous, écrivez-nous sur WhatsApp, ou utilisez le formulaire ci-dessous.
          </p>

          {/* Aksyon rapid — pi gwo bouton pou telefòn */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <a
              href={`tel:${SITE.whatsapp}`}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl
                         bg-white/10 hover:bg-white/20 ring-1 ring-white/25
                         text-white font-bold text-[15px] transition"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
              </svg>
              {SITE.phone}
            </a>
            <a
              href={`https://wa.me/${SITE.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl
                         bg-[#25D366] hover:bg-[#1fb857] text-white font-bold text-[15px] transition shadow-lift"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.8 14.3c-.25.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-5-4.3-5.1-4.5-.15-.2-1.2-1.6-1.2-3.1 0-1.5.8-2.2 1.1-2.5.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.25.6.8 2 .9 2.2.1.2.15.4 0 .6-.1.2-.2.3-.4.5-.2.2-.4.5-.5.6-.2.2-.4.4-.2.8.2.4.9 1.5 1.9 2.4 1.3 1.2 2.4 1.5 2.8 1.7.4.2.6.15.8-.1.2-.25.9-1 1.1-1.4.2-.4.4-.3.7-.2.3.1 1.9.9 2.2 1 .3.15.5.2.6.35.1.15.1.85-.15 1.55Z" />
              </svg>
              Écrire sur WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════ FÒM + KONTAK ══════════════ */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <div className="grid gap-8 lg:grid-cols-5 lg:items-start">

          {/* Fòm lan */}
          <div className="lg:col-span-3">
            <ContactForm />
          </div>

          {/* Kolòn kontak + rezo sosyal */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-mist rounded-2xl ring-1 ring-line p-5 sm:p-6">
              <h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-navy">
                Nos coordonnées
              </h3>
              <ul className="mt-4 space-y-3.5 text-[14.5px]">
                <li>
                  <span className="block text-[12px] text-mute">Téléphone / WhatsApp</span>
                  <a href={`tel:${SITE.whatsapp}`} className="font-bold text-ink hover:text-brand-dark transition">
                    {SITE.phone}
                  </a>
                </li>
                <li>
                  <span className="block text-[12px] text-mute">Email</span>
                  <a href={`mailto:${SITE.email}`} className="font-bold text-ink hover:text-brand-dark transition break-all">
                    {SITE.email}
                  </a>
                </li>
              </ul>

              <h3 className="mt-6 text-[13px] font-bold uppercase tracking-[0.12em] text-navy">
                Horaires d&apos;ouverture
              </h3>
              <ul className="mt-3 divide-y divide-line">
                {HOURS.map((row) => (
                  <li key={row.d} className="flex items-center justify-between py-2 text-[14px]">
                    <span className="text-mute">{row.d}</span>
                    <span className={`font-bold ${row.h === "Fermé" ? "text-red-500" : "text-ink"}`}>{row.h}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-mist rounded-2xl ring-1 ring-line p-5 sm:p-6">
              <h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-navy">
                Suivez-nous
              </h3>
              <ul className="mt-4 space-y-1">
                {SOCIALS.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-ink
                                 hover:bg-white hover:text-brand-dark transition"
                    >
                      <span className="grid place-items-center w-9 h-9 rounded-full bg-white ring-1 ring-line shrink-0">
                        {s.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-bold leading-tight">{s.label}</span>
                        <span className="block text-[12px] text-mute leading-tight truncate">{s.handle}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ DEPO OZETAZINI + KAT ══════════════ */}
      <section className="bg-mist border-y border-line">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-brand">
              Notre dépôt
            </p>
            <h2 className="mt-2 text-[24px] sm:text-[32px] font-black text-navy tracking-tight leading-tight">
              Adresse aux États-Unis
            </h2>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {/* Kat adrès la */}
            <div className="rounded-2xl overflow-hidden ring-1 ring-line shadow-card bg-white">
              <div className="bg-navy px-5 py-4">
                <h3 className="text-white font-bold text-[15px]">STANDA COMMERCIAL — Dépôt Miami</h3>
              </div>
              <dl className="divide-y divide-line">
                <Row label="Adresse" value={DEPOT.address1} />
                <Row label="Ville" value={DEPOT.city} />
                <Row label="État" value={DEPOT.state} />
                <Row label="Code Postal" value={DEPOT.zip} />
                <Row label="Téléphone" value={DEPOT.phone} />
              </dl>
              <div className="px-5 py-4 border-t border-line">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${MAP_QUERY}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[13.5px] font-bold text-navy hover:text-brand-dark transition"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 1 1 18 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Ouvrir dans Google Maps
                </a>
              </div>
            </div>

            {/* Google Maps entegre */}
            <div className="rounded-2xl overflow-hidden ring-1 ring-line shadow-card bg-white min-h-[280px]">
              <iframe
                title="Localisation du dépôt STANDA COMMERCIAL à Miami"
                src={`https://www.google.com/maps?q=${MAP_QUERY}&output=embed`}
                className="w-full h-full min-h-[280px] border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3.5 flex items-start justify-between gap-4">
      <dt className="text-[13px] text-mute shrink-0">{label}</dt>
      <dd className="text-right break-all text-[14px] font-semibold text-ink">{value}</dd>
    </div>
  );
}
