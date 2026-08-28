"use client";
/*
 * STANDA COMMERCIAL — KREYE YON KONT  (SIT WÈB LA)
 * ════════════════════════════════════════════════
 * RÈG BIZNIS: enskripsyon fèt SOU SIT LA SÈLMAN.
 * Aplikasyon an pa gen fòm enskripsyon — bouton "Kreye yon kont" nan app la
 * louvri paj SA A nan navigatè a. App la ak sit la se de pwodwi apa ki
 * pataje MENM MOTÈ a (menm kont, menm bazdone). Anyen nan motè a pa chanje:
 * paj sa a sèvi ak MENM konpozan SignupForm la.
 *
 * DEKÒ: menm lang vizyèl ak paj koneksyon app la — gradyan anime, kat vè
 * depoli, chan ki monte youn apre lòt. Tout animasyon fèt AK CSS: zewo
 * imaj, zewo bibliyotèk, donk li chaje menm sou koneksyon fèb.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, MapPin, ShieldCheck, Truck } from "lucide-react";
import AuthBackdrop from "@/components/AuthBackdrop";
import SignupForm from "@/components/SignupForm";
import { SITE } from "@/lib/site";

const AVANTAJ = [
  { icon: MapPin, t: "Adrès Miami gratis", d: "Yon adrès depo pou ou sèl, nan minit ki vin apre a." },
  { icon: Truck, t: "Swiv chak koli", d: "Depi Miami jouk nan agans vil ou, etap pa etap." },
  { icon: Clock, t: "Notifikasyon otomatik", d: "Imèl ak WhatsApp depi yon koli rive oswa disponib." },
  { icon: ShieldCheck, t: "Done ou pwoteje", d: "Modpas chifre. Pèsonn pa ka wè l — pa menm nou." }
];

export default function InscriptionPage() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuthBackdrop />

      <div className="relative max-w-5xl mx-auto px-5 py-8 sm:py-12">

        {/* Retounen sou sit la */}
        <Link href="/accueil"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/60
                     hover:text-white transition sd-rise">
          <ArrowLeft size={15} /> Retour au site
        </Link>

        {/* Antèt */}
        <div className="text-center mt-6 mb-9">
          <div className="w-20 h-20 mx-auto rounded-[24px] bg-white grid place-items-center
                          shadow-[0_18px_50px_-14px_rgba(0,0,0,.6)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="STANDA COMMERCIAL" className="h-14 object-contain" />
          </div>
          <h1 className="text-[30px] sm:text-[38px] font-extrabold text-white mt-6 tracking-tight leading-tight sd-rise sd-d1">
            Kreye kont ou
          </h1>
          <p className="text-[15px] text-white/55 mt-2 max-w-md mx-auto leading-relaxed sd-rise sd-d2">
            Ranpli fòm nan. Ekip nou an ap aktive kont ou epi voye adrès depo
            ou Ozetazini — pa gen anyen pou peye.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.15fr] gap-6 items-start">

          {/* Avantaj yo — monte youn apre lòt */}
          <div className="space-y-3 order-2 lg:order-1">
            {AVANTAJ.map((a, i) => (
              <div key={a.t}
                className={`sd-rise sd-d${i + 2} rounded-2xl bg-white/[0.06] backdrop-blur-xl
                            border border-white/12 p-4 flex gap-3.5`}>
                <span className="w-10 h-10 rounded-xl bg-white/10 grid place-items-center shrink-0 text-indigo-200">
                  <a.icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-white leading-tight">{a.t}</p>
                  <p className="text-[12.5px] text-white/50 leading-relaxed mt-1">{a.d}</p>
                </div>
              </div>
            ))}

            <div className="sd-rise sd-d6 rounded-2xl bg-white/[0.06] border border-white/15 p-4">
              <p className="text-[12.5px] text-white/60 leading-relaxed">
                Gen yon kesyon anvan w kòmanse? Ekri nou sou WhatsApp
                {" "}<a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noreferrer"
                  className="font-bold underline underline-offset-2">{SITE.phone}</a>.
              </p>
            </div>
          </div>

          {/* Fòm nan — MENM konpozan ak menm motè */}
          <div className="order-1 lg:order-2 sd-rise sd-d3">
            <div className="rounded-[26px] bg-white/[0.07] backdrop-blur-xl border border-white/15
                            shadow-[0_28px_80px_-24px_rgba(0,0,0,.75)] p-2 sm:p-3">
              <SignupForm onGoLogin={() => router.push("/login")} />
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-white/30 mt-10">
          <Link href="/confidentialite" className="hover:text-white/60 transition">
            Politique de confidentialité
          </Link>
        </p>
      </div>
    </div>
  );
}
