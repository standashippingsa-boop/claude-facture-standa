import type { Metadata } from "next";
import type { ElementType } from "react";
import { Clock3, MapPin, Navigation, Phone, Store, Truck } from "lucide-react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import PageHero from "@/components/site/PageHero";
import { WhatsAppIcon } from "@/components/site/BrandIcons";
import { SITE } from "@/lib/site";
import { getAgences, type Agence } from "@/lib/agences";

export const metadata: Metadata = {
  title: "Nos agences — STANDA COMMERCIAL",
  description: "Retrouvez les agences et points de retrait STANDA COMMERCIAL en Haïti : adresses, téléphones, WhatsApp et horaires.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/agences" }
};

export const revalidate = 60;

function mapsHref(a: Agence) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a.nom}, ${a.adresse}, Haiti`)}`; }

export default async function AgencesPage() {
  let agences: Agence[] = [];
  let loadError = false;
  try { agences = await getAgences(); } catch { loadError = true; }

  return <div className="min-h-screen bg-[#f7f9fd] text-ink"><SiteHeader /><main>
    <PageHero image="/agencies-agent-hero.png" eyebrow={agences.length ? `${agences.length} points de retrait en Haïti` : "Nos points de retrait"} title="Votre agence STANDA vous attend." description="Retrouvez facilement le point de retrait le plus proche, ses horaires et les moyens de la contacter." actions={<><a href={`tel:${SITE.whatsapp}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.09] px-5 text-[14px] font-bold text-white transition hover:bg-white/20"><Phone size={16} />{SITE.phone}</a><a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 text-[14px] font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1eb857]"><WhatsAppIcon size={17} />Besoin d&apos;aide ?</a></>}><div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-[12px] font-semibold text-white/70"><span className="inline-flex items-center gap-2"><MapPin size={16} className="text-accent" />Trouvez votre ville</span><span className="inline-flex items-center gap-2"><Clock3 size={16} className="text-accent" />Consultez les horaires</span></div></PageHero>

    <section className="parcel-wash relative -mt-6 px-5 sm:-mt-8 sm:px-8 lg:px-10 xl:px-6"><div className="mx-auto grid max-w-7xl gap-3 rounded-[1.4rem] border border-line bg-white p-3 shadow-[0_20px_48px_-32px_rgba(15,23,42,.45)] sm:grid-cols-3"><MiniInfo icon={Store} title="Points de retrait" text="Un accueil près de chez vous" /><MiniInfo icon={Truck} title="Colis préparés" text="Avant votre arrivée" /><MiniInfo icon={Navigation} title="Itinéraires faciles" text="Google Maps en un clic" /></div></section>

    <section className="parcel-wash-alt mx-auto max-w-7xl rounded-[2rem] px-5 py-16 sm:px-8 sm:py-24 lg:px-10 xl:px-6"><div className="max-w-2xl"><p className="text-[11px] font-bold uppercase tracking-[.19em] text-accent">Choisissez votre ville</p><h2 className="mt-4 text-balance text-[34px] font-black leading-[1.02] tracking-[-.045em] text-navy sm:text-[46px]">Les agences à votre service.</h2><p className="mt-4 text-[16px] leading-relaxed text-mute">Appelez, écrivez sur WhatsApp ou ouvrez directement l&apos;itinéraire vers l&apos;agence de votre choix.</p></div>
      {loadError && <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] text-amber-800">La liste des agences est temporairement indisponible. Contactez-nous directement sur WhatsApp.</p>}
      {!loadError && !agences.length && <p className="mt-8 rounded-2xl border border-line bg-white px-5 py-7 text-center text-[14px] text-mute">Aucune agence n&apos;est disponible pour le moment.</p>}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{agences.map((agence) => <AgenceCard key={agence.id ?? agence.nom} agence={agence} />)}</div>
    </section>

    <section className="parcel-wash border-y border-line bg-white"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[.86fr_1.14fr] lg:items-center lg:px-10 xl:px-6"><div><p className="text-[11px] font-bold uppercase tracking-[.19em] text-accent">Avant de venir</p><h2 className="mt-4 text-balance text-[34px] font-black leading-[1.02] tracking-[-.045em] text-navy sm:text-[44px]">Un retrait plus simple pour vous.</h2><p className="mt-4 max-w-lg text-[15px] leading-relaxed text-mute">Ayez votre code client, le numéro de votre colis ou votre facture à portée de main. L&apos;équipe pourra vous guider rapidement.</p></div><div className="grid gap-3 sm:grid-cols-3"><Tip icon={Phone} title="Appelez avant" text="Pour toute question." /><Tip icon={WhatsAppIcon} title="Écrivez-nous" text="Sur WhatsApp." /><Tip icon={Clock3} title="Vérifiez l&apos;heure" text="Avant de vous déplacer." /></div></div></section>
  </main><SiteFooter /></div>;
}

function AgenceCard({ agence: a }: { agence: Agence }) {
  const phone = `tel:${a.telephone.replace(/[^\d+]/g, "")}`;
  return <article className="group overflow-hidden rounded-[1.45rem] border border-line bg-white shadow-[0_18px_44px_-34px_rgba(15,23,42,.55)] transition duration-300 hover:-translate-y-1 hover:border-accent/35 hover:shadow-lift"><div className="relative overflow-hidden bg-navy px-5 py-5"><div aria-hidden="true" className="absolute -right-8 -top-8 h-24 w-24 rounded-full border-[18px] border-white/10" /><div className="relative flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-accent"><Store size={19} /></span><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/45">Point de retrait</p><h3 className="mt-1 text-[19px] font-black text-white">{a.nom}</h3></div></div></div><div className="space-y-4 p-5"><div className="flex gap-3"><MapPin size={17} className="mt-0.5 shrink-0 text-accent" /><p className="text-[13.5px] leading-relaxed text-mute">{a.adresse}</p></div><div className="flex gap-3"><Clock3 size={17} className="mt-0.5 shrink-0 text-accent" /><div className="text-[13px] leading-relaxed text-mute"><p>{a.horaire_1 || "Horaires à confirmer"}</p>{a.horaire_2 && <p>{a.horaire_2}</p>}</div></div>{a.note && <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800">{a.note}</p>}</div><div className="flex flex-wrap gap-2 border-t border-line px-5 py-4"><a href={phone} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-mist px-3 text-[12px] font-bold text-navy transition hover:bg-accent-light"><Phone size={14} />Appeler</a>{a.whatsapp && <a href={`https://wa.me/${a.whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#25D366]/10 px-3 text-[12px] font-bold text-[#128C4A] transition hover:bg-[#25D366]/20"><WhatsAppIcon size={14} />WhatsApp</a>}<a href={mapsHref(a)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-navy px-3 text-[12px] font-bold text-white transition hover:bg-accent-dark"><Navigation size={14} />Itinéraire</a></div></article>;
}

function MiniInfo({ icon: Icon, title, text }: { icon: typeof Store; title: string; text: string }) { return <div className="flex items-center gap-3 rounded-xl px-3 py-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-light text-accent-dark"><Icon size={18} /></span><span><span className="block text-[12px] font-bold text-navy">{title}</span><span className="block text-[12px] text-mute">{text}</span></span></div>; }
function Tip({ icon: Icon, title, text }: { icon: ElementType; title: string; text: string }) { return <div className="rounded-2xl bg-mist p-4"><Icon size={18} className="text-accent-dark" /><p className="mt-4 text-[13px] font-bold text-navy">{title}</p><p className="mt-1 text-[12px] text-mute">{text}</p></div>; }
