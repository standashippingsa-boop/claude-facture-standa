"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "@getpapillon/papicons";
import SignupForm from "@/components/SignupForm";
import Logo from "@/components/Logo";
import { WhatsAppIcon } from "@/components/site/BrandIcons";
import { SITE } from "@/lib/site";

export default function InscriptionPage() {
  const router = useRouter();

  return (
    <div className="login-compact login-client site-font min-h-screen bg-[#eef2f8] text-navy">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link href="/accueil" className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium text-navy/80 shadow-[0_1px_2px_rgba(0,0,0,.05)] transition hover:text-navy">
            <ArrowLeft size={15} /> Retour au site
          </Link>
          <Link href="/accueil" className="inline-flex items-center gap-2.5">
            <Logo size={34} />
            <span className="leading-none"><b className="block text-[14px] font-extrabold tracking-tight">STANDA</b><span className="mt-0.5 block text-[9px] font-semibold tracking-[.2em] text-mute">COMMERCIAL</span></span>
          </Link>
        </header>

        <main className="mx-auto mt-10 max-w-3xl pb-10 sm:mt-14">
          <div className="text-center">
            <p className="text-[12px] font-medium tracking-[0.14em] text-accent-dark">INSCRIPTION GRATUITE</p>
            <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[48px]">Créez votre compte <span className="text-accent">en 2 minutes</span></h1>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-navy/65">Remplissez vos informations. Notre équipe préparera votre adresse de dépôt à Miami et votre code client MC.</p>
          </div>

          <section className="mt-8 rounded-[28px] bg-white p-3 sm:p-5">
            <SignupForm onGoLogin={() => router.push("/login")} />
          </section>


          <p className="mt-6 text-center text-[13px] leading-relaxed text-navy/60">Une question ? <a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-navy underline underline-offset-2"><WhatsAppIcon size={15} />Écrivez à STANDA sur WhatsApp</a>.</p>
          <p className="mt-4 text-center text-[12px] text-accent"><Link href="/confidentialite" className="transition hover:text-navy/80">Politique de confidentialité</Link></p>
        </main>
      </div>
    </div>
  );
}
