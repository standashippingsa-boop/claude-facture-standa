"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, PackageCheck, ShieldCheck } from "lucide-react";
import SignupForm from "@/components/SignupForm";
import Logo from "@/components/Logo";
import AuthBackdrop from "@/components/site/AuthBackdrop";
import { WhatsAppIcon } from "@/components/site/BrandIcons";
import { SITE } from "@/lib/site";

const REASSURANCES = [
  { icon: MapPin, label: "Adresse à Miami" },
  { icon: PackageCheck, label: "Suivi de colis" },
  { icon: ShieldCheck, label: "Données protégées" }
];

export default function InscriptionPage() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#061937] text-white">
      <AuthBackdrop />
      <div className="relative mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
        <header className="flex items-center justify-between gap-4">
          <Link href="/accueil" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/75 transition hover:text-white">
            <ArrowLeft size={15} /> Retour au site
          </Link>
          <div className="inline-flex items-center gap-2.5">
            <Logo size={38} rounded="rounded-xl" />
            <span className="leading-none"><b className="block text-[13px] tracking-[.08em]">STANDA</b><span className="block mt-1 text-[8px] font-bold tracking-[.2em] text-accent">COMMERCIAL</span></span>
          </div>
        </header>

        <main className="mx-auto mt-10 max-w-4xl pb-10 sm:mt-14 lg:mt-16 lg:pb-14">
          <section className="relative rounded-[2rem] border border-white/40 bg-white/[.13] px-3 pb-3 pt-14 shadow-[0_32px_90px_-35px_rgba(0,0,0,.8)] backdrop-blur-2xl sm:px-5 sm:pb-5">
            <div className="absolute left-1/2 top-0 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[5px] border-[#dbeafa] bg-navy shadow-[0_15px_35px_-10px_rgba(0,0,0,.65)]">
              <Logo size={56} rounded="rounded-xl" />
            </div>
            <div className="px-3 pb-5 text-center sm:px-5">
              <p className="text-[11px] font-bold uppercase tracking-[.18em] text-orange-200">Inscription gratuite</p>
              <h1 className="mt-3 text-balance text-[31px] font-black leading-[1.04] tracking-[-.04em] text-white sm:text-[42px]">Créez votre compte</h1>
              <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-white/75 sm:text-[15px]">Remplissez vos informations. Notre équipe préparera votre adresse de dépôt à Miami et votre code client.</p>
            </div>
            <SignupForm onGoLogin={() => router.push("/login")} />
          </section>

          <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
            {REASSURANCES.map(({ icon: Icon, label }) => <div key={label} className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-navy/35 px-3 py-3 text-[12px] font-semibold text-white/80 backdrop-blur-md"><Icon size={16} className="text-orange-300" />{label}</div>)}
          </div>

          <p className="mt-6 text-center text-[12px] leading-relaxed text-white/65">Une question ? <a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-white underline underline-offset-2"><WhatsAppIcon size={15} />Écrivez-nous sur WhatsApp</a>.</p>
          <p className="mt-4 text-center text-[11px] text-white/45"><Link href="/confidentialite" className="transition hover:text-white/80">Politique de confidentialité</Link></p>
        </main>
      </div>
    </div>
  );
}
