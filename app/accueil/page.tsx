import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Cross as X } from "@getpapillon/papicons";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import StoreBadges from "@/components/site/StoreBadges";
import TrackBox from "@/components/site/TrackBox";
import { DEPOT } from "@/lib/depot";
import { SITE } from "@/lib/site";
import { SITE_URL } from "@/lib/branding";
import { getSiteImages } from "@/lib/site-images";

// Les images choisies dans Paramètres apparaissent en moins d'une minute.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "STANDA COMMERCIAL · Vos colis des USA vers Haïti",
  description: "Une adresse à Miami, le suivi de vos colis et le retrait dans votre agence en Haïti.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/accueil" },
  keywords: ["standa commercial", "shipping Haïti", "colis USA Haïti", "adresse Miami Haïti", "envoi colis Ayiti"],
  openGraph: {
    type: "website", url: "/accueil", siteName: "STANDA COMMERCIAL", locale: "fr_HT",
    title: "STANDA COMMERCIAL · Vos colis des USA vers Haïti",
    description: "Une adresse à Miami, le suivi de vos colis et le retrait dans votre agence en Haïti.",
    images: [{ url: "/hero-shopping.jpg", width: 1600, height: 1067, alt: "Colis STANDA COMMERCIAL" }]
  }
};

const STEPS = [
  { title: "Créez votre compte", text: "Inscrivez vous gratuitement sur notre site en quelques minutes." },
  { title: "Recevez votre code MC", text: "Après vérification, vous recevez sur WhatsApp votre code MC, votre mot de passe et votre adresse à Miami." },
  { title: "Achetez en ligne", text: "Commandez sur Amazon, SHEIN, Temu, eBay ou toute autre boutique, et faites livrer à notre adresse de Miami." },
  { title: "Indiquez votre code MC", text: "Écrivez votre code MC à la ligne Address Line 2 de chaque commande. Sans ce code, nous ne pouvons pas identifier votre colis." },
  { title: "Suivez votre colis", text: "Vous êtes averti à chaque étape : reçu à Miami, en route vers Haïti, puis disponible dans votre agence." },
  { title: "Payez et récupérez", text: "Réglez en espèces, MonCash, NatCash ou Zelle, puis récupérez votre colis à l'agence de votre ville." },
];

const SHOPS = [
  ["SHEIN", "shein"], ["TEMU", "temu"], ["Amazon", "amazon"], ["eBay", "ebay"], ["AliExpress", "aliexpress"],
  ["Fashion Nova", "fashion-nova"], ["Nike", "nike"], ["adidas", "adidas"], ["Zara", "zara"], ["Samsung", "samsung"],
];

const INTERDITS = [
  "Armes et munitions", "Explosifs et feux d'artifice", "Produits inflammables", "Produits chimiques",
  "Stupéfiants", "Argent liquide et métaux précieux", "Animaux et plantes", "Médicaments sans ordonnance",
];

const JSONLD = {
  "@context": "https://schema.org", "@type": "MovingCompany", name: "STANDA COMMERCIAL", legalName: "Standa Shipping SA",
  url: `${SITE_URL}/accueil`, logo: `${SITE_URL}/logo.png`, image: `${SITE_URL}/hero-shopping.jpg`,
  description: "Expédition de colis des USA vers Haïti.", telephone: SITE.phone, email: SITE.email,
  areaServed: [{ "@type": "Country", name: "Haïti" }],
  address: { "@type": "PostalAddress", streetAddress: DEPOT.address1, addressLocality: DEPOT.city, addressRegion: DEPOT.state, postalCode: DEPOT.zip, addressCountry: "US" },
  sameAs: [SITE.instagramUrl, SITE.facebookUrl, SITE.tiktokUrl]
};

const WRAP = "mx-auto max-w-5xl px-4 sm:px-6";
const BTN = "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold transition";

export default async function AccueilPage() {
  const img = await getSiteImages();
  const cards = [
    { title: "Inscription", href: "/inscription", cta: "Créer un compte", image: img.inscription },
    { title: "Suivi de colis", href: "#suivi", cta: "Suivre un colis", image: img.suivi },
    { title: "Nos agences", href: "/agences", cta: "Voir les agences", image: img.agences, position: "50% 22%" },
  ];

  return (
    <div className="site-font min-h-screen bg-[#f3f5f9] text-navy">
      <SiteHeader />
      <main>
        {/* Haut de page */}
        <section className="relative isolate overflow-hidden bg-navy">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.hero} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-35" />
          <div className={`${WRAP} py-12 text-center text-white sm:py-16`}>
            <h1 className="mx-auto max-w-xl text-[26px] font-bold leading-tight sm:text-[34px]">
              Vos achats aux USA, livrés en Haïti.
            </h1>
            <p className="mt-3 text-[14px] text-white/80">Adresse à Miami gratuite · Retrait dans votre agence</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              <Link href="/inscription" className={`${BTN} bg-accent text-white hover:bg-accent-dark`}>Créer un compte <ArrowRight size={15} /></Link>
              <a href="#suivi" className={`${BTN} border border-white/40 text-white hover:bg-white/10`}>Suivre un colis</a>
            </div>
          </div>
        </section>

        {/* Adresse à Miami */}
        <section className={`${WRAP} -mt-6`}>
          <div className="relative overflow-hidden rounded-2xl bg-accent text-white shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.depot} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" />
            <div className="relative px-5 py-6 text-center">
              <p className="text-[13px] font-semibold uppercase tracking-wider text-white/85">Votre adresse à Miami</p>
              <p className="mt-2 text-[15px] font-bold leading-relaxed">
                Votre nom + votre code MC<br />
                {DEPOT.address1}, {DEPOT.city.charAt(0) + DEPOT.city.slice(1).toLowerCase()}, {DEPOT.state} {DEPOT.zip}, USA
              </p>
            </div>
          </div>
        </section>

        {/* Inscription, suivi, agences */}
        <section className={`${WRAP} mt-6 grid gap-3 sm:grid-cols-3`}>
          {cards.map((card) => (
            <Link key={card.title} href={card.href} className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:ring-navy/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.image} alt="" className="h-28 w-full object-cover" style={"position" in card ? { objectPosition: card.position } : undefined} />
              <div className="flex items-center justify-between gap-2 p-4">
                <span className="text-[15px] font-bold">{card.title}</span>
                <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent-dark">{card.cta} <ArrowRight size={14} /></span>
              </div>
            </Link>
          ))}
        </section>

        {/* Suivi */}
        <section id="suivi" className={`${WRAP} mt-8 scroll-mt-20`}>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            <TrackBox />
          </div>
        </section>

        {/* Comment ça marche */}
        <section id="comment" className={`${WRAP} mt-10 scroll-mt-20`}>
          <h2 className="text-center text-[20px] font-bold sm:text-[22px]">Comment ça marche ?</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-[13px] font-bold text-white">{i + 1}</span>
                <span>
                  <span className="block text-[14px] font-bold leading-snug">{step.title}</span>
                  <span className="mt-1 block text-[13px] leading-relaxed text-navy/65">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Boutiques */}
        <section className={`${WRAP} mt-10`}>
          <h2 className="text-center text-[20px] font-bold sm:text-[22px]">Achetez sur vos boutiques préférées</h2>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
            {SHOPS.map(([name, file]) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={file} src={`/shop-logos/${file}.jpg`} alt={name} className="h-7 w-auto max-w-[84px] object-contain opacity-80 mix-blend-multiply grayscale" />
            ))}
          </div>
        </section>

        {/* Articles non acceptés */}
        <section className={`${WRAP} mt-10`}>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h2 className="text-[17px] font-bold">Articles non acceptés</h2>
            <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {INTERDITS.map((item) => (
                <li key={item} className="flex items-center gap-2 text-[13px] text-navy/80"><X size={14} className="shrink-0 text-red-600" />{item}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* Bas de page */}
        <section className={`${WRAP} mt-10 pb-10`}>
          <div className="relative overflow-hidden rounded-2xl bg-navy text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.final} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
            <div className="relative flex flex-col items-center gap-4 px-5 py-8 text-center">
              <h2 className="text-[20px] font-bold sm:text-[24px]">Prêt pour votre prochaine commande ?</h2>
              <Link href="/inscription" className={`${BTN} bg-white text-navy hover:bg-[#eef2f8]`}>Créer un compte <ArrowRight size={15} /></Link>
              <div>
                <p className="text-[12px] text-white/70">Application mobile bientôt disponible</p>
                <StoreBadges className="mt-2 justify-center" />
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }} />
    </div>
  );
}
