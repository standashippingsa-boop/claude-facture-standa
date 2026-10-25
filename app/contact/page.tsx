import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import ContactForm from "@/components/site/ContactForm";
import ReviewSection from "@/components/site/ReviewSection";
import { FacebookIcon, InstagramIcon, TikTokIcon } from "@/components/site/BrandIcons";
import { SITE } from "@/lib/site";
import { DEPOT } from "@/lib/depot";

export const metadata: Metadata = {
  title: "Contact · STANDA COMMERCIAL",
  description: "Contactez STANDA COMMERCIAL par téléphone, WhatsApp ou courriel. Adresse de notre dépôt aux USA et formulaire de contact.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/contact" }
};

const HOURS = [["Du lundi au vendredi", "9h00 à 17h00"], ["Samedi", "9h00 à 12h00"], ["Dimanche", "Ferme"]] as const;
const SOCIALS = [
  { name: "Instagram", handle: `@${SITE.instagram}`, href: SITE.instagramUrl, icon: InstagramIcon },
  { name: "Facebook", handle: "STANDA COMMERCIAL", href: SITE.facebookUrl, icon: FacebookIcon },
  { name: "TikTok", handle: "@standa_commercials.a", href: SITE.tiktokUrl, icon: TikTokIcon }
];
const MAP_QUERY = encodeURIComponent(`${DEPOT.address1}, ${DEPOT.city}, ${DEPOT.state} ${DEPOT.zip}`);

export default function ContactPage() {
  return <div className="min-h-screen bg-[#f7f9fd] text-ink"><SiteHeader /><main>

    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24 lg:px-10 xl:px-6"><div className="grid gap-8 lg:grid-cols-[minmax(0,1.14fr)_minmax(300px,.86fr)] lg:items-start"><div className="rounded-lg border border-line bg-white p-2 sm:p-3"><ContactForm /></div><aside className="space-y-4"><div className="rounded-lg bg-navy p-6 text-white"><p className="text-[14px] font-semibold text-accent-dark">Nos disponibilités</p><h2 className="mt-3 text-[22px] font-extrabold tracking-tight">Parlons de votre demande.</h2><div className="mt-5 divide-y divide-white/10">{HOURS.map(([day, time]) => <div key={day} className="flex items-center justify-between gap-4 py-3 text-[13px]"><span className="text-white/60">{day}</span><span className={`font-bold ${time === "Ferme" ? "text-red-300" : "text-white"}`}>{time}</span></div>)}</div></div><div className="rounded-lg border border-line bg-white p-6"><p className="text-[14px] font-semibold text-accent-dark">Nos coordonnées</p><div className="mt-4 space-y-2">{SOCIALS.map(({ name, handle, href, icon: Icon }) => <a key={name} href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-md bg-mist px-4 py-3 text-[13px] transition hover:bg-accent-light"><span className="inline-flex items-center gap-2 font-bold text-navy"><Icon size={18} className="text-accent-dark" />{name}</span><span className="max-w-[170px] truncate text-mute">{handle}</span></a>)}</div></div></aside></div></section>

    <section className="border-y border-line bg-white"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[.88fr_1.12fr] lg:items-center lg:px-10 xl:px-6"><div><p className="text-[14px] font-semibold text-accent-dark">Dépôt de Miami</p><h2 className="mt-4 text-[28px] font-extrabold leading-tight tracking-tight text-navy sm:text-[36px]">Votre adresse de réception aux USA.</h2><p className="mt-4 max-w-lg text-[15px] leading-relaxed text-mute">Utilisez cette adresse lors de vos achats, avec votre code client MC à la deuxième ligne.</p><div className="mt-7 rounded-lg bg-mist p-5"><p className="font-bold text-navy">{DEPOT.address1}</p><p className="mt-1 text-[14px] text-mute">{DEPOT.city}, {DEPOT.state} {DEPOT.zip}</p><a href={`https://www.google.com/maps/search/?api=1&query=${MAP_QUERY}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-[13px] font-bold text-accent-dark hover:text-navy"><MapPin size={16} />Ouvrir dans Google Maps</a></div></div><div className="min-h-[320px] overflow-hidden rounded-lg border border-line bg-mist shadow-card"><iframe title="Dépôt STANDA COMMERCIAL à Miami" src={`https://www.google.com/maps?q=${MAP_QUERY}&output=embed`} className="h-full min-h-[320px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div></div></section>

    <ReviewSection />
  </main><SiteFooter /></div>;
}
