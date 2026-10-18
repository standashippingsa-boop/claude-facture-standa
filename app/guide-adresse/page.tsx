import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import AddressGuide from "@/components/site/AddressGuide";

/**
 * Paj KACHE: pa nan meni sit la, pa nan sitemap, pa endekse. Admin voye
 * lyen an bay yon kliyan depi Paramètres (gid adrès SHEIN / Amazon).
 */
export const metadata: Metadata = {
  title: "Entrer votre adresse sur SHEIN et Amazon — STANDA COMMERCIAL",
  description: "Comment remplir l'adresse de notre dépôt de Miami sur SHEIN et Amazon, case par case.",
  robots: { index: false, follow: false }
};

export default function GuideAdressePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/accueil" aria-label="STANDA COMMERCIAL"><Logo size={36} rounded="rounded-lg" /></Link>
          <p className="text-sm font-extrabold text-navy">STANDA COMMERCIAL</p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-[28px] font-extrabold leading-tight text-navy sm:text-[34px]">Entrer votre adresse sur SHEIN et Amazon</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-600">
          Suivez les cases numérotées. Remplacez <b>MC-XXXXX</b> par votre propre code client (vous le trouvez dans votre espace client, rubrique Adresse).
        </p>
        <div className="mt-8"><AddressGuide /></div>
      </main>
    </div>
  );
}
