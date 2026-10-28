import type { Metadata } from "next";
import { ArrowRight, MapPin } from "lucide-react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import ContactForm from "@/components/site/ContactForm";
import ReviewSection from "@/components/site/ReviewSection";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/site/BrandIcons";
import { SITE } from "@/lib/site";
import { DEPOT } from "@/lib/depot";

export const metadata: Metadata = {
  title: "Contact · STANDA COMMERCIAL",
  description: "Contactez STANDA COMMERCIAL par téléphone, WhatsApp ou courriel. Adresse de notre dépôt aux USA et formulaire de contact.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/contact" }
};

const WRAP = "mx-auto max-w-7xl px-5 sm:px-8 lg:px-10 xl:px-6";
const HOURS = [["Du lundi au vendredi", "9h00 à 17h00"], ["Samedi", "9h00 à 12h00"], ["Dimanche", "Fermé"]] as const;
const SOCIALS = [
  { name: "Instagram", handle: `@${SITE.instagram}`, href: SITE.instagramUrl, icon: InstagramIcon },
  { name: "Facebook", handle: "STANDA COMMERCIAL", href: SITE.facebookUrl, icon: FacebookIcon },
  { name: "TikTok", handle: "@standa_commercials.a", href: SITE.tiktokUrl, icon: TikTokIcon }
];
const MAP_QUERY = encodeURIComponent(`${DEPOT.address1}, ${DEPOT.city}, ${DEPOT.state} ${DEPOT.zip}`);

export default function ContactPage() {
  return <div className="site-font min-h-screen bg-[#eef0f3] text-ink"><SiteHeader /><main>

    <section className={`${WRAP} pb-20 pt-10 sm:pt-14`}>
      <p className="text-[12px] font-medium tracking-[0.14em] text-ink/55">CONTACT</p>
      <h1 className="mt-5 max-w-3xl text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[56px]">Parlons de votre demande, <span className="text-ink/45">nous répondons vite.</span></h1>
      <div className="mt-8 flex flex-wrap gap-3">
        <a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center gap-2 rounded-full bg-ink pl-6 pr-5 text-[15px] font-semibold text-white transition hover:bg-navy"><WhatsAppIcon size={17} />Écrire sur WhatsApp <ArrowRight size={17} /></a>
        <a href={`tel:${SITE.whatsapp}`} className="inline-flex h-12 items-center rounded-full bg-white px-6 text-[15px] font-medium shadow-[0_2px_10px_rgba(0,0,0,.05)] transition hover:bg-ink hover:text-white">{SITE.phone}</a>
      </div>
    </section>

    <div className="relative z-10 -mt-8 px-3 sm:px-4">
      <div className="mx-auto max-w-[88rem] rounded-[28px] bg-white py-12 sm:py-16">
        <section className={`${WRAP} grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)] lg:items-start`}>
          <div className="rounded-3xl border border-line p-2 sm:p-3"><ContactForm /></div>
          <aside className="space-y-4">
            <div className="rounded-3xl bg-ink p-6 text-white">
              <p className="text-[13px] text-white/55">Nos disponibilités</p>
              <div className="mt-3 divide-y divide-white/10">{HOURS.map(([day, time]) => <div key={day} className="flex items-center justify-between gap-4 py-3 text-[14px]"><span className="text-white/65">{day}</span><span className={`font-semibold ${time === "Fermé" ? "text-red-300" : "text-white"}`}>{time}</span></div>)}</div>
            </div>
            <div className="rounded-3xl bg-[#f4f5f7] p-6">
              <p className="text-[13px] text-ink/55">Réseaux sociaux</p>
              <div className="mt-3 space-y-2">{SOCIALS.map(({ name, handle, href, icon: Icon }) => <a key={name} href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-[14px] transition hover:bg-ink hover:text-white"><span className="inline-flex items-center gap-2.5 font-medium"><Icon size={18} />{name}</span><span className="max-w-[170px] truncate text-[13px] opacity-60">{handle}</span></a>)}</div>
            </div>
          </aside>
        </section>

        <div className="mx-auto my-12 h-px max-w-7xl bg-line sm:my-16" />

        <section className={`${WRAP} grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center`}>
          <div>
            <p className="text-[12px] font-medium tracking-[0.14em] text-ink/55">DÉPÔT DE MIAMI</p>
            <h2 className="mt-4 text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[38px]">Votre adresse de réception <span className="text-ink/45">aux USA</span></h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink/65">Utilisez cette adresse lors de vos achats, avec votre code client MC à la deuxième ligne.</p>
            <div className="mt-7 rounded-3xl bg-[#f4f5f7] p-5">
              <p className="font-semibold">{DEPOT.address1}</p>
              <p className="mt-1 text-[14px] text-ink/60">{DEPOT.city}, {DEPOT.state} {DEPOT.zip}</p>
              <a href={`https://www.google.com/maps/search/?api=1&query=${MAP_QUERY}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-[14px] font-medium"><MapPin size={16} />Ouvrir dans Google Maps <ArrowRight size={15} /></a>
            </div>
          </div>
          <div className="min-h-[320px] overflow-hidden rounded-3xl border border-line bg-[#f4f5f7]"><iframe title="Dépôt STANDA COMMERCIAL à Miami" src={`https://www.google.com/maps?q=${MAP_QUERY}&output=embed`} className="h-full min-h-[320px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div>
        </section>

        <div className="mt-12 sm:mt-16"><ReviewSection /></div>
      </div>
    </div>
    <div className="h-3 sm:h-4" />
  </main><SiteFooter /></div>;
}
