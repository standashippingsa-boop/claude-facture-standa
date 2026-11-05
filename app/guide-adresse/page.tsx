import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import AddressGuide from "@/components/site/AddressGuide";

/**
 * Paj KACHE: pa nan meni sit la, pa nan sitemap, pa endekse. Admin voye
 * lyen an bay yon kliyan depi Paramètres (gid adrès SHEIN / Amazon).
 */
export const metadata: Metadata = {
  title: "Kijan pou mete adrès ou sou SHEIN ak Amazon · STANDA COMMERCIAL",
  description: "Kijan pou ranpli adrès depo nou an Miami sou SHEIN ak Amazon, kaz pa kaz.",
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
        <h1 className="text-[28px] font-extrabold leading-tight text-navy sm:text-[34px]">Kijan pou mete adrès ou sou SHEIN ak Amazon</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-600">
          Swiv kaz ki antoure yo. Ranplase <b>MC-XXXXX</b> pa pwòp kòd kliyan pa w (ou jwenn li nan espas kliyan ou, nan pati Adresse).
        </p>
        <div className="mt-8"><AddressGuide /></div>
      </main>
    </div>
  );
}
