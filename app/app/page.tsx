import type { Metadata } from "next";
import { Bell, Download, MapPin, PackageSearch, Settings, ShieldCheck, Smartphone } from "lucide-react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import PageHero from "@/components/site/PageHero";
import StoreBadges from "@/components/site/StoreBadges";

export const metadata: Metadata = {
  title: "Application mobile — STANDA COMMERCIAL",
  description: "Téléchargez l'application Standa pour suivre vos colis, vos factures et vos retraits directement depuis votre téléphone Android.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/app" }
};

const APK_URL = "/downloads/standa.apk";

const FEATURES = [
  { icon: PackageSearch, title: "Suivi en temps réel", text: "L'état de chaque colis, de Miami jusqu'à votre agence." },
  { icon: Bell, title: "Notifications", text: "Une alerte sur votre téléphone à chaque changement important." },
  { icon: ShieldCheck, title: "Vos factures", text: "Consultez et réglez vos factures directement dans l'app." }
];

const STEPS = [
  "Téléchargez le fichier ci-dessus depuis votre téléphone.",
  "Ouvrez-le — Android demande d'autoriser l'installation. Appuyez sur « Paramètres » puis activez « Autoriser cette source ».",
  "Revenez en arrière et appuyez sur « Installer »."
];

export default function AppPage() {
  return <div className="min-h-screen bg-[#f7f9fd] text-ink"><SiteHeader /><main>
    <PageHero
      image="/account-agent-hero.png"
      eyebrow="Application mobile Android"
      title="Standa dans votre poche."
      description="Suivez vos colis, vos factures et vos retraits — sans ouvrir votre navigateur."
      actions={
        <a href={APK_URL} download
          className="inline-flex h-14 items-center justify-center gap-2.5 rounded-xl bg-accent px-7 text-[15px] font-bold text-white shadow-[0_18px_40px_-16px_rgba(0,0,0,.6)] transition hover:-translate-y-0.5 hover:bg-accent-dark">
          <Download size={19} /> Télécharger pour Android
        </a>
      }
    >
      <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-[12px] font-semibold text-white/70">
        <span className="inline-flex items-center gap-2"><Smartphone size={16} className="text-accent" />Android 8 et plus</span>
        <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-accent" />Fichier officiel Standa</span>
      </div>
    </PageHero>

    <section className="parcel-wash relative -mt-6 px-5 sm:-mt-8 sm:px-8 lg:px-10 xl:px-6">
      <div className="mx-auto grid max-w-7xl gap-3 rounded-[1.4rem] border border-line bg-white p-3 shadow-[0_20px_48px_-32px_rgba(15,23,42,.45)] sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-center gap-3 rounded-xl px-3 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-light text-accent-dark"><Icon size={18} /></span>
            <span><span className="block text-[12px] font-bold text-navy">{title}</span><span className="block text-[12px] text-mute">{text}</span></span>
          </div>
        ))}
      </div>
    </section>

    <section className="parcel-wash-alt mx-auto max-w-5xl rounded-[2rem] px-5 py-16 sm:px-8 sm:py-24 lg:px-10 xl:px-6">
      <p className="text-[11px] font-bold uppercase tracking-[.19em] text-accent">Première installation</p>
      <h2 className="mt-4 text-balance text-[30px] font-black leading-[1.05] tracking-[-.04em] text-navy sm:text-[38px]">
        Android demande une autorisation — c&apos;est normal.
      </h2>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mute">
        L&apos;application n&apos;est pas encore sur le Play Store : Android affiche un avertissement la première fois.
        Suivez ces 3 étapes une seule fois.
      </p>
      <ol className="mt-8 grid gap-4 sm:grid-cols-3">
        {STEPS.map((text, i) => (
          <li key={i} className="rounded-2xl border border-line bg-white p-5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-navy text-[13px] font-black text-white">{i + 1}</span>
            <p className="mt-3 text-[14px] leading-relaxed text-navy">{text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex items-center gap-2 rounded-xl bg-mist px-4 py-3 text-[13px] text-mute">
        <Settings size={15} className="shrink-0 text-accent-dark" />
        Un problème d&apos;installation ? Écrivez-nous sur <a href="/contact" className="font-bold text-accent-dark hover:underline">Contact</a>.
      </div>
    </section>

    <section className="bg-navy px-5 py-12 sm:px-8 sm:py-16 lg:px-10 xl:px-6">
      <div className="mx-auto max-w-5xl text-center text-white">
        <p className="text-[11px] font-bold uppercase tracking-[.19em] text-accent">Prochainement</p>
        <h2 className="mt-3 text-balance text-[28px] font-black leading-tight sm:text-[36px]">Bientôt dans vos boutiques d&apos;applications.</h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-white/70">Téléchargez l’application depuis votre boutique officielle dès sa publication.</p>
        <StoreBadges className="mt-7 justify-center" />
      </div>
    </section>

    <section className="parcel-wash border-y border-line bg-white">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-5 py-14 text-center sm:px-8">
        <MapPin size={22} className="text-accent" />
        <p className="max-w-md text-[15px] leading-relaxed text-mute">
          Vous préférez utiliser un ordinateur ? Toutes les fonctions de l&apos;application sont aussi disponibles sur
          <a href="/login" className="font-bold text-accent-dark hover:underline"> votre espace client</a>, depuis un navigateur.
        </p>
      </div>
    </section>
  </main><SiteFooter /></div>;
}
