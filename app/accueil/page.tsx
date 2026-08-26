import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import TrackBox from "@/components/site/TrackBox";
import { DEPOT } from "@/lib/depot";
import { SITE } from "@/lib/site";
import { SITE_URL } from "@/lib/branding";

/**
 * STANDA COMMERCIAL — PAJ AKÈY PIBLIK
 * ════════════════════════════════════
 * Paj sa a se pou VIZITÈ — moun ki poko kliyan. Pa gen koneksyon.
 *
 * ⚠️ SEKIRITE: paj sa a pa li okenn done kliyan. Sèl bagay dinamik ladan l
 *    se bwat tracking la, epi li pase pa /api/track (sèvè a), pa pa Supabase.
 *
 * ⚠️ SEO: layout.tsx jeneral la di Google PA endekse anyen (zouti entèn).
 *    Isit nou ranvèse règ la POU PAJ SA A SÈLMAN. Rès sistèm nan
 *    (fakti, kliyan, dashboard) rete envizib pou Google.
 */
export const metadata: Metadata = {
  title: "STANDA COMMERCIAL — Expédition de colis USA → Haïti",
  description:
    "Recevez vos achats en ligne des États-Unis en Haïti. Adresse de dépôt gratuite à Miami, suivi de colis en temps réel et livraison dans nos agences.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/accueil" },
  keywords: [
    "standa commercial", "standa shipping", "shipping Haïti", "colis USA Haïti",
    "adresse Miami Haïti", "casillero Haïti", "envoi colis Ayiti",
    "Ouanaminthe", "Gonaïves", "Port-de-Paix"
  ],
  openGraph: {
    type: "website",
    url: "/accueil",
    siteName: "STANDA COMMERCIAL",
    locale: "fr_HT",
    title: "STANDA COMMERCIAL — Expédition de colis USA → Haïti",
    description:
      "Adresse de dépôt gratuite à Miami, suivi de colis en temps réel "
      + "et livraison dans nos agences en Haïti."
  }
};

/* Etap yo pou jwenn adrès depo a */
const STEPS = [
  {
    n: "1",
    title: "Créez votre compte",
    text: "Inscription gratuite en quelques minutes. Vous recevez immédiatement votre code client personnel — votre code MC."
  },
  {
    n: "2",
    title: "Utilisez notre adresse à Miami",
    text: "Lors de vos achats en ligne, indiquez notre adresse comme adresse de livraison, avec votre code MC sur la ligne « Adresse 2 »."
  },
  {
    n: "3",
    title: "Nous recevons et vous livrons",
    text: "Dès l'arrivée de votre colis à Miami, vous êtes notifié. Suivez chaque étape jusqu'à la disponibilité dans votre agence en Haïti."
  }
];

/* ⚠️ Lis endikatif, bazé sou règ transpò ayeryen estanda.
   STANDA COMMERCIAL dwe revize l epi ajiste l selon pwòp règ li. */
const INTERDITS = [
  "Armes à feu, munitions et pièces d'armes",
  "Explosifs, feux d'artifice et pétards",
  "Produits inflammables : essence, gaz, briquets, allumettes",
  "Aérosols et bonbonnes sous pression",
  "Produits chimiques corrosifs ou toxiques",
  "Stupéfiants et substances illégales",
  "Argent liquide, chèques au porteur, métaux précieux",
  "Animaux vivants, plantes et semences",
  "Denrées périssables et produits frais",
  "Produits contrefaits",
  "Médicaments sans ordonnance valide"
];

/*
 * DONE ESTRIKTIRE (JSON-LD)
 * ─────────────────────────
 * Yon paj wèb se tèks pou yon moun. Sa a se menm enfòmasyon an nan yon fòma
 * Google konprann dirèkteman: non biznis la, sa l fè, kote l ye, telefòn li.
 * Se sa ki fè yon konpayi parèt ak yon fich sou bò dwat rezilta rechèch yo,
 * olye yon senp lyen ble.
 */
const JSONLD = {
  "@context": "https://schema.org",
  "@type": "MovingCompany",
  name: "STANDA COMMERCIAL",
  legalName: "Standa Shipping SA",
  url: `${SITE_URL}/accueil`,
  logo: `${SITE_URL}/logo.png`,
  image: `${SITE_URL}/logo.png`,
  description:
    "Service d'expédition de colis des États-Unis vers Haïti. Adresse de dépôt "
    + "gratuite à Miami, suivi en temps réel, livraison en agence.",
  telephone: SITE.phone,
  email: SITE.email,
  areaServed: [{ "@type": "Country", name: "Haïti" }],
  address: {
    "@type": "PostalAddress",
    streetAddress: DEPOT.address1,
    addressLocality: DEPOT.city,
    addressRegion: DEPOT.state,
    postalCode: DEPOT.zip,
    addressCountry: "US"
  },
  sameAs: [`https://www.instagram.com/${SITE.instagram}`]
};

export default function AccueilPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* ══════════════ BANYÈ AKÈY ══════════════ */}
      <section className="relative bg-navy overflow-hidden">
        {/* Fon dekoratif — vèt mak la, tou dousman */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            background:
              "radial-gradient(70% 55% at 78% 8%, #16A34A 0%, transparent 62%)"
          }}
        />

        <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-14 sm:pt-16 sm:pb-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">

            {/* Tèks banyè a */}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full
                               bg-brand/15 ring-1 ring-brand/30 px-3 py-1.5
                               text-[12px] font-bold text-brand">
                <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                Miami → Haïti
              </span>

              <h1 className="mt-4 text-[30px] leading-[1.15] sm:text-[42px] sm:leading-[1.1]
                             font-black text-white tracking-tight">
                Vos achats en ligne,{" "}
                <span className="text-brand">livrés en Haïti.</span>
              </h1>

              <p className="mt-4 text-[15px] sm:text-[17px] leading-relaxed text-white/75 max-w-lg">
                Recevez une adresse de dépôt gratuite à Miami, suivez chaque
                colis en temps réel et récupérez-le dans l&apos;agence la plus
                proche de chez vous.
              </p>

              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/login?tab=signup"
                  className="inline-flex items-center justify-center h-12 px-6 rounded-xl
                             bg-brand hover:bg-brand-dark text-white font-bold text-[15px]
                             transition shadow-lift"
                >
                  Ouvrir un compte gratuit
                </Link>
                <Link
                  href="/agences"
                  className="inline-flex items-center justify-center h-12 px-6 rounded-xl
                             bg-white/10 hover:bg-white/20 ring-1 ring-white/25
                             text-white font-bold text-[15px] transition"
                >
                  Voir nos agences
                </Link>
              </div>
            </div>

            {/* Bwat tracking la */}
            <div className="lg:pl-4">
              <TrackBox />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ ADRÈS DEPO A ══════════════ */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-brand">
            Comment ça marche
          </p>
          <h2 className="mt-2 text-[24px] sm:text-[32px] font-black text-navy tracking-tight leading-tight">
            Obtenez votre adresse de dépôt
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-mute">
            Trois étapes suffisent pour commencer à faire livrer vos achats.
          </p>
        </div>

        {/* Etap yo */}
        <div className="mt-9 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n}
              className="rounded-2xl bg-mist ring-1 ring-line p-5">
              <div className="w-9 h-9 rounded-xl bg-navy text-white grid place-items-center
                              font-black text-[15px]">
                {s.n}
              </div>
              <h3 className="mt-4 font-bold text-navy text-[15px]">{s.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-mute">{s.text}</p>
            </div>
          ))}
        </div>

        {/* Tablo adrès la */}
        <div className="mt-9 rounded-2xl overflow-hidden ring-1 ring-line shadow-card">
          <div className="bg-navy px-5 py-4">
            <h3 className="text-white font-bold text-[15px]">
              Votre adresse de livraison aux États-Unis
            </h3>
            <p className="text-white/60 text-[12.5px] mt-1">
              À copier lors de vos achats en ligne
            </p>
          </div>

          <dl className="bg-white divide-y divide-line">
            <AddrRow label="Nom" value="Votre nom complet" hint />
            <AddrRow label="Adresse 1" value={DEPOT.address1} />
            <AddrRow label="Adresse 2" value="MC-#####" highlight />
            <AddrRow label="Ville" value={DEPOT.city} />
            <AddrRow label="État" value={DEPOT.state} />
            <AddrRow label="Code Postal" value={DEPOT.zip} />
            <AddrRow label="Téléphone" value={DEPOT.phone} />
          </dl>

          {/* Avètisman kòd MC a */}
          <div className="bg-amber-50 border-t border-amber-200 px-5 py-4">
            <p className="text-[13.5px] leading-relaxed text-amber-900">
              <span className="font-bold">Important — la ligne « Adresse 2 ».</span>{" "}
              Remplacez <span className="font-mono font-bold">MC-#####</span> par
              votre propre code client. Chaque colis qui arrive sans ce code ne
              peut pas être identifié ni attribué à son propriétaire.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════ KIYÈS NOU YE ══════════════ */}
      <section className="bg-mist border-y border-line">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-brand">
                Qui sommes-nous
              </p>
              <h2 className="mt-2 text-[24px] sm:text-[32px] font-black text-navy tracking-tight leading-tight">
                Un service de transport bâti pour Haïti
              </h2>
              <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-mute">
                <p>
                  STANDA COMMERCIAL S.A. accompagne les particuliers et les
                  entreprises qui achètent aux États-Unis et veulent recevoir
                  leurs colis en Haïti sans complications.
                </p>
                <p>
                  Nous prenons en charge chaque colis dès son arrivée à notre
                  dépôt de Miami : réception, pesage, expédition, dédouanement,
                  puis mise à disposition dans nos agences. À chaque étape, vous
                  savez exactement où se trouve votre colis.
                </p>
                <p>
                  Notre engagement est simple : des délais tenus, des tarifs
                  clairs annoncés à l&apos;avance, et une équipe joignable quand
                  vous avez une question.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Feature
                title="Suivi transparent"
                text="Chaque colis est traçable de Miami jusqu'à votre agence, à tout moment."
              />
              <Feature
                title="Tarifs annoncés"
                text="Le prix est calculé au poids, sans frais surprise à la livraison."
              />
              <Feature
                title="Adresse gratuite"
                text="Votre adresse de dépôt à Miami est incluse dès l'ouverture du compte."
              />
              <Feature
                title="Agences en Haïti"
                text="Retirez votre colis au point de retrait le plus proche de chez vous."
              />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ ATIK ENTÈDI ══════════════ */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-red-600">
            À savoir avant d&apos;expédier
          </p>
          <h2 className="mt-2 text-[24px] sm:text-[32px] font-black text-navy tracking-tight leading-tight">
            Articles interdits
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-mute">
            Pour des raisons de sécurité et de réglementation aérienne, les
            articles suivants ne peuvent pas être transportés. Un colis
            contenant l&apos;un de ces articles sera refusé ou détruit, sans
            remboursement.
          </p>
        </div>

        <ul className="mt-8 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {INTERDITS.map((item) => (
            <li key={item}
              className="flex items-start gap-3 rounded-xl bg-red-50/60 ring-1 ring-red-100
                         px-4 py-3.5">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
                className="text-red-500 shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="9" />
                <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
              </svg>
              <span className="text-[13.5px] leading-snug text-ink">{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-2xl bg-navy px-5 py-5 sm:px-6 sm:py-6
                        flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-[14px] leading-relaxed text-white/80">
            <span className="font-bold text-white">Un doute sur un article ?</span>{" "}
            Contactez-nous avant de passer commande. C&apos;est gratuit et cela
            évite de perdre un colis.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center h-11 px-6 rounded-xl
                       bg-brand hover:bg-brand-dark text-white font-bold text-[14px]
                       transition shrink-0"
          >
            Nous contacter
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ── Yon liy nan tablo adrès la ── */
function AddrRow({
  label, value, highlight, hint
}: { label: string; value: string; highlight?: boolean; hint?: boolean }) {
  return (
    <div className="px-5 py-3.5 flex items-start justify-between gap-4">
      <dt className="text-[13px] text-mute shrink-0">{label}</dt>
      <dd className={`text-right break-all text-[14px] font-semibold
        ${highlight ? "font-mono text-brand-dark" : hint ? "text-mute italic font-normal" : "text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}

/* ── Yon kat avantaj ── */
function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-line p-5 shadow-card">
      <div className="w-8 h-8 rounded-lg bg-brand-light grid place-items-center">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          strokeLinejoin="round" className="text-brand-dark">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h3 className="mt-3.5 font-bold text-navy text-[14.5px]">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-mute">{text}</p>
    </div>
  );
}
