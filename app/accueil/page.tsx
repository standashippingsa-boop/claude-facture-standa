import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BellRing, Check, Clock3, Headphones, MapPin, PackageCheck, Plane, ScanLine, ShieldCheck, Store, Truck, Warehouse } from "lucide-react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import TrackBox from "@/components/site/TrackBox";
import { DEPOT } from "@/lib/depot";
import { SITE } from "@/lib/site";
import { SITE_URL } from "@/lib/branding";

export const metadata: Metadata = {
  title: "STANDA COMMERCIAL — Vos colis des États-Unis vers Haïti",
  description: "Commandez en ligne aux États-Unis, utilisez votre adresse à Miami et recevez vos colis en Haïti avec STANDA COMMERCIAL.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/accueil" },
  keywords: ["standa commercial", "shipping Haïti", "colis USA Haïti", "adresse Miami Haïti", "casillero Haïti", "envoi colis Ayiti"],
  openGraph: {
    type: "website", url: "/accueil", siteName: "STANDA COMMERCIAL", locale: "fr_HT",
    title: "STANDA COMMERCIAL — Vos colis des États-Unis vers Haïti",
    description: "Une adresse à Miami, un suivi clair et la récupération de vos colis en agence en Haïti.",
    images: [{ url: "/hero-shopping.jpg", width: 1600, height: 1067, alt: "Colis STANDA COMMERCIAL" }]
  }
};

const STEPS = [
  { number: "01", icon: PackageCheck, title: "Créez votre compte", text: "L'inscription est gratuite. Vous recevez votre code client personnel, votre repère pour chaque colis." },
  { number: "02", icon: Warehouse, title: "Utilisez votre adresse à Miami", text: "Ajoutez notre dépôt et votre code MC lors de vos achats en ligne aux États-Unis." },
  { number: "03", icon: Truck, title: "Recevez et récupérez", text: "Nous suivons votre colis de Miami jusqu'à sa disponibilité dans votre agence en Haïti." }
];

const BENEFITS = [
  { icon: ScanLine, title: "Suivi en temps réel", text: "Consultez le statut de vos colis, sans appeler ni vous déplacer." },
  { icon: Warehouse, title: "Adresse à Miami", text: "Une adresse de dépôt claire à utiliser pour vos achats en ligne." },
  { icon: Plane, title: "Vers Haïti", text: "Une chaîne logistique pensée pour relier vos achats à votre agence." },
  { icon: BellRing, title: "Notifications", text: "Restez informé lorsqu'un colis est reçu ou devient disponible." },
  { icon: Store, title: "Agences locales", text: "Récupérez vos colis dans le point de retrait qui vous convient." },
  { icon: Headphones, title: "Une équipe à l'écoute", text: "Une question avant une commande ? Notre équipe peut vous guider." }
];

const INTERDITS = [
  "Armes à feu, munitions et pièces d'armes", "Explosifs, feux d'artifice et pétards",
  "Produits inflammables, aérosols et gaz sous pression", "Produits chimiques corrosifs ou toxiques",
  "Stupéfiants et substances illégales", "Argent liquide, métaux précieux et produits contrefaits",
  "Animaux vivants, plantes, semences et produits périssables", "Médicaments sans ordonnance valide"
];

const SHOPPING_PLATFORMS = [
  { name: "SHEIN", href: "https://us.shein.com/", image: "/shop-logos/shein.jpg" },
  { name: "TEMU", href: "https://www.temu.com/", image: "/shop-logos/temu.jpg" },
  { name: "Fashion Nova", href: "https://www.fashionnova.com/", image: "/shop-logos/fashion-nova.jpg" },
  { name: "Amazon", href: "https://www.amazon.com/", image: "/shop-logos/amazon.jpg" },
  { name: "Victoria's Secret", href: "https://www.victoriassecret.com/us/", image: "/shop-logos/victorias-secret.jpg" },
  { name: "Samsung", href: "https://www.samsung.com/us/", image: "/shop-logos/samsung.jpg" },
  { name: "HP", href: "https://www.hp.com/us-en/shop/", image: "/shop-logos/hp.jpg" },
  { name: "eBay", href: "https://www.ebay.com/", image: "/shop-logos/ebay.jpg" },
  { name: "AliExpress", href: "https://www.aliexpress.com/", image: "/shop-logos/aliexpress.jpg" },
  { name: "The North Face", href: "https://www.thenorthface.com/en-us", image: "/shop-logos/north-face.jpg" },
  { name: "Nike", href: "https://www.nike.com/", image: "/shop-logos/nike.jpg" },
  { name: "Lacoste", href: "https://www.lacoste.com/us/", image: "/shop-logos/lacoste.jpg" },
  { name: "Zara", href: "https://www.zara.com/us/", image: "/shop-logos/zara.jpg" },
  { name: "adidas", href: "https://www.adidas.com/us", image: "/shop-logos/adidas.jpg" }
];

const JSONLD = {
  "@context": "https://schema.org", "@type": "MovingCompany", name: "STANDA COMMERCIAL", legalName: "Standa Shipping SA",
  url: `${SITE_URL}/accueil`, logo: `${SITE_URL}/logo.png`, image: `${SITE_URL}/hero-shopping.jpg`,
  description: "Service d'expédition de colis des États-Unis vers Haïti.", telephone: SITE.phone, email: SITE.email,
  areaServed: [{ "@type": "Country", name: "Haïti" }],
  address: { "@type": "PostalAddress", streetAddress: DEPOT.address1, addressLocality: DEPOT.city, addressRegion: DEPOT.state, postalCode: DEPOT.zip, addressCountry: "US" },
  sameAs: [SITE.instagramUrl, SITE.facebookUrl, SITE.tiktokUrl]
};

export default function AccueilPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#fbfcff] text-ink">
      <SiteHeader />
      <main>
        <section className="relative isolate overflow-hidden bg-navy">
          <Image src="/parcel-boxes-background.png" alt="" fill priority sizes="100vw" unoptimized className="object-cover object-center opacity-70" />
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,18,38,.98)_0%,rgba(8,18,38,.91)_42%,rgba(8,18,38,.56)_100%)]" />
          <div aria-hidden="true" className="site-grid absolute inset-0 opacity-[0.14]" />
          <div aria-hidden="true" className="absolute -right-36 -top-44 h-[34rem] w-[34rem] rounded-full bg-accent/20 blur-3xl" />
          <div aria-hidden="true" className="absolute -bottom-64 left-1/3 h-[28rem] w-[28rem] rounded-full bg-sky-400/10 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[minmax(0,1.04fr)_minmax(420px,.96fr)] lg:items-center lg:gap-16 lg:px-10 xl:px-6">
            <div className="max-w-2xl site-fade">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.17em] text-white/85 backdrop-blur-sm"><span className="h-1.5 w-1.5 rounded-full bg-accent" />Miami <span className="text-white/40">→</span> Haïti</p>
              <h1 className="mt-6 max-w-xl text-balance text-[42px] font-black leading-[.98] tracking-[-0.055em] text-white sm:text-[60px] lg:text-[66px]">Vos achats en ligne, <span className="text-accent">livrés simplement</span> en Haïti.</h1>
              <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-white/72 sm:text-[18px]">Une adresse de dépôt à Miami, un suivi clair et une équipe qui vous accompagne jusqu'à la récupération de vos colis.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/inscription" className="group inline-flex h-[3.25rem] items-center justify-center gap-2 rounded-xl bg-accent px-6 text-[15px] font-bold text-white shadow-[0_14px_34px_-12px_rgba(228,101,10,.8)] transition hover:-translate-y-0.5 hover:bg-accent-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Créer mon compte <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" /></Link>
                <Link href="/agences" className="inline-flex h-[3.25rem] items-center justify-center rounded-xl border border-white/20 bg-white/[0.06] px-6 text-[15px] font-bold text-white transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Voir nos agences</Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-[13px] font-medium text-white/65"><TrustItem>Inscription gratuite</TrustItem><TrustItem>Code client personnel</TrustItem><TrustItem>Suivi de colis</TrustItem></div>
            </div>
            <div className="relative site-fade site-fade-d2">
              <div aria-hidden="true" className="absolute -inset-4 rounded-[2rem] bg-accent/15 blur-2xl" />
              <div id="suivi" className="relative overflow-hidden rounded-[1.65rem] border border-white/15 bg-white/[0.09] p-3 shadow-[0_30px_80px_-28px_rgba(0,0,0,.7)] backdrop-blur-md sm:p-4">
                <div className="relative overflow-hidden rounded-[1.15rem]"><Image src="/site-backgrounds/standa-package-scale.png" alt="Colis STANDA en préparation" width={1536} height={1024} priority unoptimized className="h-48 w-full object-cover object-center opacity-80 sm:h-56" /><div className="absolute inset-0 bg-gradient-to-t from-navy/75 via-navy/10 to-transparent" /><div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-white/65">Votre pont logistique</p><p className="mt-1 text-[15px] font-bold">Des USA jusqu'à votre agence</p></div><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur-sm"><Plane size={19} /></div></div></div>
                <div className="mt-3"><TrackBox /></div>
              </div>
            </div>
          </div>
        </section>

        <section className="parcel-wash border-b border-line bg-white"><div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-line px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8 lg:px-10 xl:px-6"><MiniPromise icon={MapPin} title="Un point de départ clair" text="Votre adresse de dépôt à Miami." /><MiniPromise icon={ScanLine} title="Chaque étape visible" text="Suivez le parcours de votre colis." /><MiniPromise icon={Store} title="Près de chez vous" text="Retrouvez nos agences en Haïti." /></div></section>

        <section className="parcel-wash-alt border-b border-line bg-[#fffdf9] py-16 sm:py-20"><div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10 xl:px-6"><SectionHeading eyebrow="Vos boutiques préférées" title="Commandez là où vous aimez déjà acheter." text="Au moment du paiement, utilisez simplement votre adresse STANDA à Miami et votre code client MC." /><div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{SHOPPING_PLATFORMS.map((platform) => <PlatformCard key={platform.name} {...platform} />)}</div></div></section>

        <section className="parcel-wash mx-auto max-w-7xl rounded-[2rem] px-5 py-20 sm:px-8 sm:py-28 lg:px-10 xl:px-6"><SectionHeading eyebrow="Le parcours STANDA" title="Tout devient plus simple, étape par étape." text="Nous avons pensé l'expérience autour de ce dont vous avez besoin : acheter, recevoir et savoir où en est votre colis." /><div className="mt-11 grid gap-4 lg:grid-cols-3">{STEPS.map((step) => <StepCard key={step.number} {...step} />)}</div></section>

        <section className="parcel-wash-alt bg-mist py-20 sm:py-28"><div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:gap-20 lg:px-10 xl:px-6"><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-accent">Votre adresse à Miami</p><h2 className="mt-4 max-w-md text-balance text-[34px] font-black leading-[1.02] tracking-[-0.045em] text-navy sm:text-[46px]">Une adresse conçue pour vos achats en ligne.</h2><p className="mt-5 max-w-lg text-[16px] leading-relaxed text-mute">Votre code MC relie vos commandes à votre compte. Il est essentiel de l'ajouter à la deuxième ligne de l'adresse au moment de payer vos achats.</p><div className="mt-7 flex items-center gap-3 text-[14px] font-semibold text-navy"><span className="grid h-9 w-9 place-items-center rounded-full bg-accent-light text-accent-dark"><ShieldCheck size={18} /></span>Ne partagez jamais votre code avec un autre client.</div></div><div className="overflow-hidden rounded-[1.6rem] bg-navy shadow-[0_24px_60px_-28px_rgba(15,23,42,.6)]"><div className="flex items-center justify-between border-b border-white/10 px-6 py-5 sm:px-7"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-white/50">Aperçu de livraison</p><h3 className="mt-1 text-[17px] font-bold text-white">Votre adresse aux États-Unis</h3></div><MapPin size={21} className="text-accent" /></div><dl className="divide-y divide-white/10 px-6 sm:px-7"><AddressRow label="Nom" value="Votre nom complet" muted /><AddressRow label="Adresse 1" value={DEPOT.address1} /><AddressRow label="Adresse 2" value="MC-#####" accent /><AddressRow label="Ville" value={DEPOT.city} /><AddressRow label="État / ZIP" value={`${DEPOT.state} · ${DEPOT.zip}`} /><AddressRow label="Téléphone" value={DEPOT.phone} /></dl><div className="m-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3.5 text-[12.5px] leading-relaxed text-white/75 sm:m-5"><strong className="text-white">Important :</strong> remplacez <span className="font-mono font-bold text-accent">MC-#####</span> par votre code client personnel sur chaque commande.</div></div></div></section>

        <section className="parcel-wash-alt mx-auto max-w-7xl rounded-[2rem] px-5 py-20 sm:px-8 sm:py-28 lg:px-10 xl:px-6"><div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-20"><div className="relative min-h-[330px] overflow-hidden rounded-[1.75rem] bg-navy sm:min-h-[420px]"><Image src="/site-backgrounds/online-shopping-cart.jpg" alt="Achat en ligne et colis prêts à être expédiés" fill sizes="(min-width: 1024px) 50vw, 100vw" unoptimized className="object-cover opacity-55" /><div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/45 to-transparent" /><div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md sm:inset-x-7 sm:bottom-7"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-accent">Du dépôt à l'agence</p><p className="mt-2 max-w-sm text-[18px] font-bold leading-snug text-white">Un parcours lisible, de la réception à Miami à la disponibilité de votre colis.</p></div></div><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-accent">Un suivi utile</p><h2 className="mt-4 max-w-md text-balance text-[34px] font-black leading-[1.02] tracking-[-0.045em] text-navy sm:text-[46px]">Sachez où se trouve votre colis, à chaque moment.</h2><p className="mt-5 max-w-lg text-[16px] leading-relaxed text-mute">Entrez votre numéro de tracking sur cette page. Vous obtenez le statut de votre colis sans créer un nouveau compte ni exposer vos informations personnelles.</p><div className="mt-8 space-y-4"><EditorialPoint icon={Clock3} title="Une information au bon moment" text="Consultez l'état actuel de votre colis dès que vous en avez besoin." /><EditorialPoint icon={BellRing} title="Des notifications importantes" text="Restez informé lorsque votre colis avance dans son parcours." /></div></div></div></section>

        <section className="bg-navy py-20 sm:py-28"><div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_.92fr] lg:items-center lg:gap-20 lg:px-10 xl:px-6"><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-accent">Retrait en agence</p><h2 className="mt-4 max-w-xl text-balance text-[34px] font-black leading-[1.02] tracking-[-0.045em] text-white sm:text-[46px]">Vos colis arrivent là où vous pouvez les récupérer.</h2><p className="mt-5 max-w-lg text-[16px] leading-relaxed text-white/65">Quand votre colis est disponible, rendez-vous dans votre agence. Notre réseau est là pour rendre la dernière étape plus simple.</p><Link href="/agences" className="group mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-[14px] font-bold text-navy transition hover:-translate-y-0.5 hover:bg-accent-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Trouver mon agence <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" /></Link></div><div className="relative mx-auto w-full max-w-md rounded-[1.65rem] border border-white/12 bg-white/[.06] p-5 shadow-2xl backdrop-blur-sm sm:p-7"><div className="absolute right-6 top-7 text-accent/20"><MapPin size={100} strokeWidth={1} /></div><div className="relative"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-white"><Store size={22} /></span><p className="mt-8 text-[11px] font-bold uppercase tracking-[.18em] text-white/45">Prochaine étape</p><p className="mt-2 max-w-xs text-[23px] font-bold leading-tight text-white">Votre agence vous attend.</p><div className="mt-8 border-t border-white/10 pt-5"><p className="text-[13px] leading-relaxed text-white/60">Consultez les villes, horaires et coordonnées de nos points de retrait.</p><Link href="/agences" className="mt-3 inline-flex items-center gap-2 text-[13px] font-bold text-accent hover:text-white">Voir les agences <ArrowRight size={15} /></Link></div></div></div></div></section>

        <section className="parcel-wash mx-auto max-w-7xl rounded-[2rem] px-5 py-20 sm:px-8 sm:py-28 lg:px-10 xl:px-6"><SectionHeading eyebrow="Ce qui fait la différence" title="Le nécessaire pour commander avec confiance." text="Des outils simples et une logistique organisée autour de vos colis." /><div className="mt-11 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{BENEFITS.map((benefit) => <BenefitCard key={benefit.title} {...benefit} />)}</div></section>

        <section className="parcel-wash-alt border-y border-line bg-mist py-[4.5rem] sm:py-24"><div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10 xl:px-6"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><SectionHeading eyebrow="Avant d'expédier" title="Articles non acceptés" text="Pour la sécurité du transport, certains articles ne peuvent pas être pris en charge." /><Link href="/contact" className="inline-flex items-center gap-2 text-[14px] font-bold text-navy hover:text-accent">Une question sur un article ? <ArrowRight size={16} /></Link></div><ul className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{INTERDITS.map((item) => <li key={item} className="flex gap-3 rounded-xl border border-line bg-white px-4 py-4 text-[13px] leading-snug text-ink"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">×</span>{item}</li>)}</ul></div></section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10 xl:px-6"><div className="relative overflow-hidden rounded-[1.8rem] bg-accent px-6 py-12 sm:px-12 sm:py-16"><div aria-hidden="true" className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[38px] border-white/10" /><div aria-hidden="true" className="absolute -bottom-28 left-[36%] h-56 w-56 rounded-full bg-navy/10 blur-2xl" /><div className="relative max-w-2xl"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-white/70">Commencez aujourd&apos;hui</p><h2 className="mt-4 text-balance text-[36px] font-black leading-[1.01] tracking-[-.045em] text-white sm:text-[52px]">Vos achats en ligne arrivent jusqu&apos;à vous.</h2><p className="mt-5 max-w-lg text-[16px] leading-relaxed text-white/82">Ouvrez votre compte, recevez votre code client et commencez à faire livrer vos colis à Miami.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/inscription" className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-navy px-6 text-[14px] font-bold text-white transition hover:-translate-y-0.5 hover:bg-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy">Ouvrir un compte <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" /></Link><a href="#suivi" className="inline-flex h-12 items-center justify-center rounded-xl border border-white/35 bg-white/10 px-6 text-[14px] font-bold text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-navy">Suivre un colis</a></div></div></div></section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }} />
    </div>
  );
}

function TrustItem({ children }: { children: React.ReactNode }) { return <span className="inline-flex items-center gap-2"><Check size={15} className="text-accent" />{children}</span>; }
function MiniPromise({ icon: Icon, title, text }: { icon: typeof MapPin; title: string; text: string }) { return <div className="flex items-center gap-4 py-5 sm:px-7 sm:py-6 first:sm:pl-0 last:sm:pr-0"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-light text-accent-dark"><Icon size={18} /></span><div><p className="text-[13px] font-bold text-navy">{title}</p><p className="mt-0.5 text-[12.5px] text-mute">{text}</p></div></div>; }
function PlatformCard({ name, href, image, wordmarkClass }: { name: string; href: string; image?: string; wordmarkClass?: string }) { return <a href={href} target="_blank" rel="noreferrer" className="group flex min-h-[96px] items-center justify-center rounded-2xl border border-line bg-white px-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,.45)] transition duration-300 hover:-translate-y-1 hover:border-accent/35 hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" aria-label={`Commander sur ${name}`}>
  {image ? <Image src={image} alt={`Logo ${name}`} width={150} height={72} unoptimized className="h-12 w-auto max-w-[138px] object-contain mix-blend-multiply transition duration-300 group-hover:scale-105" /> : <span className={`font-black leading-none ${wordmarkClass ?? "text-navy"}`}>{name}</span>}
</a>; }
function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) { return <div className="max-w-2xl"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-accent">{eyebrow}</p><h2 className="mt-4 text-balance text-[34px] font-black leading-[1.03] tracking-[-.045em] text-navy sm:text-[46px]">{title}</h2><p className="mt-4 max-w-xl text-[16px] leading-relaxed text-mute">{text}</p></div>; }
function StepCard({ number, icon: Icon, title, text }: (typeof STEPS)[number]) { return <article className="group relative overflow-hidden rounded-[1.4rem] border border-line bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lift"><span aria-hidden="true" className="absolute -right-2 -top-5 text-[86px] font-black leading-none tracking-[-.1em] text-navy/[.035]">{number}</span><div className="relative"><span className="grid h-11 w-11 place-items-center rounded-xl bg-navy text-white transition group-hover:bg-accent"><Icon size={19} /></span><p className="mt-7 text-[11px] font-bold tracking-[.18em] text-accent">ÉTAPE {number}</p><h3 className="mt-2 text-[18px] font-bold text-navy">{title}</h3><p className="mt-3 text-[14px] leading-relaxed text-mute">{text}</p></div></article>; }
function AddressRow({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) { return <div className="flex items-start justify-between gap-5 py-3.5"><dt className="shrink-0 text-[12px] text-white/50">{label}</dt><dd className={`break-all text-right text-[13.5px] font-semibold ${accent ? "font-mono text-accent" : muted ? "font-normal italic text-white/50" : "text-white"}`}>{value}</dd></div>; }
function EditorialPoint({ icon: Icon, title, text }: { icon: typeof Clock3; title: string; text: string }) { return <div className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-light text-accent-dark"><Icon size={18} /></span><div><h3 className="text-[15px] font-bold text-navy">{title}</h3><p className="mt-1 text-[14px] leading-relaxed text-mute">{text}</p></div></div>; }
function BenefitCard({ icon: Icon, title, text }: (typeof BENEFITS)[number]) { return <article className="group rounded-[1.25rem] border border-line bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lift"><span className="grid h-10 w-10 place-items-center rounded-xl bg-mist text-navy transition group-hover:bg-accent group-hover:text-white"><Icon size={18} /></span><h3 className="mt-5 text-[15px] font-bold text-navy">{title}</h3><p className="mt-2 text-[13.5px] leading-relaxed text-mute">{text}</p></article>; }
