import type { ReactNode } from "react";

type PageHeroProps = {
  image: string;
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children?: ReactNode;
};

/** Hero visuel partage par les pages publiques : texte lisible a gauche, equipe STANDA a droite. */
export default function PageHero({ image, eyebrow, title, description, actions, children }: PageHeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-navy">
      {/* L'image est décorative : une balise img évite le chargeur d'images dynamique qui échouait sur cette page. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-center" />
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,18,38,.98)_0%,rgba(7,18,38,.93)_44%,rgba(7,18,38,.52)_100%)]" />
      <div aria-hidden="true" className="site-grid absolute inset-0 opacity-[0.11]" />
      <div aria-hidden="true" className="absolute -left-28 -bottom-40 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10 xl:px-6">
        <div className="max-w-2xl site-fade">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/85 backdrop-blur-sm"><span className="h-1.5 w-1.5 rounded-full bg-accent" />{eyebrow}</p>
          <h1 className="mt-6 max-w-xl text-balance text-[40px] font-black leading-[.99] tracking-[-.055em] text-white sm:text-[56px]">{title}</h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/72 sm:text-[18px]">{description}</p>
          {actions && <div className="mt-8 flex flex-col gap-3 sm:flex-row">{actions}</div>}
          {children}
        </div>
      </div>
    </section>
  );
}
