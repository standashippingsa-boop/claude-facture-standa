import { PackageCheck } from "lucide-react";

/** Décor commun des pages d'authentification publiques. */
export default function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_13%_12%,rgba(91,168,244,.34),transparent_31%),radial-gradient(circle_at_84%_72%,rgba(38,195,220,.25),transparent_27%),linear-gradient(135deg,#061937_0%,#0a3265_48%,#061937_100%)]" />
      <div className="absolute -left-36 top-[17%] h-[31rem] w-[31rem] rounded-full border border-orange-200/30 bg-[radial-gradient(circle_at_72%_35%,rgba(255,176,95,.88),rgba(230,101,10,.2)_42%,transparent_68%)] blur-[2px]" />
      <div className="absolute -right-44 bottom-[-9rem] h-[33rem] w-[33rem] rounded-full border border-cyan-100/25 bg-[radial-gradient(circle_at_35%_38%,rgba(152,236,255,.7),rgba(41,165,211,.17)_45%,transparent_68%)] blur-[2px]" />
      <div className="site-grid absolute inset-0 opacity-[.07]" />
      <svg className="absolute inset-0 h-full w-full opacity-[.18]" viewBox="0 0 1440 900" fill="none" preserveAspectRatio="none">
        <path d="M-40 200C190 75 250 390 475 282c177-85 119-245 347-198 182 38 149 220 386 102 102-51 159-36 267 15" stroke="rgba(255,255,255,.48)" strokeWidth="2" strokeDasharray="7 13" />
        <path d="M-10 680c140-145 291 52 431-82 123-117 48-200 284-221 226-20 208 224 426 177 110-24 175-108 352-21" stroke="rgba(255,255,255,.38)" strokeWidth="2" strokeDasharray="7 13" />
        <circle cx="223" cy="280" r="12" fill="rgba(255,255,255,.42)" />
        <circle cx="1028" cy="183" r="12" fill="rgba(255,255,255,.35)" />
        <circle cx="1190" cy="536" r="12" fill="rgba(255,255,255,.32)" />
      </svg>
      <PackageCheck className="absolute bottom-14 left-[9%] h-16 w-16 rotate-[-18deg] text-white/[.09]" strokeWidth={1} />
      <PackageCheck className="absolute right-[10%] top-[16%] h-14 w-14 rotate-[18deg] text-white/[.10]" strokeWidth={1} />
    </div>
  );
}
