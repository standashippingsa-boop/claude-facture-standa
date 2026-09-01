import type { Metadata } from "next";
import type { ElementType } from "react";
import { Clock3, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import ContactForm from "@/components/site/ContactForm";
import PageHero from "@/components/site/PageHero";
import ReviewSection from "@/components/site/ReviewSection";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/site/BrandIcons";
import { SITE } from "@/lib/site";
import { DEPOT } from "@/lib/depot";

export const metadata: Metadata = {
  title: "Contact — STANDA COMMERCIAL",
  description: "Contactez STANDA COMMERCIAL par téléphone, WhatsApp ou e-mail. Adresse de notre dépôt aux États-Unis et formulaire de contact.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/contact" }
};

const HOURS = [["Lundi - Vendredi", "9h00 - 17h00"], ["Samedi", "9h00 - 12h00"], ["Dimanche", "Ferme"]] as const;
const SOCIALS = [
  { name: "Instagram", handle: `@${SITE.instagram}`, href: SITE.instagramUrl, icon: InstagramIcon },
  { name: "Facebook", handle: "STANDA COMMERCIAL", href: SITE.facebookUrl, icon: FacebookIcon },
  { name: "TikTok", handle: "@standa_commercials.a", href: SITE.tiktokUrl, icon: TikTokIcon }
];
const MAP_QUERY = encodeURIComponent(`${DEPOT.address1}, ${DEPOT.city}, ${DEPOT.state} ${DEPOT.zip}`);

export default function ContactPage() {
  return <div className="min-h-screen bg-[#f7f9fd] text-ink"><SiteHeader /><main>
    <PageHero image="/contact-agent-hero.png" eyebrow="Une équipe à votre écoute" title="Une question ? Nous sommes là pour vous." description="Écrivez-nous pour un colis, une facture, une inscription ou toute autre demande. Notre équipe vous accompagne avec attention." actions={<><a href={`tel:${SITE.whatsapp}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.09] px-5 text-[14px] font-bold text-white transition hover:bg-white/20"><Phone size={16} />{SITE.phone}</a><a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 text-[14px] font-bold text-white shadow-[0_14px_34px_-12px_rgba(37,211,102,.8)] transition hover:-translate-y-0.5 hover:bg-[#1eb857]"><WhatsAppIcon size={17} />Écrire sur WhatsApp</a></>}><div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-[12px] font-semibold text-white/70"><span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-accent" />Réponse humaine</span><span className="inline-flex items-center gap-2"><Clock3 size={16} className="text-accent" />Suivi clair</span></div></PageHero>

    <section className="parcel-wash relative -mt-6 px-5 sm:-mt-8 sm:px-8 lg:px-10 xl:px-6"><div className="mx-auto grid max-w-7xl gap-3 rounded-[1.4rem] border border-line bg-white p-3 shadow-[0_20px_48px_-32px_rgba(15,23,42,.45)] sm:grid-cols-3"><QuickCard icon={Phone} title="Appelez-nous" text={SITE.phone} href={`tel:${SITE.whatsapp}`} /><QuickCard icon={WhatsAppIcon} title="WhatsApp" text="Une réponse rapide" href={`https://wa.me/${SITE.whatsapp}`} external /><QuickCard icon={Mail} title="Écrivez-nous" text={SITE.email} href={`mailto:${SITE.email}`} /></div></section>

    <section className="parcel-wash-alt mx-auto max-w-7xl rounded-[2rem] px-5 py-16 sm:px-8 sm:py-24 lg:px-10 xl:px-6"><div className="grid gap-8 lg:grid-cols-[minmax(0,1.14fr)_minmax(300px,.86fr)] lg:items-start"><div className="rounded-[1.7rem] border border-line bg-white p-2 shadow-[0_24px_60px_-38px_rgba(15,23,42,.5)] sm:p-3"><ContactForm /></div><aside className="space-y-4"><div className="rounded-[1.45rem] bg-navy p-6 text-white shadow-[0_20px_48px_-32px_rgba(15,23,42,.7)]"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">Nos disponibilités</p><h2 className="mt-3 text-[22px] font-black tracking-[-.03em]">Parlons de votre demande.</h2><div className="mt-5 divide-y divide-white/10">{HOURS.map(([day, time]) => <div key={day} className="flex items-center justify-between gap-4 py-3 text-[13px]"><span className="text-white/60">{day}</span><span className={`font-bold ${time === "Ferme" ? "text-red-300" : "text-white"}`}>{time}</span></div>)}</div></div><div className="rounded-[1.45rem] border border-line bg-white p-6"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">Retrouvez-nous</p><div className="mt-4 space-y-2">{SOCIALS.map(({ name, handle, href, icon: Icon }) => <a key={name} href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl bg-mist px-4 py-3 text-[13px] transition hover:bg-accent-light"><span className="inline-flex items-center gap-2 font-bold text-navy"><Icon size={18} className="text-accent-dark" />{name}</span><span className="max-w-[170px] truncate text-mute">{handle}</span></a>)}</div></div></aside></div></section>

    <section className="parcel-wash border-y border-line bg-white"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[.88fr_1.12fr] lg:items-center lg:px-10 xl:px-6"><div><p className="text-[11px] font-bold uppercase tracking-[.19em] text-accent">Dépôt de Miami</p><h2 className="mt-4 text-balance text-[34px] font-black leading-[1.02] tracking-[-.045em] text-navy sm:text-[44px]">Votre adresse de réception aux États-Unis.</h2><p className="mt-4 max-w-lg text-[15px] leading-relaxed text-mute">Utilisez cette adresse lors de vos achats, avec votre code client MC à la deuxième ligne.</p><div className="mt-7 rounded-2xl bg-mist p-5"><p className="font-bold text-navy">{DEPOT.address1}</p><p className="mt-1 text-[14px] text-mute">{DEPOT.city}, {DEPOT.state} {DEPOT.zip}</p><a href={`https://www.google.com/maps/search/?api=1&query=${MAP_QUERY}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-[13px] font-bold text-accent-dark hover:text-navy"><MapPin size={16} />Ouvrir dans Google Maps</a></div></div><div className="min-h-[320px] overflow-hidden rounded-[1.55rem] border border-line bg-mist shadow-card"><iframe title="Dépôt STANDA COMMERCIAL à Miami" src={`https://www.google.com/maps?q=${MAP_QUERY}&output=embed`} className="h-full min-h-[320px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div></div></section>

    <ReviewSection />
  </main><SiteFooter /></div>;
}

function QuickCard({ icon: Icon, title, text, href, external }: { icon: ElementType; title: string; text: string; href: string; external?: boolean }) { return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="group flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-mist"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-light text-accent-dark transition group-hover:bg-accent group-hover:text-white"><Icon size={18} /></span><span className="min-w-0"><span className="block text-[12px] font-bold text-navy">{title}</span><span className="block truncate text-[12px] text-mute">{text}</span></span></a>; }
