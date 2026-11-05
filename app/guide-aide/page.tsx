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
 * GUIDE ET AIDE (page publique envoyée aux clients).
 * Souvent le premier contact d'un client avec STANDA : chaque sujet est une
 * question, les unes sous les autres ; on ouvre celle qui nous intéresse.
 * Données : agences (module public autorisé) et /api/public/tarifs.
 */
export const metadata: Metadata = {
  title: "Guide et aide · STANDA COMMERCIAL",
  description: "Adresse Amazon et SHEIN, fonctionnement de l'expédition Miami vers Haïti, délais, prix par ville, agences et questions fréquentes.",
  robots: { index: false, follow: false },
};
export const revalidate = 300;

const CODE = "MC-XXXXX";
const WA_NUM = SUPPORT_PHONE.replace(/\D/g, "");
const WA_LINK = `https://wa.me/${WA_NUM}`;

const STEPS = [
  ["Achetez en ligne", `Sur Amazon, SHEIN, eBay et les autres boutiques, utilisez l'adresse de notre dépôt à Miami avec votre code client (${CODE}) : à côté de votre nom sur Amazon, à la ligne Apt, suite sur SHEIN.`],
  ["Réception à Miami", "Notre entrepôt enregistre et pèse votre colis. Vous recevez ensuite une notification sur votre téléphone ou par courriel."],
  ["Acheminement vers Haïti", "Votre colis part de Miami vers Haïti, passe les formalités puis rejoint votre agence."],
  ["Retrait en agence", "Quand le statut devient « Disponible », touchez « Préparer mon retrait » dans votre espace client : votre colis sera prêt à votre arrivée."],
] as const;

const INTERDITS = ["Armes et munitions", "Produits inflammables", "Explosifs", "Produits corrosifs",
  "Batteries au lithium séparées", "Drogues et stupéfiants", "Contenu pornographique", "Animaux vivants",
  "Argent liquide", "Produits périssables"];

const FAQ: Array<[string, string]> = [
  ["Mon colis n'apparaît pas encore : pourquoi ?",
   "Votre colis apparaît dès que notre entrepôt de Miami l'a reçu et enregistré, pas avant. Si le transporteur indique « livré », comptez quelques heures pour l'enregistrement. Si le colis n'apparaît toujours pas, c'est souvent que votre code client n'était pas dans l'adresse de la commande. Écrivez à STANDA sur WhatsApp avec votre numéro de suivi pour faire une réclamation."],
  ["Envoyer plusieurs colis ensemble, c'est possible ?",
   "Oui. Vous pouvez commander dans plusieurs boutiques : chaque colis est reçu et pesé séparément à Miami, et tous ceux qui portent votre code client sont regroupés dans votre compte. Les colis disponibles en même temps peuvent être réunis sur une seule facture."],
  ["Que signifie « Préparer mon retrait » ?",
   "Quand un colis passe au statut « Disponible », ouvrez « Disponibles », cochez les colis que vous viendrez chercher et touchez « Préparer mon retrait ». L'agence prépare vos colis avant votre arrivée. La facture doit être payée avant la remise. Vous avez 15 jours pour retirer un colis disponible ; à partir du 16e jour, des frais d'entreposage de 5 $ US par jour s'appliquent."],
  ["J'ai oublié mon mot de passe.",
   "Écrivez à STANDA sur WhatsApp : nous vous envoyons un nouveau mot de passe. Connectez vous avec votre code client et ce mot de passe, puis changez le depuis votre nom en haut de l'écran, « Changer mon mot de passe »."],
  ["Le prix final peut varier ?",
   "Oui : le calculateur donne une estimation. Le prix final est celui de votre facture, calculé sur le poids réel pesé à Miami, selon le tarif de votre ville. Un article à tarif spécial (téléphone, ordinateur portable, tablette, caméra, téléviseur) ou des frais d'entreposage après 15 jours peuvent le changer. Le montant en gourdes est calculé au taux du jour de la facture."],
];

/** Une question qui s'ouvre et se referme (sans JavaScript). */
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
    <div className="min-h-screen bg-mist">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/accueil" aria-label="STANDA COMMERCIAL"><Logo size={34} rounded="rounded-lg" /></Link>
          <p className="flex-1 text-sm font-extrabold text-navy">Guide et aide</p>
          <Link href="/login" className="rounded-lg bg-navy px-3 py-2 text-[13px] font-bold text-white">Mon espace</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-12 pt-8 sm:px-6">
        <div className="text-center">
          <h1 className="text-[26px] font-extrabold leading-tight text-navy sm:text-[32px]">Comment pouvons nous vous aider ?</h1>
          <p className="mx-auto mt-2 max-w-xl text-[14.5px] leading-relaxed text-slate-600">Bienvenue chez STANDA COMMERCIAL. Touchez une question pour voir la réponse.</p>
        </div>

        <div className="mt-8 space-y-3">
          <Question id="adresse" open icon={<MapPin size={19} />} title="Comment entrer mon adresse sur Amazon et SHEIN ?">
            <p className="mb-5">Suivez les cases entourées. Remplacez <b>{CODE}</b> par votre propre code client (dans votre espace client, rubrique Adresse).</p>
            <AddressGuide />
          </Question>

          <Question id="fonctionnement" icon={<Truck size={19} />} title="Comment ça marche ?">
            <ol className="space-y-4">
              {STEPS.map(([title, text], index) => (
                <li key={title} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy text-[12px] font-bold text-white">{index + 1}</span>
                  <div><p className="font-bold text-ink">{title}</p><p className="mt-0.5">{text}</p></div>
                </li>
              ))}
            </ol>
          </Question>

          <Question id="adresse-miami" icon={<MapPin size={19} />} title="Quelle est l'adresse de Miami à utiliser ?">
            <p>Copiez ces informations exactement lors de vos achats.</p>
            <div className="mt-3 divide-y divide-line rounded-xl border border-line">
              {([["Full Name", `Votre nom ${CODE}`], ["Address 1", DEPOT.address1], ["Address 2", CODE], ["City", DEPOT.city], ["State", DEPOT.state], ["ZIP Code", DEPOT.zip], ["Phone", DEPOT.phone]] as const).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3 px-3 py-2.5 text-[13.5px]">
                  <span className="shrink-0 text-slate-500">{key}</span>
                  <span className="break-all text-right font-semibold text-ink">{value}</span>
                </div>
              ))}
            </div>
          </Question>

          <Question id="prix" icon={<Calculator size={19} />} title="Combien coûte l'envoi de mon colis ?">
            <PublicTarifs />
          </Question>

          <Question id="agences" icon={<Store size={19} />} title="Où récupérer mon colis ?">
            <p>Retirez votre colis dans l&apos;agence de votre ville.</p>
            {agences.length === 0
              ? <p className="mt-3">Écrivez à STANDA sur WhatsApp pour connaître l&apos;agence la plus proche de vous.</p>
              : <div className="mt-3 grid gap-2 sm:grid-cols-2">{agences.map((agence) => (
                  <div key={agence.id ?? agence.nom} className="rounded-xl border border-line px-3 py-2.5">
                    <p className="font-bold text-ink">{agence.nom}</p>
                    {agence.adresse && <p className="mt-0.5 text-[13px]">{agence.adresse}</p>}
                    {agence.horaire_1 && <p className="mt-0.5 text-[12px] text-slate-500">{agence.horaire_1}{agence.horaire_2 ? `, ${agence.horaire_2}` : ""}</p>}
                  </div>
                ))}</div>}
          </Question>

          <Question id="delai" icon={<Clock size={19} />} title="Combien de temps prend mon colis ?">
            <p>Une fois votre colis reçu à notre entrepôt de Miami, comptez généralement <b>entre 3 et 7 jours ouvrables</b> pour qu&apos;il arrive à votre agence en Haïti. Les samedis et dimanches ne comptent pas.</p>
            <p className="mt-2">Le délai peut changer selon la douane, ou si votre code client ne figure pas dans l&apos;adresse : une réclamation est alors nécessaire avant l&apos;envoi. Suivez chaque étape dans votre espace client.</p>
          </Question>

          <Question id="domicile" icon={<PackageX size={19} />} title="Venez vous chercher les colis à domicile ?">
            <p>Non. STANDA COMMERCIAL ne passe pas prendre de colis chez vous. Nous recevons uniquement les colis livrés à notre dépôt de Miami.</p>
            <p className="mt-2">Le colis est déjà entre vos mains aux USA ? Envoyez le à notre adresse de Miami avec un transporteur comme <b>FedEx</b>, <b>UPS</b> ou <b>USPS</b>, en écrivant l&apos;adresse avec votre code MC.</p>
          </Question>

          <Question id="interdits" icon={<Ban size={19} />} title="Quels articles sont interdits ?">
            <p>Les compagnies aériennes et la douane interdisent ces articles :</p>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13.5px] text-ink">
              {INTERDITS.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p className="mt-3 text-[13px]">Vous êtes responsable du contenu de votre colis. En cas de doute, écrivez à STANDA sur WhatsApp avant votre achat.</p>
          </Question>

          <Question id="principes" icon={<ShieldCheck size={19} />} title="Pourquoi choisir STANDA ?">
            <ul className="space-y-2">
              <li><b>Transparence</b> : le prix final correspond au poids réel pesé à l&apos;entrepôt.</li>
              <li><b>Sécurité</b> : chaque colis est suivi de Miami jusqu&apos;à votre agence.</li>
              <li><b>Rapidité</b> : vos colis partent régulièrement vers Haïti.</li>
              <li><b>Proximité</b> : une équipe joignable par téléphone et WhatsApp.</li>
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
          <WhatsAppIcon size={16} /> Une autre question ? Écrivez à STANDA sur WhatsApp
        </a>
      </main>
    </div>
  );
}
