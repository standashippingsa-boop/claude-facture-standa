import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Building2, Clock, Eye, Headphones, MapPin, MousePointerClick,
  PackageSearch, Phone, Plane, ShoppingBag, Smartphone, Store, UserPlus, Warehouse,
} from "lucide-react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import StoreBadges from "@/components/site/StoreBadges";
import TrackBox from "@/components/site/TrackBox";
import Reveal from "@/components/site/home/Reveal";
import HomeFaq from "@/components/site/home/HomeFaq";
import { DEPOT } from "@/lib/depot";
import { SITE } from "@/lib/site";
import { SITE_URL } from "@/lib/branding";
import { getSiteImages } from "@/lib/site-images";
import { getAgences, type Agence } from "@/lib/agences";

// Images et agences modifiées par l'administration : visibles en moins d'une minute.
export const revalidate = 60;

const TITLE = "STANDA COMMERCIAL S.A. | Expédition de colis USA vers Haïti";
const DESCRIPTION = "Expédiez vos colis des USA vers Haïti avec STANDA COMMERCIAL. Profitez d'une adresse gratuite à Miami, du suivi de vos colis et de nos agences en Haïti.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  alternates: { canonical: "/accueil" },
  keywords: ["standa commercial", "shipping Haïti", "colis USA Haïti", "adresse Miami Haïti", "envoi colis Ayiti"],
  openGraph: {
    type: "website", url: "/accueil", siteName: "STANDA COMMERCIAL", locale: "fr_HT",
    title: TITLE, description: DESCRIPTION,
    images: [{ url: "/hero-shopping.jpg", width: 1600, height: 1067, alt: "Colis STANDA COMMERCIAL" }],
  },
};

const SERVICES = [
  { icon: ShoppingBag, title: "Achat en ligne", text: "Commandez sur vos boutiques préférées aux USA." },
  { icon: Warehouse, title: "Adresse de réception gratuite", text: "Recevez vos commandes à notre adresse de Miami." },
  { icon: Plane, title: "Expédition USA vers Haïti", text: "Un service d'expédition simple et fiable." },
  { icon: PackageSearch, title: "Suivi de colis", text: "Gardez le contrôle de vos expéditions à chaque étape." },
  { icon: Store, title: "Livraison et retrait", text: "Récupérez vos colis dans l'agence STANDA de votre choix." },
];

const STEPS = [
  { icon: UserPlus, title: "Créez votre compte", text: "Obtenez votre adresse de réception à Miami et votre code client." },
  { icon: MousePointerClick, title: "Effectuez vos achats", text: "Utilisez notre adresse de Miami et inscrivez votre code client dans Address Line 2." },
  { icon: Smartphone, title: "Suivez votre colis", text: "Recevez les notifications et consultez l'évolution de votre expédition." },
  { icon: Building2, title: "Récupérez votre colis", text: "Retirez votre commande dans l'agence STANDA choisie." },
];

const ADVANTAGES = [
  { icon: Warehouse, text: "Adresse de réception gratuite à Miami" },
  { icon: PackageSearch, text: "Suivi de vos colis" },
  { icon: Eye, text: "Transparence des informations" },
  { icon: Headphones, text: "Service client disponible" },
  { icon: MapPin, text: "Réseau d'agences en Haïti" },
  { icon: BadgeCheck, text: "Achats en ligne simplifiés" },
];

const INTERDITS = [
  "Armes, munitions et pièces d'armes", "Explosifs et feux d'artifice", "Produits inflammables et aérosols",
  "Produits chimiques corrosifs ou toxiques", "Stupéfiants et substances illégales", "Argent liquide, métaux précieux et contrefaçons",
  "Animaux vivants, plantes et denrées périssables", "Médicaments sans ordonnance valide",
];

const FAQ = [
  { q: "Comment créer un compte ?", a: "Remplissez le formulaire d'inscription gratuit. Après vérification, vous recevez sur WhatsApp votre code client MC et votre mot de passe." },
  { q: "Comment obtenir mon adresse de Miami ?", a: "Elle vous est envoyée à l'activation de votre compte et reste visible dans votre espace client, rubrique Adresse." },
  { q: "Où inscrire mon code client ?", a: "Dans le champ Address Line 2 (Adresse 2) de chaque commande. Sans ce code, nous ne pouvons pas identifier votre colis." },
  { q: "Comment suivre mon colis ?", a: "Encodez votre numéro de suivi dans la section Suivi de cette page, ou ouvrez votre espace client. Vous êtes averti à chaque étape." },
  { q: "Où récupérer mes colis ?", a: "Dans l'agence liée à votre ville. Quand le statut passe à « Disponible », préparez votre retrait depuis votre espace client. Nous ne récupérons pas les colis à domicile." },
  {
    q: "Quels articles sont interdits à l'expédition ?",
    a: <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">{INTERDITS.map((i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-std-orange" />{i}</li>)}</ul>,
  },
];

const JSONLD = {
  "@context": "https://schema.org", "@type": "MovingCompany", name: "STANDA COMMERCIAL", legalName: "Standa Shipping SA",
  url: `${SITE_URL}/accueil`, logo: `${SITE_URL}/logo.png`, image: `${SITE_URL}/hero-shopping.jpg`,
  description: DESCRIPTION, telephone: SITE.phone, email: SITE.email,
  areaServed: [{ "@type": "Country", name: "Haïti" }],
  address: { "@type": "PostalAddress", streetAddress: DEPOT.address1, addressLocality: DEPOT.city, addressRegion: DEPOT.state, postalCode: DEPOT.zip, addressCountry: "US" },
  sameAs: [SITE.instagramUrl, SITE.facebookUrl, SITE.tiktokUrl],
};

const WRAP = "mx-auto max-w-6xl px-4 sm:px-6";
const BTN = "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[14px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
const BTN_ORANGE = `${BTN} bg-std-orange text-std-navy hover:bg-std-orangeDark hover:text-white focus-visible:ring-std-orange`;
const EYEBROW = "text-[12px] font-semibold uppercase tracking-[0.16em] text-std-orangeDark";
const H2 = "mt-2 text-[24px] font-bold leading-tight tracking-[-0.02em] text-std-navy sm:text-[30px]";

/** Horaires venant de la base : on remplace les tirets par « à ». */
const plainHours = (s: string) => s.replace(/\s*[—–-]\s*/g, " à ");

export default async function AccueilPage() {
  const [img, agences] = await Promise.all([
    getSiteImages(),
    getAgences().catch(() => [] as Agence[]),
  ]);

  return (
    <div className="site-font min-h-screen bg-std-bg text-std-ink">
      <SiteHeader />
      <main>
        {/* ═══ HERO ═══ */}
        <section className="relative overflow-hidden bg-std-navy text-white">
          <div className="pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-std-navy2" aria-hidden="true" />
          <div className={`${WRAP} relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14`}>
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-white/85 ring-1 ring-white/15">
                <Plane size={14} className="text-std-orange" aria-hidden="true" /> USA → Haïti
              </p>
              <h1 className="mt-5 text-[32px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[44px] lg:text-[50px]">
                Vos achats en ligne, <span className="text-std-orange">livrés en Haïti.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/75 sm:text-[16px]">
                Depuis les USA, STANDA simplifie vos expéditions vers Haïti. Profitez d&apos;une adresse de réception gratuite à Miami, suivez vos colis, puis retirez les dans l&apos;agence la plus proche.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/inscription" className={BTN_ORANGE}>Créer mon compte <ArrowRight size={16} aria-hidden="true" /></Link>
                <a href="#suivi" className={`${BTN} border border-white/25 text-white hover:bg-white/10 focus-visible:ring-white`}>
                  <PackageSearch size={16} aria-hidden="true" /> Suivre mon colis
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.1} className="relative">
              <div className="relative overflow-hidden rounded-3xl ring-1 ring-white/10 shadow-[0_30px_80px_-30px_rgba(0,0,0,.6)]">
                <Image src={img.hero} alt="Colis STANDA pesé et étiqueté au dépôt de Miami" width={1400} height={933} priority unoptimized
                  className="h-[260px] w-full object-cover sm:h-[380px] lg:h-[430px]" />
              </div>
              {/* Carte trajet : itinéraire réel du service, sans chiffres inventés */}
              <div className="absolute -bottom-5 left-4 right-4 rounded-2xl bg-white p-4 text-std-ink shadow-xl sm:left-auto sm:right-6 sm:w-80">
                <div className="flex items-center justify-between text-[13px] font-bold text-std-navy">
                  <span>MIAMI, USA</span><span>HAÏTI</span>
                </div>
                <div className="relative mt-3 h-1.5 rounded-full bg-std-bg">
                  <div className="absolute inset-y-0 left-0 w-2/3 rounded-full bg-std-orange" />
                  <span className="absolute -top-2 left-2/3 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full bg-std-navy text-white"><Plane size={11} aria-hidden="true" /></span>
                </div>
                <p className="mt-3 text-[12px] text-std-mute">Suivi à chaque étape, jusqu&apos;à votre agence.</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ═══ SUIVI ═══ */}
        <section id="suivi" className={`${WRAP} scroll-mt-20 pt-20`}>
          <Reveal className="grid items-center gap-8 rounded-3xl bg-white p-5 shadow-[0_20px_60px_-35px_rgba(16,33,61,.35)] ring-1 ring-std-navy/5 sm:p-8 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className={EYEBROW}>Suivi de colis</p>
              <h2 className={H2}>Votre colis, toujours à portée de main.</h2>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-std-mute">Suivez facilement vos expéditions et restez informé de chaque étape.</p>
              <div className="relative mt-6 hidden overflow-hidden rounded-2xl lg:block">
                <Image src={img.suivi} alt="Suivi d'un colis sur téléphone" width={1400} height={933} unoptimized className="h-44 w-full object-cover" />
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl ring-1 ring-std-navy/10">
              <TrackBox />
            </div>
          </Reveal>
        </section>

        {/* ═══ SERVICES ═══ */}
        <section id="services" className={`${WRAP} scroll-mt-20 pt-20`}>
          <Reveal className="max-w-2xl">
            <p className={EYEBROW}>Nos services</p>
            <h2 className={H2}>Des solutions adaptées à vos besoins.</h2>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {SERVICES.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 0.05}>
                <article className="group flex h-full flex-col rounded-2xl bg-white p-5 ring-1 ring-std-navy/5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-24px_rgba(16,33,61,.35)] hover:ring-std-orange/40">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-std-navy text-std-orange transition group-hover:bg-std-orange group-hover:text-std-navy">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-[15px] font-bold text-std-navy">{title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-std-mute">{text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ═══ COMMENT ÇA MARCHE ═══ */}
        <section id="comment" className={`${WRAP} scroll-mt-20 pt-20`}>
          <Reveal className="text-center">
            <p className={EYEBROW}>Comment ça marche ?</p>
            <h2 className={H2}>Expédier avec STANDA, c&apos;est simple.</h2>
          </Reveal>
          <ol className="relative mt-10 grid gap-6 lg:grid-cols-4 lg:gap-5">
            <span className="absolute left-[22px] top-2 bottom-2 w-px bg-std-navy/15 lg:left-[12%] lg:right-[12%] lg:top-[22px] lg:bottom-auto lg:h-px lg:w-auto" aria-hidden="true" />
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <Reveal as="li" key={title} delay={i * 0.08} className="relative flex gap-4 lg:flex-col lg:items-center lg:text-center">
                  <span className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-std-orange text-[14px] font-bold text-std-navy ring-4 ring-std-bg">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-std-navy/5 lg:mt-4 lg:w-full">
                    <Icon size={18} className="text-std-navy lg:mx-auto" aria-hidden="true" />
                    <h3 className="mt-2 text-[15px] font-bold text-std-navy">{title}</h3>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-std-mute">{text}</p>
                  </div>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* ═══ POURQUOI STANDA ═══ */}
        <section className={`${WRAP} pt-20`}>
          <div className="grid overflow-hidden rounded-3xl bg-std-navy text-white lg:grid-cols-2">
            <div className="relative min-h-[240px]">
              <Image src={img.depot} alt="Colis au dépôt STANDA de Miami" fill unoptimized sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-std-navy/70 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-std-navy/40" aria-hidden="true" />
            </div>
            <Reveal className="p-6 sm:p-10">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-std-orange">Nos atouts</p>
              <h2 className="mt-2 text-[24px] font-bold leading-tight tracking-[-0.02em] sm:text-[30px]">Pourquoi choisir STANDA ?</h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {ADVANTAGES.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 rounded-xl bg-white/[.06] px-4 py-3 text-[14px] ring-1 ring-white/10">
                    <Icon size={18} className="shrink-0 text-std-orange" aria-hidden="true" />{text}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* ═══ AGENCES (données réelles) ═══ */}
        <section className={`${WRAP} pt-20`}>
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className={EYEBROW}>Nos agences</p>
              <h2 className={H2}>Retrouvez STANDA près de chez vous.</h2>
            </div>
            <Link href="/agences" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-std-navy hover:text-std-orangeDark">Toutes les agences <ArrowRight size={15} aria-hidden="true" /></Link>
          </Reveal>
          {agences.length ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {agences.slice(0, 6).map((a, i) => (
                <Reveal key={a.id ?? a.nom} delay={i * 0.05}>
                  <article className="flex h-full flex-col rounded-2xl bg-white p-5 ring-1 ring-std-navy/5 transition hover:shadow-[0_20px_40px_-24px_rgba(16,33,61,.35)]">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-std-orange/15 text-std-orangeDark"><MapPin size={18} aria-hidden="true" /></span>
                      <h3 className="text-[16px] font-bold text-std-navy">{a.nom}</h3>
                    </div>
                    {a.adresse && <p className="mt-3 text-[13.5px] leading-relaxed text-std-mute">{a.adresse}</p>}
                    <div className="mt-3 space-y-1.5 text-[13px] text-std-ink/80">
                      {a.telephone && <a href={`tel:${a.telephone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 hover:text-std-orangeDark"><Phone size={14} aria-hidden="true" />{a.telephone}</a>}
                      {a.horaire_1 && <p className="flex items-center gap-2"><Clock size={14} aria-hidden="true" />{plainHours(a.horaire_1)}</p>}
                    </div>
                    <Link href="/agences" className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[13.5px] font-semibold text-std-navy hover:text-std-orangeDark">Voir les détails <ArrowRight size={14} aria-hidden="true" /></Link>
                  </article>
                </Reveal>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-[14px] text-std-mute">La liste des agences est disponible sur la page <Link href="/agences" className="font-semibold text-std-navy underline">Nos agences</Link>.</p>
          )}
        </section>

        {/* ═══ APPEL À L'ACTION ═══ */}
        <section className={`${WRAP} pt-20`}>
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-std-navy px-6 py-12 text-center text-white sm:px-12">
              <Image src={img.final} alt="" fill unoptimized sizes="100vw" className="object-cover opacity-15" />
              <div className="absolute inset-x-0 top-0 h-1 bg-std-orange" aria-hidden="true" />
              <div className="relative">
                <h2 className="text-[24px] font-bold leading-tight tracking-[-0.02em] sm:text-[32px]">Prêt à recevoir vos colis en Haïti ?</h2>
                <p className="mx-auto mt-3 max-w-lg text-[15px] text-white/75">Rejoignez STANDA et profitez d&apos;une expérience d&apos;expédition plus simple.</p>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <Link href="/inscription" className={BTN_ORANGE}>Créer mon compte <ArrowRight size={16} aria-hidden="true" /></Link>
                  <Link href="/contact" className={`${BTN} border border-white/25 text-white hover:bg-white/10 focus-visible:ring-white`}>Nous contacter</Link>
                </div>
                <div className="mt-8">
                  <p className="text-[12px] text-white/60">Application mobile bientôt disponible</p>
                  <StoreBadges className="mt-2 justify-center" />
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ═══ FAQ ═══ */}
        <section id="faq" className={`${WRAP} scroll-mt-20 pb-20 pt-20`}>
          <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
            <Reveal>
              <p className={EYEBROW}>Questions fréquentes</p>
              <h2 className={H2}>Vous avez une question ?</h2>
              <p className="mt-3 text-[15px] text-std-mute">Notre équipe répond aussi sur WhatsApp.</p>
              <a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noopener noreferrer" className={`${BTN} mt-6 bg-std-navy text-white hover:bg-std-navy2 focus-visible:ring-std-navy`}>Écrire sur WhatsApp</a>
            </Reveal>
            <Reveal delay={0.05}><HomeFaq items={FAQ} /></Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }} />
    </div>
  );
}
