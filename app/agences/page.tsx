import type { Metadata } from "next";
import type { ElementType } from "react";
import Image from "next/image";
import { ArrowRight, Clock3, MapPin, Navigation, Phone } from "lucide-react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import { WhatsAppIcon } from "@/components/site/BrandIcons";
import { getAgences, type Agence } from "@/lib/agences";

export const metadata: Metadata = {
  title: "Nos agences · STANDA COMMERCIAL",
  description: "Retrouvez les agences et points de retrait STANDA COMMERCIAL en Haïti : adresses, téléphones, WhatsApp et horaires.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/agences" }
};

export const revalidate = 60;

const WRAP = "mx-auto max-w-7xl px-5 sm:px-8 lg:px-10 xl:px-6";

function mapsHref(a: Agence) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a.nom}, ${a.adresse}, Haiti`)}`; }

export default async function AgencesPage() {
  let agences: Agence[] = [];
  let loadError = false;
  try { agences = await getAgences(); } catch { loadError = true; }

  return <div className="site-font min-h-screen bg-[#eef0f3] text-ink"><SiteHeader /><main>

    <section className={`${WRAP} grid gap-8 pb-20 pt-10 sm:pt-14 lg:grid-cols-[1fr_1fr] lg:items-center`}>
      <div>
        <p className="text-[12px] font-medium tracking-[0.14em] text-ink/55">POINTS DE RETRAIT EN HAÏTI</p>
        <h1 className="mt-5 text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[56px]">Nos agences,<br /><span className="text-ink/45">près de chez vous.</span></h1>
        <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ink/65">Appelez, écrivez sur WhatsApp ou ouvrez directement l&apos;itinéraire vers l&apos;agence de votre choix.</p>
        <a href="#liste" className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-ink pl-6 pr-5 text-[15px] font-semibold text-white transition hover:bg-navy">Voir les agences <ArrowRight size={17} /></a>
      </div>
      <div className="overflow-hidden rounded-[32px] bg-white shadow-[0_30px_60px_-30px_rgba(15,23,42,.35)]">
        <Image src="/site/agent.webp" alt="Agent STANDA dans une agence" width={1100} height={587} priority unoptimized className="h-[260px] w-full object-cover sm:h-[380px]" />
      </div>
    </section>

    <div className="relative z-10 -mt-8 px-3 sm:px-4">
      <div className="mx-auto max-w-[88rem] rounded-[28px] bg-white py-12 sm:py-16">
        <section id="liste" className={`${WRAP} scroll-mt-24`}>
          <p className="text-[12px] font-medium tracking-[0.14em] text-ink/55">CHOISISSEZ VOTRE VILLE</p>
          <h2 className="mt-4 text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[38px]">Les agences à votre service</h2>
          {loadError && <p className="mt-8 rounded-2xl bg-amber-50 px-5 py-4 text-[14px] text-amber-800">La liste des agences est temporairement indisponible. Contactez STANDA directement sur WhatsApp.</p>}
          {!loadError && !agences.length && <p className="mt-8 rounded-2xl bg-[#f4f5f7] px-5 py-7 text-center text-[14px] text-ink/60">Aucune agence n&apos;est disponible pour le moment.</p>}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{agences.map((agence) => <AgenceCard key={agence.id ?? agence.nom} agence={agence} />)}</div>
        </section>

        <div className="mx-auto my-12 h-px max-w-7xl bg-line sm:my-16" />

        <section className={`${WRAP} grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center`}>
          <div>
            <p className="text-[12px] font-medium tracking-[0.14em] text-ink/55">AVANT DE VENIR</p>
            <h2 className="mt-4 text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[38px]">Un retrait plus simple <span className="text-ink/45">pour vous</span></h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink/65">Ayez votre code client, le numéro de votre colis ou votre facture à portée de main. L&apos;équipe pourra vous guider rapidement.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3"><Tip icon={Phone} title="Appelez avant" text="Pour toute question." /><Tip icon={WhatsAppIcon} title="Écrivez à STANDA" text="Sur WhatsApp." /><Tip icon={Clock3} title="Vérifiez l'heure" text="Avant de vous déplacer." /></div>
        </section>
      </div>
    </div>
    <div className="h-3 sm:h-4" />
  </main><SiteFooter /></div>;
}

function AgenceCard({ agence: a }: { agence: Agence }) {
  const phone = `tel:${a.telephone.replace(/[^\d+]/g, "")}`;
  return <article className="flex flex-col rounded-3xl border border-line bg-white p-5 transition hover:border-ink/25">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-[12px] text-ink/50">Point de retrait</p><h3 className="mt-1 text-[21px] font-semibold tracking-tight">{a.nom}</h3></div>
      <a href={mapsHref(a)} target="_blank" rel="noreferrer" aria-label={`Itinéraire vers ${a.nom}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line transition hover:border-ink hover:bg-ink hover:text-white"><Navigation size={16} /></a>
    </div>
    <div className="mt-5 flex-1 space-y-3 text-[14px] leading-relaxed text-ink/65">
      <p className="flex gap-3"><MapPin size={17} className="mt-0.5 shrink-0 text-ink" />{a.adresse || "Adresse à confirmer"}</p>
      <div className="flex gap-3"><Clock3 size={17} className="mt-0.5 shrink-0 text-ink" /><div><p>{a.horaire_1 || "Horaires à confirmer"}</p>{a.horaire_2 && <p>{a.horaire_2}</p>}</div></div>
      {a.note && <p className="rounded-2xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-800">{a.note}</p>}
    </div>
    <div className="mt-5 flex flex-wrap gap-2">
      <a href={phone} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#eef0f3] px-4 text-[13px] font-medium transition hover:bg-ink hover:text-white"><Phone size={14} />Appeler</a>
      {a.whatsapp && <a href={`https://wa.me/${a.whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#25D366]/12 px-4 text-[13px] font-medium text-[#128C4A] transition hover:bg-[#25D366]/20"><WhatsAppIcon size={14} />WhatsApp</a>}
      <a href={mapsHref(a)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-medium text-white transition hover:bg-navy"><Navigation size={14} />Itinéraire</a>
    </div>
  </article>;
}

function Tip({ icon: Icon, title, text }: { icon: ElementType; title: string; text: string }) {
  return <div className="rounded-3xl bg-[#f4f5f7] p-5"><Icon size={20} className="text-ink" /><p className="mt-5 text-[15px] font-semibold">{title}</p><p className="mt-1 text-[13px] text-ink/60">{text}</p></div>;
}
