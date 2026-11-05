import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Ban, Calculator, ChevronRight, Clock, HelpCircle, MapPin, PackageX, Phone, ShieldCheck, Store, Truck } from "@/components/icons";
import Logo from "@/components/Logo";
import AddressGuide from "@/components/site/AddressGuide";
import PublicTarifs from "@/components/site/PublicTarifs";
import { WhatsAppIcon } from "@/components/site/BrandIcons";
import { getAgences, type Agence } from "@/lib/agences";
import { DEPOT } from "@/lib/depot";
import { SUPPORT_PHONE } from "@/lib/branding";

/**
 * GID AK ÈD (paj piblik nou voye bay kliyan yo), an kreyòl ayisyen.
 * Se souvan premye kontak yon kliyan ak STANDA : chak sijè se yon kesyon,
 * youn anba lòt ; kliyan an louvri sa ki enterese l la.
 * Done : ajans yo (modil piblik otorize) ak /api/public/tarifs.
 */
export const metadata: Metadata = {
  title: "Gid ak èd · STANDA COMMERCIAL",
  description: "Adrès Amazon ak SHEIN, kijan voye koli soti Miami pou Ayiti, delè, pri pa vil, ajans ak kesyon moun poze souvan.",
  robots: { index: false, follow: false },
};
export const revalidate = 300;

const CODE = "MC-XXXXX";
const WA_NUM = SUPPORT_PHONE.replace(/\D/g, "");
const WA_LINK = `https://wa.me/${WA_NUM}`;

const STEPS = [
  ["Achte sou entènèt", `Sou Amazon, SHEIN, eBay ak lòt boutik yo, sèvi ak adrès depo nou an Miami ansanm ak kòd kliyan ou (${CODE}) : bò kote non w sou Amazon, nan liy Apt, suite sou SHEIN.`],
  ["Nou resevwa l Miami", "Depo nou an anrejistre koli a epi li peze l. Apre sa, ou resevwa yon notifikasyon sou telefòn ou oswa pa imel."],
  ["Koli a vwayaje pou Ayiti", "Koli w la kite Miami pou Ayiti, li pase nan ladwàn, epi li rive nan ajans ou a."],
  ["Ou vin chèche l nan ajans lan", "Lè estati a vin « Disponible », peze « Préparer mon retrait » nan espas kliyan ou : koli w la ap pare lè w rive."],
] as const;

const INTERDITS = ["Zam ak bal", "Pwodui ki ka pran dife", "Eksplozif", "Pwodui ki ka boule (asid)",
  "Batri lityòm ki pou kont yo", "Dwòg", "Bagay pònografi", "Bèt vivan",
  "Lajan kach", "Manje ki ka gate"];

const FAQ: Array<[string, string]> = [
  ["Koli m nan poko parèt : poukisa ?",
   "Koli w la parèt depi depo nou an Miami fin resevwa l epi anrejistre l, pa anvan. Si konpayi livrezon an di koli a « livré », tann kèk èdtan pou nou anrejistre l. Si koli a toujou pa parèt, souvan se paske kòd kliyan ou pa t nan adrès kòmand lan. Ekri STANDA sou WhatsApp ak nimewo swivi koli a pou n fè yon reklamasyon."],
  ["Èske m ka voye plizyè koli ansanm ?",
   "Wi. Ou ka achte nan plizyè boutik : nou resevwa epi peze chak koli apa nan Miami, epi tout koli ki gen kòd kliyan ou mete ansanm nan kont ou. Koli ki disponib an menm tan ka mete sou yon sèl fakti."],
  ["Kisa « Préparer mon retrait » vle di ?",
   "Lè yon koli pase « Disponible », louvri « Disponibles », make koli ou pral vin chèche yo epi peze « Préparer mon retrait ». Ajans lan ap pare koli yo anvan ou rive. Fòk ou peye fakti a anvan yo remèt ou koli a. Ou gen 15 jou pou vin chèche yon koli ki disponib ; apati 16yèm jou a, gen frè depo 5 $ US pa jou."],
  ["Mwen bliye modpas mwen.",
   "Ekri STANDA sou WhatsApp : n ap voye yon nouvo modpas ba ou. Konekte ak kòd kliyan ou ak modpas sa a, epi chanje l : peze non w anlè ekran an, apre sa « Changer mon mot de passe »."],
  ["Èske pri final la ka chanje ?",
   "Wi : kalkilatè a ba ou yon estimasyon. Pri final la se sa ki sou fakti w la, kalkile sou vrè pwa koli a nan Miami, dapre pri vil ou a. Yon atik ki gen pri espesyal (telefòn, laptop, tablèt, kamera, televizyon) oswa frè depo apre 15 jou ka chanje l. Montan an goud la kalkile ak to jou fakti a."],
];

/** Yon kesyon ki louvri epi fèmen (san JavaScript). */
function Question({ id, icon, title, open, children }: { id?: string; icon: ReactNode; title: string; open?: boolean; children: ReactNode }) {
  return (
    <details id={id} open={open} className="group scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition open:shadow-md">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy/5 text-navy">{icon}</span>
        <span className="flex-1 text-[15.5px] font-bold leading-snug text-navy sm:text-[16.5px]">{title}</span>
        <ChevronRight size={18} className="shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-90" />
      </summary>
      <div className="border-t border-line px-4 pb-5 pt-4 text-[14px] leading-relaxed text-slate-600 sm:px-5">{children}</div>
    </details>
  );
}

export default async function GuideAidePage() {
  let agences: Agence[] = [];
  try { agences = await getAgences(); } catch { agences = []; }

  return (
    <div lang="ht" className="min-h-screen bg-mist">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/accueil" aria-label="STANDA COMMERCIAL"><Logo size={34} rounded="rounded-lg" /></Link>
          <p className="flex-1 text-sm font-extrabold text-navy">Gid ak èd</p>
          <Link href="/login" className="rounded-lg bg-navy px-3 py-2 text-[13px] font-bold text-white">Espas mwen</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-12 pt-8 sm:px-6">
        <div className="text-center">
          <h1 className="text-[26px] font-extrabold leading-tight text-navy sm:text-[32px]">Kijan nou ka ede w ?</h1>
          <p className="mx-auto mt-2 max-w-xl text-[14.5px] leading-relaxed text-slate-600">Byenveni lakay STANDA COMMERCIAL. Peze yon kesyon pou w wè repons lan.</p>
        </div>

        <div className="mt-8 space-y-3">
          <Question id="adresse" open icon={<MapPin size={19} />} title="Kijan pou m mete adrès mwen sou Amazon ak SHEIN ?">
            <p className="mb-5">Swiv kaz ki antoure yo. Ranplase <b>{CODE}</b> pa pwòp kòd kliyan pa w (ou jwenn li nan espas kliyan ou, nan pati Adresse).</p>
            <AddressGuide />
          </Question>

          <Question id="fonctionnement" icon={<Truck size={19} />} title="Kijan sa mache ?">
            <ol className="space-y-4">
              {STEPS.map(([title, text], index) => (
                <li key={title} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy text-[12px] font-bold text-white">{index + 1}</span>
                  <div><p className="font-bold text-ink">{title}</p><p className="mt-0.5">{text}</p></div>
                </li>
              ))}
            </ol>
          </Question>

          <Question id="adresse-miami" icon={<MapPin size={19} />} title="Ki adrès Miami pou m sèvi ?">
            <p>Kopye enfòmasyon sa yo egzakteman jan yo ye lè w ap achte.</p>
            <div className="mt-3 divide-y divide-line rounded-xl border border-line">
              {([["Full Name", `Non w ${CODE}`], ["Address 1", DEPOT.address1], ["Address 2", CODE], ["City", DEPOT.city], ["State", DEPOT.state], ["ZIP Code", DEPOT.zip], ["Phone", DEPOT.phone]] as const).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3 px-3 py-2.5 text-[13.5px]">
                  <span className="shrink-0 text-slate-500">{key}</span>
                  <span className="break-all text-right font-semibold text-ink">{value}</span>
                </div>
              ))}
            </div>
          </Question>

          <Question id="prix" icon={<Calculator size={19} />} title="Konbyen sa koute pou voye koli m ?">
            <PublicTarifs />
          </Question>

          <Question id="agences" icon={<Store size={19} />} title="Ki kote pou m al chèche koli m ?">
            <p>Ou vin chèche koli w la nan ajans ki nan vil ou a.</p>
            {agences.length === 0
              ? <p className="mt-3">Ekri STANDA sou WhatsApp pou w konnen ki ajans ki pi pre w.</p>
              : <div className="mt-3 grid gap-2 sm:grid-cols-2">{agences.map((agence) => (
                  <div key={agence.id ?? agence.nom} className="rounded-xl border border-line px-3 py-2.5">
                    <p className="font-bold text-ink">{agence.nom}</p>
                    {agence.adresse && <p className="mt-0.5 text-[13px]">{agence.adresse}</p>}
                    {agence.horaire_1 && <p className="mt-0.5 text-[12px] text-slate-500">{agence.horaire_1}{agence.horaire_2 ? `, ${agence.horaire_2}` : ""}</p>}
                  </div>
                ))}</div>}
          </Question>

          <Question id="delai" icon={<Clock size={19} />} title="Konbyen tan koli m pran pou l rive ?">
            <p>Depi depo nou an Miami resevwa koli w la, li pran an jeneral <b>ant 3 ak 7 jou travay</b> pou l rive nan ajans ou an Ayiti. Samdi ak dimanch pa konte.</p>
            <p className="mt-2">Delè a ka chanje akoz ladwàn, oswa si kòd kliyan ou pa nan adrès la : lè sa a, fòk nou fè yon reklamasyon anvan nou voye koli a. Ou ka swiv chak etap nan espas kliyan ou.</p>
          </Question>

          <Question id="domicile" icon={<PackageX size={19} />} title="Èske nou vin pran koli lakay moun ?">
            <p>Non. STANDA COMMERCIAL pa vin pran koli lakay ou. Nou resevwa sèlman koli yo livre nan depo nou an Miami.</p>
            <p className="mt-2">Koli a deja nan men w Ozetazini ? Voye l nan adrès nou an Miami ak yon konpayi tankou <b>FedEx</b>, <b>UPS</b> oswa <b>USPS</b>, epi ekri adrès la ak kòd MC ou.</p>
          </Question>

          <Question id="interdits" icon={<Ban size={19} />} title="Ki atik ki entèdi ?">
            <p>Konpayi avyon yo ak ladwàn entèdi atik sa yo :</p>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13.5px] text-ink">
              {INTERDITS.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p className="mt-3 text-[13px]">Se ou ki responsab sa ki nan koli w la. Si w gen dout, ekri STANDA sou WhatsApp anvan ou achte.</p>
          </Question>

          <Question id="principes" icon={<ShieldCheck size={19} />} title="Poukisa pou m chwazi STANDA ?">
            <ul className="space-y-2">
              <li><b>Transparans</b> : pri final la baze sou vrè pwa koli a nou peze nan depo a.</li>
              <li><b>Sekirite</b> : nou swiv chak koli depi Miami jiskaske l rive nan ajans ou.</li>
              <li><b>Rapidite</b> : koli yo pati pou Ayiti regilyèman.</li>
              <li><b>Toupre w</b> : yon ekip ou ka jwenn pa telefòn ak WhatsApp.</li>
            </ul>
            <a href={`tel:${WA_NUM}`} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-[14px] font-bold text-navy"><Phone size={15} /> {SUPPORT_PHONE}</a>
          </Question>

          {FAQ.map(([question, answer]) => (
            <Question key={question} icon={<HelpCircle size={19} />} title={question}>
              <p>{answer}</p>
            </Question>
          ))}
        </div>

        <a href={WA_LINK} target="_blank" rel="noreferrer" className="mt-8 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-[15px] font-bold text-white">
          <WhatsAppIcon size={16} /> Ou gen yon lòt kesyon ? Ekri STANDA sou WhatsApp
        </a>
      </main>
    </div>
  );
}
