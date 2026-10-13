import type { ReactNode } from "react";

type PageHeroProps = {
  image: string;
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children?: ReactNode;
};

/** Hero partagé par les pages publiques : texte lisible à gauche, équipe STANDA à droite. */
export default function PageHero({ image, eyebrow, title, description, actions, children }: PageHeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-navy">
      {/* L'image est décorative : une balise img évite le chargeur d'images dynamique qui échouait sur cette page. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-contain object-center sm:object-cover" />
      {/* Voile sombre : uniquement pour la lisibilité du texte sur la photo. */}
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,18,38,.98)_0%,rgba(7,18,38,.93)_44%,rgba(7,18,38,.52)_100%)]" />
      <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-10 xl:px-6">
        <div className="max-w-2xl">
          <p className="text-[14px] font-semibold text-accent">{eyebrow}</p>
          <h1 className="mt-3 max-w-xl text-[34px] font-extrabold leading-[1.1] tracking-tight text-white sm:text-[46px]">{title}</h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-white/80 sm:text-[17px]">{description}</p>
          {actions && <div className="mt-7 flex flex-col gap-3 sm:flex-row">{actions}</div>}
          {children}
        </div>
      </div>
    </section>
  );
}
