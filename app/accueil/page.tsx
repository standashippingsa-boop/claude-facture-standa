import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import StoreBadges from "@/components/site/StoreBadges";
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
  { title: "Créez votre compte", text: "L'inscription est gratuite. Remplissez le formulaire avec votre nom, votre téléphone et l'agence où vous voulez récupérer vos colis." },
  { title: "Recevez votre code client", text: "Dès l'inscription, vous obtenez un code personnel qui commence par MC. C'est lui qui permet de reconnaître vos colis : gardez-le." },
  { title: "Copiez votre adresse à Miami", text: "Dans votre espace client, vous trouvez l'adresse de notre dépôt à Miami. Votre code MC se place sur la deuxième ligne de l'adresse." },
  { title: "Achetez en ligne", text: "Commandez sur la boutique de votre choix (SHEIN, Amazon, Temu…) et mettez l'adresse de Miami comme adresse de livraison, avec votre code MC." },
  { title: "Nous recevons votre colis à Miami", text: "À son arrivée au dépôt, le colis est pesé et enregistré sur votre compte. Vous le voyez apparaître dans votre espace client." },
  { title: "Votre colis voyage vers Haïti", text: "Suivez chaque étape : en préparation, en transit, arrivé en Haïti, puis en route vers votre agence. Le suivi fonctionne aussi sur cette page, sans compte." },
  { title: "Votre colis est disponible", text: "Quand le colis est dans votre agence, son statut passe à « Disponible » et votre facture s'affiche dans votre espace client." },
  { title: "Payez et récupérez", text: "Présentez-vous à votre agence avec votre code client, réglez votre facture et repartez avec votre colis." }
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

const JSONLD = {
  "@context": "https://schema.org", "@type": "MovingCompany", name: "STANDA COMMERCIAL", legalName: "Standa Shipping SA",
  url: `${SITE_URL}/accueil`, logo: `${SITE_URL}/logo.png`, image: `${SITE_URL}/hero-shopping.jpg`,
  description: "Service d'expédition de colis des États-Unis vers Haïti.", telephone: SITE.phone, email: SITE.email,
  areaServed: [{ "@type": "Country", name: "Haïti" }],
  address: { "@type": "PostalAddress", streetAddress: DEPOT.address1, addressLocality: DEPOT.city, addressRegion: DEPOT.state, postalCode: DEPOT.zip, addressCountry: "US" },
  sameAs: [SITE.instagramUrl, SITE.facebookUrl, SITE.tiktokUrl]
};

const WRAP = "mx-auto max-w-7xl px-5 sm:px-8 lg:px-10 xl:px-6";
const BTN = "inline-flex h-12 items-center justify-center gap-2 rounded-md px-6 text-[15px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4";

export default function AccueilPage() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <SiteHeader />
      <main>
        <section className="bg-navy text-white">
          <div className={`${WRAP} grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_.95fr] lg:items-start lg:gap-14`}>
            <div className="max-w-xl">
              <h1 className="text-[36px] font-extrabold leading-[1.08] tracking-tight sm:text-[50px]">Vos achats en ligne, livrés simplement en Haïti.</h1>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href="/inscription" className={`${BTN} bg-accent text-white hover:bg-accent-dark focus-visible:outline-white`}>Créer mon compte <ArrowRight size={17} /></Link>
                <Link href="/agences" className={`${BTN} border border-white/40 text-white hover:bg-white/10 focus-visible:outline-white`}>Voir nos agences</Link>
              </div>
              <div className="mt-9 border-t border-white/15 pt-6">
                <p className="text-[14px] font-semibold text-white/80">Application mobile · bientôt disponible</p>
                <StoreBadges className="mt-3" />
              </div>
            </div>
            <div id="suivi">
              <TrackBox />
            </div>
          </div>
        </section>

        <section className="border-b border-line py-14 sm:py-16">
          <div className={WRAP}>
            <SectionHeading title="Commandez là où vous aimez déjà acheter." />
            <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-5">
              {SHOPPING_PLATFORMS.map((platform) => (
                <Image key={platform.name} src={platform.image} alt={`Logo ${platform.name}`} width={150} height={72} unoptimized className="h-7 w-auto max-w-[84px] object-contain mix-blend-multiply" />
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-20">
          <div className={WRAP}>
            <SectionHeading title="Comment ça marche" text="De l'inscription au retrait de votre colis, voici tout ce qu'il faut faire." />
            <ol className="mt-8 grid gap-x-12 lg:grid-cols-2">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4 border-b border-line py-5">
                  <p className="w-8 shrink-0 text-[28px] font-extrabold leading-none text-accent">{index + 1}</p>
                  <div>
                    <h3 className="text-[17px] font-bold text-navy">{step.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-mute">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-navy py-14 text-white sm:py-20">
          <div className={`${WRAP} grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-16`}>
            <h2 className="max-w-xl text-[30px] font-extrabold leading-tight tracking-tight sm:text-[40px]">Vos colis arrivent là où vous pouvez les récupérer.</h2>
            <div>
              <p className="max-w-lg text-[16px] leading-relaxed text-white/80">Quand votre colis est disponible, rendez-vous dans votre agence. Consultez les villes, horaires et coordonnées de nos points de retrait.</p>
              <Link href="/agences" className={`${BTN} mt-6 bg-white text-navy hover:bg-accent-light focus-visible:outline-white`}>Trouver mon agence <ArrowRight size={16} /></Link>
            </div>
          </div>
        </section>

        <section className="border-b border-line py-14 sm:py-20">
          <div className={WRAP}>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <SectionHeading title="Articles non acceptés" text="Pour la sécurité du transport, certains articles ne peuvent pas être pris en charge." />
              <Link href="/contact" className="inline-flex items-center gap-2 text-[14px] font-bold text-navy underline-offset-4 hover:underline">Une question sur un article ? <ArrowRight size={16} /></Link>
            </div>
            <ul className="mt-8 grid gap-x-12 sm:grid-cols-2">
              {INTERDITS.map((item) => (
                <li key={item} className="flex gap-3 border-b border-line py-3.5 text-[15px] text-ink"><X size={17} className="mt-0.5 shrink-0 text-red-600" />{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-mist py-12">
          <div className={`${WRAP} flex justify-center`}>
            <StoreBadges />
          </div>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }} />
    </div>
  );
}

function SectionHeading({ title, text }: { title: string; text?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-[28px] font-extrabold leading-tight tracking-tight text-navy sm:text-[36px]">{title}</h2>
      {text ? <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-mute">{text}</p> : null}
    </div>
  );
}
