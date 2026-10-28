import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock3, MapPin, PackageSearch, ShieldCheck, Store, X } from "lucide-react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import StoreBadges from "@/components/site/StoreBadges";
import TrackBox from "@/components/site/TrackBox";
import { DEPOT } from "@/lib/depot";
import { SITE } from "@/lib/site";
import { SITE_URL } from "@/lib/branding";

export const metadata: Metadata = {
  title: "STANDA COMMERCIAL · Vos colis des USA vers Haïti",
  description: "Commandez en ligne aux USA, utilisez votre adresse à Miami et recevez vos colis en Haïti avec STANDA COMMERCIAL.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/accueil" },
  keywords: ["standa commercial", "shipping Haïti", "colis USA Haïti", "adresse Miami Haïti", "casillero Haïti", "envoi colis Ayiti"],
  openGraph: {
    type: "website", url: "/accueil", siteName: "STANDA COMMERCIAL", locale: "fr_HT",
    title: "STANDA COMMERCIAL · Vos colis des USA vers Haïti",
    description: "Une adresse à Miami, un suivi clair et la récupération de vos colis en agence en Haïti.",
    images: [{ url: "/hero-shopping.jpg", width: 1600, height: 1067, alt: "Colis STANDA COMMERCIAL" }]
  }
};

const STEPS = [
  { title: "Créez votre compte", text: "L'inscription est gratuite. Remplissez le formulaire avec votre nom, votre téléphone et l'agence où vous voulez récupérer vos colis." },
  { title: "Recevez votre code client", text: "Dès l'inscription, vous obtenez un code personnel qui commence par MC. C'est lui qui permet de reconnaître vos colis : conservez ce code." },
  { title: "Copiez votre adresse à Miami", text: "Dans votre espace client, vous trouvez l'adresse de notre dépôt à Miami. Votre code MC se place sur la deuxième ligne de l'adresse." },
  { title: "Achetez en ligne", text: "Commandez sur la boutique de votre choix (SHEIN, Amazon, Temu…) et mettez l'adresse de Miami comme adresse de livraison, avec votre code MC." },
  { title: "Nous recevons votre colis à Miami", text: "À son arrivée au dépôt, le colis est pesé et enregistré sur votre compte. Vous le voyez apparaître dans votre espace client." },
  { title: "Votre colis voyage vers Haïti", text: "Suivez chaque étape : en préparation, en transit, arrivé en Haïti, puis en route vers votre agence. Le suivi fonctionne aussi sur cette page, sans compte." },
  { title: "Votre colis est disponible", text: "Quand le colis est dans votre agence, son statut passe à « Disponible » et votre facture s'affiche dans votre espace client." },
  { title: "Payez et récupérez", text: "Venez à votre agence avec votre code client, réglez votre facture et repartez avec votre colis." }
];

const INTERDITS = [
  "Armes à feu, munitions et pièces d'armes", "Explosifs, feux d'artifice et pétards",
  "Produits inflammables, aérosols et gaz sous pression", "Produits chimiques corrosifs ou toxiques",
  "Stupéfiants et substances illégales", "Argent liquide, métaux précieux et produits contrefaits",
  "Animaux vivants, plantes, semences et produits périssables", "Médicaments sans ordonnance valide"
];

const SHOPPING_PLATFORMS = [
  { name: "SHEIN", image: "/shop-logos/shein.jpg" },
  { name: "TEMU", image: "/shop-logos/temu.jpg" },
  { name: "Fashion Nova", image: "/shop-logos/fashion-nova.jpg" },
  { name: "Amazon", image: "/shop-logos/amazon.jpg" },
  { name: "Victoria's Secret", image: "/shop-logos/victorias-secret.jpg" },
  { name: "Samsung", image: "/shop-logos/samsung.jpg" },
  { name: "HP", image: "/shop-logos/hp.jpg" },
  { name: "eBay", image: "/shop-logos/ebay.jpg" },
  { name: "AliExpress", image: "/shop-logos/aliexpress.jpg" },
  { name: "The North Face", image: "/shop-logos/north-face.jpg" },
  { name: "Nike", image: "/shop-logos/nike.jpg" },
  { name: "Lacoste", image: "/shop-logos/lacoste.jpg" },
  { name: "Zara", image: "/shop-logos/zara.jpg" },
  { name: "adidas", image: "/shop-logos/adidas.jpg" }
];

const PROMISES = [
  { icon: PackageSearch, text: "Suivi de votre colis à chaque étape" },
  { icon: Clock3, text: "3 à 7 jours ouvrables depuis Miami" },
  { icon: MapPin, text: "Adresse à Miami gratuite à l'inscription" },
  { icon: Store, text: "Retrait dans votre agence en Haïti" }
];

const SERVICES = [
  { title: "Adresse à Miami", image: "/site/shopping.webp", href: "/inscription", points: ["Gratuite dès l'inscription", "Votre code MC sur chaque colis"] },
  { title: "Expédition vers Haïti", image: "/site/warehouse.webp", href: "#comment", points: ["Pesée et enregistrement à Miami", "Départs réguliers vers Haïti"] },
  { title: "Retrait en agence", image: "/site/agent.webp", href: "/agences", points: ["Agences dans plusieurs villes", "Paiement sur place"] },
  { title: "Suivi en ligne", image: "/site/laptop.webp", href: "#suivi", points: ["Avec ou sans compte", "Notifications à chaque étape"] }
];

const JSONLD = {
  "@context": "https://schema.org", "@type": "MovingCompany", name: "STANDA COMMERCIAL", legalName: "Standa Shipping SA",
  url: `${SITE_URL}/accueil`, logo: `${SITE_URL}/logo.png`, image: `${SITE_URL}/hero-shopping.jpg`,
  description: "Service d'expédition de colis des USA vers Haïti.", telephone: SITE.phone, email: SITE.email,
  areaServed: [{ "@type": "Country", name: "Haïti" }],
  address: { "@type": "PostalAddress", streetAddress: DEPOT.address1, addressLocality: DEPOT.city, addressRegion: DEPOT.state, postalCode: DEPOT.zip, addressCountry: "US" },
  sameAs: [SITE.instagramUrl, SITE.facebookUrl, SITE.tiktokUrl]
};

const WRAP = "mx-auto max-w-7xl px-5 sm:px-8 lg:px-10 xl:px-6";
const PILL_DARK = "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink pl-6 pr-5 text-[15px] font-semibold text-white transition hover:bg-navy";

export default function AccueilPage() {
  return (
    <div className="site-font min-h-screen bg-[#eef0f3] text-ink">
      <SiteHeader />
      <main>
        {/* ═══ Haut de page ═══ */}
        <section className="relative overflow-hidden">
          <div className={`${WRAP} grid gap-10 pb-24 pt-10 sm:pt-14 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-6 lg:pb-32`}>
            <div className="relative z-10">
              <p className="text-[12px] font-medium tracking-[0.14em] text-ink/60">EXPÉDITION DE COLIS · USA → HAÏTI</p>
              <h1 className="mt-5 text-[42px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[60px] lg:text-[66px]">
                Vos achats aux USA,<br /><span className="text-ink/45">livrés en Haïti.</span>
              </h1>
              <p className="mt-6 max-w-md text-[16px] leading-relaxed text-ink/70">
                Une adresse à Miami, un suivi clair à chaque étape et le retrait de vos colis dans votre agence en Haïti.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <Link href="/inscription" className={PILL_DARK}>Créer mon compte <ArrowRight size={17} /></Link>
                <a href="#suivi" className="group inline-flex items-center gap-3 text-[14px] leading-tight text-ink/80">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,.06)] transition group-hover:bg-ink group-hover:text-white"><PackageSearch size={19} /></span>
                  Suivre<br />un colis
                </a>
              </div>
              <ul className="mt-12 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
                {PROMISES.map(({ icon: Icon, text }) => (
                  <li key={text} className="text-[12.5px] leading-snug text-ink/65"><Icon size={21} strokeWidth={1.6} className="mb-2.5 text-ink" />{text}</li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="relative overflow-hidden rounded-[32px] bg-white shadow-[0_30px_60px_-30px_rgba(15,23,42,.35)]">
                <Image src="/site/hero-scale.webp" alt="Colis STANDA COMMERCIAL pesé et étiqueté au dépôt" width={1400} height={933} priority unoptimized className="h-[300px] w-full object-cover sm:h-[440px] lg:h-[520px]" />
              </div>
              <div className="absolute -bottom-6 left-4 rounded-2xl bg-white px-4 py-3 shadow-[0_12px_30px_-12px_rgba(15,23,42,.35)] sm:left-8">
                <p className="text-[12px] text-ink/55">Votre colis est reconnu grâce à</p>
                <p className="mt-0.5 text-[18px] font-semibold tracking-tight">votre code MC</p>
              </div>
              <div className="absolute right-4 top-4 hidden rounded-2xl bg-white/95 px-4 py-3 shadow-[0_12px_30px_-12px_rgba(15,23,42,.35)] sm:block">
                <p className="text-[24px] font-semibold leading-none tracking-tight">3–7 j</p>
                <p className="mt-1 text-[11.5px] text-ink/55">ouvrables, Miami → Haïti</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Feuille blanche qui remonte sur le haut de page ═══ */}
        <div className="relative z-10 -mt-12 px-3 sm:px-4">
          <div className="mx-auto max-w-[88rem] rounded-[28px] bg-white py-12 sm:py-16">

            {/* Suivi */}
            <section id="suivi" className={`${WRAP} scroll-mt-24 grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center`}>
              <div>
                <Eyebrow>SUIVI DE COLIS</Eyebrow>
                <h2 className="mt-4 text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[38px]">Où est mon colis ? <span className="text-ink/45">Vérifiez en quelques secondes.</span></h2>
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink/65">Entrez le numéro de suivi de la boutique ou de STANDA. Pas besoin de compte.</p>
              </div>
              <div className="overflow-hidden rounded-3xl border border-line">
                <TrackBox />
              </div>
            </section>

            <Divider />

            {/* À propos */}
            <section className={`${WRAP} grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:items-center`}>
              <div>
                <Eyebrow>À PROPOS</Eyebrow>
                <h2 className="mt-4 text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[38px]">Vos colis des USA vers Haïti <span className="text-ink/45">sans complication</span></h2>
                <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink/65">Nous nous occupons de tout : réception de vos achats à Miami, pesée et enregistrement, expédition vers Haïti puis remise dans votre agence. Vous suivez chaque étape depuis votre espace client.</p>
                <p className="mt-6 flex items-center gap-3 text-[13.5px] text-ink/70"><ShieldCheck size={22} strokeWidth={1.6} className="shrink-0 text-ink" />Comptes personnels et comptes entreprise</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Image src="/site/warehouse.webp" alt="Colis au dépôt" width={1100} height={733} unoptimized className="h-56 w-full rounded-3xl object-cover sm:h-72" />
                <div className="flex flex-col gap-4">
                  <Image src="/site/agent.webp" alt="Agent STANDA avec un colis" width={1100} height={587} unoptimized className="h-40 w-full flex-1 rounded-3xl object-cover sm:h-52" />
                  <Link href="/agences" className="flex h-14 items-center justify-between rounded-full border border-line px-5 text-[14px] font-medium transition hover:border-ink">Nos agences <ArrowRight size={17} /></Link>
                </div>
              </div>
            </section>

            <Divider />

            {/* Services */}
            <section className={WRAP}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <Eyebrow>NOS SERVICES</Eyebrow>
                  <h2 className="mt-4 text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[38px]">Tout ce qu&apos;il faut, du clic au retrait</h2>
                </div>
                <Link href="/inscription" className="inline-flex items-center gap-3 text-[14px] font-medium">Commencer <ArrowRight size={17} /></Link>
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {SERVICES.map((service) => (
                  <article key={service.title} className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-white transition hover:border-ink/25">
                    <Image src={service.image} alt="" width={900} height={600} unoptimized className="h-40 w-full object-cover" />
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="text-[17px] font-semibold tracking-tight">{service.title}</h3>
                      <div className="mt-3 flex flex-1 items-end justify-between gap-3">
                        <ul className="space-y-1.5 text-[13px] leading-snug text-ink/60">
                          {service.points.map((point) => <li key={point} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink/40" />{point}</li>)}
                        </ul>
                        <Link href={service.href} aria-label={service.title} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line transition group-hover:border-ink group-hover:bg-ink group-hover:text-white"><ArrowRight size={16} /></Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <Divider />

            {/* Boutiques */}
            <section className={WRAP}>
              <Eyebrow>BOUTIQUES</Eyebrow>
              <h2 className="mt-4 text-[26px] font-semibold leading-tight tracking-[-0.02em] sm:text-[32px]">Commandez là où vous aimez déjà acheter</h2>
              <div className="mt-7 flex flex-wrap items-center gap-x-9 gap-y-6">
                {SHOPPING_PLATFORMS.map((platform) => (
                  <Image key={platform.name} src={platform.image} alt={`Logo ${platform.name}`} width={150} height={72} unoptimized className="h-9 w-auto max-w-[104px] object-contain opacity-80 mix-blend-multiply grayscale transition hover:opacity-100 hover:grayscale-0" />
                ))}
              </div>
            </section>

            <Divider />

            {/* Comment ça marche */}
            <section id="comment" className={`${WRAP} scroll-mt-24`}>
              <Eyebrow>COMMENT ÇA MARCHE</Eyebrow>
              <h2 className="mt-4 text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[38px]">De l&apos;inscription au retrait, <span className="text-ink/45">en 8 étapes</span></h2>
              <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="rounded-3xl bg-[#f4f5f7] p-5">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-[13px] font-semibold">{String(index + 1).padStart(2, "0")}</span>
                    <h3 className="mt-4 text-[16px] font-semibold tracking-tight">{step.title}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/60">{step.text}</p>
                  </li>
                ))}
              </ol>
            </section>

            <Divider />

            {/* Articles non acceptés */}
            <section className={WRAP}>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <Eyebrow>SÉCURITÉ</Eyebrow>
                  <h2 className="mt-4 text-[26px] font-semibold leading-tight tracking-[-0.02em] sm:text-[32px]">Articles non acceptés</h2>
                  <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink/60">Pour la sécurité du transport, certains articles ne peuvent pas être pris en charge.</p>
                </div>
                <Link href="/contact" className="inline-flex items-center gap-2 text-[14px] font-medium">Une question sur un article ? <ArrowRight size={16} /></Link>
              </div>
              <ul className="mt-7 grid gap-x-10 sm:grid-cols-2">
                {INTERDITS.map((item) => (
                  <li key={item} className="flex gap-3 border-b border-line py-3.5 text-[14.5px] text-ink/80"><X size={17} className="mt-0.5 shrink-0 text-red-600" />{item}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        {/* ═══ Appel final ═══ */}
        <section className="px-3 pt-3 sm:px-4 sm:pt-4">
          <div className="relative mx-auto max-w-[88rem] overflow-hidden rounded-[28px] bg-navy">
            <Image src="/site/account.webp" alt="" width={1100} height={600} unoptimized className="absolute inset-0 h-full w-full object-cover opacity-25" />
            <div className={`${WRAP} relative grid gap-8 py-14 text-white sm:py-16 lg:grid-cols-[1.2fr_.8fr] lg:items-center`}>
              <div>
                <h2 className="max-w-xl text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[40px]">Prêt pour votre prochaine commande ?</h2>
                <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/75">Créez votre compte gratuitement : votre adresse à Miami et votre code MC sont prêts tout de suite.</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href="/inscription" className="inline-flex h-12 items-center gap-2 rounded-full bg-white pl-6 pr-5 text-[15px] font-semibold text-ink transition hover:bg-[#eef0f3]">Créer mon compte <ArrowRight size={17} /></Link>
                  <Link href="/agences" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/35 px-6 text-[15px] font-medium text-white transition hover:bg-white/10">Trouver mon agence</Link>
                </div>
              </div>
              <div className="lg:justify-self-end">
                <p className="text-[13px] text-white/65">Application mobile · bientôt disponible</p>
                <StoreBadges className="mt-3" />
              </div>
            </div>
          </div>
        </section>
        <div className="h-3 sm:h-4" />
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }} />
    </div>
  );
}

function Eyebrow({ children }: { children: string }) {
  return <p className="text-[12px] font-medium tracking-[0.14em] text-ink/55">{children}</p>;
}

function Divider() {
  return <div className="mx-auto my-12 h-px max-w-7xl bg-line sm:my-16" />;
}
