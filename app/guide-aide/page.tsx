import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { Phone } from "@/components/icons";
import Logo from "@/components/Logo";
import AddressGuide from "@/components/site/AddressGuide";
import PublicTarifs from "@/components/site/PublicTarifs";
import { WhatsAppIcon } from "@/components/site/BrandIcons";
import { getAgences, type Agence } from "@/lib/agences";
import { DEPOT } from "@/lib/depot";
import { SUPPORT_PHONE } from "@/lib/branding";

/**
 * GID AK ÈD (paj piblik nou voye bay kliyan yo), an kreyòl ayisyen.
 * Mizanpaj « editoryal » : polis klasik (Newsreader pou tit yo, Source Sans 3
 * pou tèks la), kesyon yo ranje pa tèm, separe pa yon ti liy. Tout kesyon yo
 * FÈMEN : kliyan an peze sou youn pou l wè repons lan.
 * Done : ajans yo (modil piblik otorize) ak /api/public/tarifs.
 */
// Polices hébergées dans le projet (licence libre OFL, app/fonts) : la construction
// du site ne dépend plus de Google Fonts, qui échouait parfois.
const serif = localFont({ src: "../fonts/Newsreader-latin.woff2", weight: "200 800", display: "swap", fallback: ["Georgia", "serif"] });
const sans = localFont({ src: "../fonts/SourceSans3-latin.woff2", weight: "200 900", display: "swap", fallback: ["Arial", "sans-serif"] });

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

/** Yon kesyon ki louvri epi fèmen (san JavaScript). Fèmen pa defo. */
function Question({ id, n, title, children }: { id?: string; n: number; title: string; children: ReactNode }) {
  return (
    <details id={id} className="group scroll-mt-24 border-t border-[#d9d3c7] first:border-t-0">
      <summary className="flex min-h-14 cursor-pointer list-none items-baseline gap-4 py-4 [&::-webkit-details-marker]:hidden">
        <span className="w-7 shrink-0 text-[13px] font-semibold tabular-nums text-[#9a8f7a]">{String(n).padStart(2, "0")}</span>
        <span className={`${serif.className} flex-1 text-[19px] font-medium leading-snug text-[#14213d] group-open:text-[#0b3a7a] sm:text-[21px]`}>{title}</span>
        <span aria-hidden="true" className="relative h-4 w-4 shrink-0 self-center">
          <span className="absolute left-0 top-1/2 h-[1.5px] w-4 -translate-y-1/2 bg-[#14213d]" />
          <span className="absolute left-1/2 top-0 h-4 w-[1.5px] -translate-x-1/2 bg-[#14213d] transition-transform duration-200 group-open:scale-y-0" />
        </span>
      </summary>
      <div className="pb-7 pl-11 pr-1 text-[16px] leading-[1.7] text-[#3d4352]">{children}</div>
    </details>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="mb-1 text-[12px] font-bold uppercase tracking-[.14em] text-[#9a8f7a]">{title}</h2>
      <div className="border-y border-[#14213d]">{children}</div>
    </section>
  );
}

export default async function GuideAidePage() {
  let agences: Agence[] = [];
  try { agences = await getAgences(); } catch { agences = []; }
  let n = 0;
  const q = () => ++n;

  return (
    <div lang="ht" className={`${sans.className} min-h-screen bg-[#faf8f4] text-[#14213d]`}>
      <header className="border-b border-[#d9d3c7] bg-[#faf8f4]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/accueil" aria-label="STANDA COMMERCIAL"><Logo size={32} rounded="rounded-md" /></Link>
          <p className="flex-1 text-[14px] font-bold tracking-wide">STANDA COMMERCIAL</p>
          <Link href="/login" className="rounded-md border border-[#14213d] px-3 py-2 text-[13px] font-semibold hover:bg-[#14213d] hover:text-white">Espas mwen</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <p className="text-[12px] font-bold uppercase tracking-[.14em] text-[#9a8f7a]">Gid ak èd</p>
        <h1 className={`${serif.className} mt-2 text-[34px] font-medium leading-[1.1] sm:text-[44px]`}>Kijan nou ka ede w ?</h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-[#3d4352]">
          Byenveni lakay STANDA COMMERCIAL. Chwazi yon kesyon pi ba a epi peze sou li pou w li repons lan.
        </p>

        <div className="mt-12">
          <Section title="Pou kòmanse">
            <Question id="adresse" n={q()} title="Kijan pou m mete adrès mwen sou Amazon ak SHEIN ?">
              <p className="mb-5">Swiv kaz ki antoure yo. Ranplase <b>{CODE}</b> pa pwòp kòd kliyan pa w (ou jwenn li nan espas kliyan ou, nan pati Adresse).</p>
              <AddressGuide />
            </Question>
            <Question id="fonctionnement" n={q()} title="Kijan sa mache ?">
              <ol className="space-y-4">
                {STEPS.map(([title, text], index) => (
                  <li key={title} className="flex gap-3">
                    <span className={`${serif.className} w-6 shrink-0 text-[20px] leading-none text-[#9a8f7a]`}>{index + 1}.</span>
                    <div><p className="font-semibold text-[#14213d]">{title}</p><p className="mt-0.5">{text}</p></div>
                  </li>
                ))}
              </ol>
            </Question>
            <Question id="adresse-miami" n={q()} title="Ki adrès Miami pou m sèvi ?">
              <p>Kopye enfòmasyon sa yo egzakteman jan yo ye lè w ap achte.</p>
              <dl className="mt-3 divide-y divide-[#e6e1d6] border-y border-[#e6e1d6]">
                {([["Full Name", `Non w ${CODE}`], ["Address 1", DEPOT.address1], ["Address 2", CODE], ["City", DEPOT.city], ["State", DEPOT.state], ["ZIP Code", DEPOT.zip], ["Phone", DEPOT.phone]] as const).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3 py-2.5 text-[15px]">
                    <dt className="shrink-0 text-[#7a7466]">{key}</dt>
                    <dd className="break-all text-right font-semibold text-[#14213d]">{value}</dd>
                  </div>
                ))}
              </dl>
            </Question>
          </Section>

          <Section title="Pri ak delè">
            <Question id="prix" n={q()} title="Konbyen sa koute pou voye koli m ?">
              <PublicTarifs />
            </Question>
            <Question id="delai" n={q()} title="Konbyen tan koli m pran pou l rive ?">
              <p>Depi depo nou an Miami resevwa koli w la, li pran an jeneral <b>ant 3 ak 7 jou travay</b> pou l rive nan ajans ou an Ayiti. Samdi ak dimanch pa konte.</p>
              <p className="mt-3">Delè a ka chanje akoz ladwàn, oswa si kòd kliyan ou pa nan adrès la : lè sa a, fòk nou fè yon reklamasyon anvan nou voye koli a. Ou ka swiv chak etap nan espas kliyan ou.</p>
            </Question>
            <Question n={q()} title="Èske pri final la ka chanje ?">
              <p>Wi : kalkilatè a ba ou yon estimasyon. Pri final la se sa ki sou fakti w la, kalkile sou vrè pwa koli a nan Miami, dapre pri vil ou a. Yon atik ki gen pri espesyal (telefòn, laptop, tablèt, kamera, televizyon) oswa frè depo apre 15 jou ka chanje l. Montan an goud la kalkile ak to jou fakti a.</p>
            </Question>
          </Section>

          <Section title="Retrè koli">
            <Question id="agences" n={q()} title="Ki kote pou m al chèche koli m ?">
              <p>Ou vin chèche koli w la nan ajans ki nan vil ou a.</p>
              {agences.length === 0
                ? <p className="mt-3">Ekri STANDA sou WhatsApp pou w konnen ki ajans ki pi pre w.</p>
                : <ul className="mt-3 divide-y divide-[#e6e1d6] border-y border-[#e6e1d6]">{agences.map((agence) => (
                    <li key={agence.id ?? agence.nom} className="py-3">
                      <p className="font-semibold text-[#14213d]">{agence.nom}</p>
                      {agence.adresse && <p className="text-[15px]">{agence.adresse}</p>}
                      {agence.horaire_1 && <p className="text-[14px] text-[#7a7466]">{agence.horaire_1}{agence.horaire_2 ? `, ${agence.horaire_2}` : ""}</p>}
                    </li>
                  ))}</ul>}
            </Question>
            <Question n={q()} title="Kisa « Préparer mon retrait » vle di ?">
              <p>Lè yon koli pase « Disponible », louvri « Disponibles », make koli ou pral vin chèche yo epi peze « Préparer mon retrait ». Ajans lan ap pare koli yo anvan ou rive. Fòk ou peye fakti a anvan yo remèt ou koli a. Ou gen 15 jou pou vin chèche yon koli ki disponib ; apati 16yèm jou a, gen frè depo 5 $ US pa jou.</p>
            </Question>
            <Question n={q()} title="Èske m ka voye plizyè koli ansanm ?">
              <p>Wi. Ou ka achte nan plizyè boutik : nou resevwa epi peze chak koli apa nan Miami, epi tout koli ki gen kòd kliyan ou mete ansanm nan kont ou. Koli ki disponib an menm tan ka mete sou yon sèl fakti.</p>
            </Question>
            <Question id="domicile" n={q()} title="Èske nou vin pran koli lakay moun ?">
              <p>Non. STANDA COMMERCIAL pa vin pran koli lakay ou. Nou resevwa sèlman koli yo livre nan depo nou an Miami.</p>
              <p className="mt-3">Koli a deja nan men w Ozetazini ? Voye l nan adrès nou an Miami ak yon konpayi tankou <b>FedEx</b>, <b>UPS</b> oswa <b>USPS</b>, epi ekri adrès la ak kòd MC ou.</p>
            </Question>
          </Section>

          <Section title="Lòt kesyon">
            <Question n={q()} title="Koli m nan poko parèt : poukisa ?">
              <p>Koli w la parèt depi depo nou an Miami fin resevwa l epi anrejistre l, pa anvan. Si konpayi livrezon an di koli a « livré », tann kèk èdtan pou nou anrejistre l. Si koli a toujou pa parèt, souvan se paske kòd kliyan ou pa t nan adrès kòmand lan. Ekri STANDA sou WhatsApp ak nimewo swivi koli a pou n fè yon reklamasyon.</p>
            </Question>
            <Question id="interdits" n={q()} title="Ki atik ki entèdi ?">
              <p>Konpayi avyon yo ak ladwàn entèdi atik sa yo :</p>
              <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {INTERDITS.map((item) => <li key={item} className="border-b border-[#e6e1d6] pb-1.5 text-[#14213d]">{item}</li>)}
              </ul>
              <p className="mt-3">Se ou ki responsab sa ki nan koli w la. Si w gen dout, ekri STANDA sou WhatsApp anvan ou achte.</p>
            </Question>
            <Question n={q()} title="Mwen bliye modpas mwen.">
              <p>Ekri STANDA sou WhatsApp : n ap voye yon nouvo modpas ba ou. Konekte ak kòd kliyan ou ak modpas sa a, epi chanje l : peze non w anlè ekran an, apre sa « Changer mon mot de passe ».</p>
            </Question>
            <Question id="principes" n={q()} title="Poukisa pou m chwazi STANDA ?">
              <ul className="space-y-2">
                <li><b>Transparans.</b> Pri final la baze sou vrè pwa koli a nou peze nan depo a.</li>
                <li><b>Sekirite.</b> Nou swiv chak koli depi Miami jiskaske l rive nan ajans ou.</li>
                <li><b>Rapidite.</b> Koli yo pati pou Ayiti regilyèman.</li>
                <li><b>Toupre w.</b> Yon ekip ou ka jwenn pa telefòn ak WhatsApp.</li>
              </ul>
            </Question>
          </Section>
        </div>

        <section className="mt-14 border-t-2 border-[#14213d] pt-6">
          <h2 className={`${serif.className} text-[26px] font-medium`}>Ou gen yon lòt kesyon ?</h2>
          <p className="mt-2 text-[16px] text-[#3d4352]">Ekip STANDA a reponn ou sou WhatsApp oswa pa telefòn.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <a href={WA_LINK} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#14213d] px-5 text-[15px] font-semibold text-white hover:bg-[#0b3a7a]">
              <WhatsAppIcon size={16} /> Ekri nou sou WhatsApp
            </a>
            <a href={`tel:${WA_NUM}`} className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-[#14213d] px-5 text-[15px] font-semibold text-[#14213d] hover:bg-[#14213d] hover:text-white">
              <Phone size={15} /> {SUPPORT_PHONE}
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
