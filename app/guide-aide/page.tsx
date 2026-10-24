import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Ban, ChevronRight, Clock, HelpCircle, MapPin, Phone, ShieldCheck, Store, Truck, Calculator, PackageX } from "lucide-react";
import Logo from "@/components/Logo";
import AddressGuide from "@/components/site/AddressGuide";
import PublicTarifs from "@/components/site/PublicTarifs";
import { WhatsAppIcon } from "@/components/site/BrandIcons";
import { getAgences, type Agence } from "@/lib/agences";
import { DEPOT } from "@/lib/depot";
import { SUPPORT_PHONE } from "@/lib/branding";

/**
 * GUIDE ET AIDE — version publique de la rubrique « Guide et aide » de l'espace
 * client, à envoyer aux clients (lien dans Paramètres admin). Même contenu que
 * l'application, avec MC-XXXXX à la place du code du client, plus les prix
 * shipping par ville (compte Personnel) et la règle « pas de ramassage ».
 * Données : agences (module public autorisé) et /api/public/tarifs (liste blanche).
 */
export const metadata: Metadata = {
  title: "Guide et aide — STANDA COMMERCIAL",
  description: "Adresse SHEIN et Amazon, fonctionnement de l'expédition Miami → Haïti, délais, prix par ville, agences et questions fréquentes.",
  robots: { index: false, follow: false }
};
export const revalidate = 300;

const CODE = "MC-XXXXX";
const WA_NUM = SUPPORT_PHONE.replace(/\D/g, "");
const WA_LINK = `https://wa.me/${WA_NUM}`;

const SECTIONS = [
  { id: "adresse", label: "Adresse SHEIN / Amazon" },
  { id: "fonctionnement", label: "Comment ça marche" },
  { id: "prix", label: "Prix" },
  { id: "agences", label: "Agences" },
  { id: "interdits", label: "Articles interdits" },
  { id: "questions", label: "Questions" }
];

const STEPS = [
  ["Achetez en ligne", `Sur Amazon, SHEIN, eBay… utilisez l'adresse de notre dépôt à Miami et ajoutez votre code client (${CODE}) dans le champ « Address 2 ».`],
  ["Réception à Miami", "Notre entrepôt enregistre et pèse votre colis. Vous recevez ensuite une notification par e-mail ou WhatsApp."],
  ["Acheminement du colis", "Votre colis part de Miami vers Haïti, passe les formalités puis rejoint votre agence."],
  ["Retrait en agence", "Lorsque le statut devient « Disponible », cliquez sur « Préparer mon retrait » afin que votre colis soit prêt à votre arrivée."]
] as const;

const INTERDITS = ["Armes et munitions", "Produits inflammables", "Explosifs", "Produits corrosifs",
  "Batteries au lithium séparées", "Drogues et stupéfiants", "Contenu pornographique", "Animaux vivants",
  "Espèces", "Produits périssables"];

const FAQ = [
  ["Combien de temps prend mon colis ?",
   "Une fois votre colis reçu à notre entrepôt de Miami, comptez généralement entre 3 et 7 jours ouvrables pour qu'il arrive à votre agence en Haïti. Ce délai peut varier seulement selon la douane, ou si votre code client ne figure pas dans l'adresse du colis : une réclamation doit alors être faite avant que le colis puisse être envoyé en Haïti, ce qui prend du temps. Ouvrez le colis dans l'application pour voir son étape : Reçu à Miami, En préparation, En transit, Arrivé en Haïti, En route vers agence, puis Disponible."],
  ["Pourquoi mon colis n'apparaît-il pas encore ?",
   "Votre colis apparaît dès que notre entrepôt de Miami l'a reçu et enregistré, pas avant. Si le transporteur indique « livré », comptez quelques heures pour l'enregistrement. Si votre colis n'apparaît pas, c'est souvent que l'adresse a été mal encodée lors de l'achat ou que votre code client MC-… n'a pas été mis sur la ligne « Address 2 » : sans ce code, nous ne pouvons pas relier le colis à votre compte. Recopiez toujours exactement l'adresse de votre espace client. Dans ce cas, écrivez-nous sur WhatsApp avec votre numéro de suivi pour faire une réclamation."],
  ["Venez-vous chercher les colis à domicile ?",
   "Non. Nous ne récupérons pas les colis chez les clients. Si le colis est déjà entre vos mains et que vous voulez l'envoyer en Haïti, expédiez-le vous-même à notre adresse de Miami, Floride, avec un transporteur comme FedEx, UPS ou USPS, en écrivant l'adresse avec votre code MC."],
  ["Puis-je envoyer plusieurs colis ensemble ?",
   "Oui. Vous pouvez commander dans plusieurs boutiques : chaque colis est reçu et pesé séparément à Miami, et tous ceux qui portent votre code client sont regroupés dans votre compte. Les colis disponibles en même temps peuvent être réunis sur une seule facture."],
  ["Que signifie « Préparer mon retrait » ?",
   "Quand un colis passe au statut « Disponible », ouvrez « Disponibles », cochez les colis que vous viendrez chercher et touchez « Préparer mon retrait ». L'agence prépare alors vos colis avant votre arrivée : votre demande passe de « En attente » à « Préparé », puis à « Remis » quand vous les avez récupérés. Les factures impayées doivent être réglées à l'agence avant la remise. Vous disposez de 15 jours pour retirer un colis disponible ; à partir du 16e jour, des frais d'entreposage de 5 $ US par jour s'appliquent."],
  ["J'ai oublié mon mot de passe.",
   "Écrivez-nous sur WhatsApp : nous vous envoyons un nouveau mot de passe. Connectez-vous avec votre code client MC-XXXXX et ce mot de passe. Vous pouvez ensuite le changer : touchez votre nom en haut de l'écran, puis « Changer mon mot de passe »."],
  ["Le prix peut-il changer ?",
   "Oui : le calculateur donne une estimation. Le prix final est celui de votre facture, calculé sur le poids réel pesé à notre entrepôt de Miami, selon le tarif de votre ville. Il peut différer de l'estimation si le poids réel n'est pas celui que vous avez encodé, si le colis contient un article à tarif spécial comme un téléphone, un ordinateur portable, une tablette, une caméra ou un téléviseur, ou si des frais d'entreposage s'ajoutent pour un retrait après 15 jours. Le montant en gourdes est calculé au taux du jour de la facture."]
] as const;

function Card({ id, title, icon, children, danger = false }: { id?: string; title: string; icon: React.ReactNode; children: React.ReactNode; danger?: boolean }) {
  return (
    <section id={id} className={`scroll-mt-32 rounded-2xl border bg-white p-5 sm:p-6 ${danger ? "border-red-200" : "border-line"}`}>
      <h2 className={`flex items-center gap-2 text-[15px] font-extrabold uppercase tracking-wide ${danger ? "text-red-700" : "text-navy"}`}>{icon} {title}</h2>
      <div className="mt-3 text-[14px] leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default async function GuideAidePage() {
  let agences: Agence[] = [];
  try { agences = await getAgences(); } catch { agences = []; }

  return (
    <div className="min-h-screen bg-mist">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/accueil" aria-label="STANDA COMMERCIAL"><Logo size={36} rounded="rounded-lg" /></Link>
          <p className="flex-1 text-sm font-extrabold text-navy">Guide et aide</p>
          <Link href="/login" className="rounded-lg bg-navy px-3 py-2 text-[13px] font-bold text-white">Mon espace</Link>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6" aria-label="Sections">
          {SECTIONS.map((section) => <a key={section.id} href={`#${section.id}`} className="shrink-0 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-navy hover:bg-mist">{section.label}</a>)}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        <section id="adresse" className="scroll-mt-32 rounded-2xl border border-line bg-white p-5 sm:p-6">
          <h1 className="text-[24px] font-extrabold leading-tight text-navy sm:text-[30px]">Comment entrer mon adresse sur SHEIN et Amazon</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-600">Suivez les cases numérotées. Remplacez <b>{CODE}</b> par votre propre code client (dans votre espace client, rubrique Adresse).</p>
          <div className="mt-6"><AddressGuide /></div>
        </section>

        <Card id="fonctionnement" title="Comment fonctionne votre expédition" icon={<Truck size={16} />}>
          <ol className="space-y-3">
            {STEPS.map(([title, text], index) => (
              <li key={title} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy text-[11px] font-bold text-white">{index + 1}</span>
                <div><p className="font-bold text-ink">{title}</p><p className="mt-0.5">{text}</p></div>
              </li>
            ))}
          </ol>
        </Card>

        <section className="rounded-2xl border-2 border-accent bg-accent-light p-5 text-[14px] leading-relaxed text-navy sm:p-6">
          <p className="flex items-center gap-2 text-[16px] font-extrabold"><PackageX size={18} /> Nous ne récupérons pas les colis à domicile</p>
          <p className="mt-2">STANDA COMMERCIAL ne passe pas prendre de colis chez vous. Nous recevons uniquement les colis livrés à notre dépôt de Miami.</p>
          <p className="mt-2"><b>Le colis est déjà entre vos mains et vous voulez l&apos;envoyer en Haïti ?</b> Expédiez-le vous-même à notre adresse de Miami, Floride, avec un transporteur comme <b>FedEx</b>, <b>UPS</b> ou <b>USPS</b>. Écrivez l&apos;adresse exactement comme ci-dessous, <b>avec votre code MC</b> : à son arrivée au dépôt, le colis est enregistré sur votre compte puis envoyé vers votre agence.</p>
        </section>

        <Card title="Délai de livraison" icon={<Clock size={16} />}>
          <p>Une fois votre colis reçu à notre entrepôt de Miami, comptez généralement <b>entre 3 et 7 jours ouvrables</b> pour qu&apos;il arrive à votre agence en Haïti.</p>
          <p className="mt-2">Un <b>jour ouvrable</b> va du lundi au vendredi — les samedis et dimanches ne comptent pas dans ce délai. Un colis reçu un vendredi peut donc arriver le mardi ou mercredi suivant sans retard de notre part.</p>
          <p className="mt-2 text-[13px]">Ce délai peut varier seulement selon la douane, ou si votre code client ne figure pas dans l&apos;adresse du colis : une réclamation doit alors être faite avant que le colis puisse être envoyé en Haïti, ce qui prend du temps. Suivez chaque étape directement dans l&apos;application, sans avoir à nous contacter.</p>
        </Card>

        <Card title="Comment renseigner votre adresse" icon={<MapPin size={16} />}>
          <p>Copiez ces informations <b>exactement</b> lors de vos achats. Votre code client permet d&apos;associer le colis à votre compte.</p>
          <div className="mt-3 divide-y divide-line rounded-xl border border-line">
            {([["Full Name", `${CODE} Votre nom`], ["Address 1", DEPOT.address1], ["Address 2", CODE], ["City", DEPOT.city], ["State", DEPOT.state], ["ZIP Code", DEPOT.zip], ["Phone", DEPOT.phone]] as const).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3 px-3 py-2 text-[13px]">
                <span className="shrink-0 text-slate-500">{key}</span>
                <span className={`break-all text-right font-semibold ${key === "Address 2" || key === "Full Name" ? "text-navy" : "text-ink"}`}>{value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card id="prix" title="Comment le prix est calculé" icon={<Calculator size={16} />}>
          <PublicTarifs />
        </Card>

        <Card id="agences" title="Nos agences" icon={<Store size={16} />}>
          <p>Retirez votre colis dans le point de retrait le plus proche de vous.</p>
          {agences.length === 0
            ? <p className="mt-3">Contactez-nous sur WhatsApp pour connaître l&apos;agence la plus proche de vous.</p>
            : <div className="mt-3 divide-y divide-line">{agences.map((agence) => (
                <div key={agence.id ?? agence.nom} className="py-2.5">
                  <p className="font-bold text-ink">{agence.nom}</p>
                  <p className="mt-0.5 text-[13px]">{agence.adresse}</p>
                  {agence.horaire_1 && <p className="mt-0.5 text-[12px]">{agence.horaire_1}{agence.horaire_2 ? ` · ${agence.horaire_2}` : ""}</p>}
                </div>
              ))}</div>}
        </Card>

        <Card title="Nos principes" icon={<ShieldCheck size={16} />}>
          <ul className="space-y-2">
            <li><b>Transparence</b> — le prix final correspond toujours au poids réel pesé à l&apos;entrepôt, jamais à une estimation imposée.</li>
            <li><b>Sécurité</b> — chaque colis est suivi de sa réception à Miami jusqu&apos;à sa remise à votre agence.</li>
            <li><b>Rapidité</b> — vos colis sont acheminés régulièrement vers Haïti, sans attendre un plein chargement.</li>
            <li><b>Proximité</b> — une équipe joignable par téléphone et WhatsApp pour répondre à vos questions.</li>
          </ul>
          <a href={`tel:${WA_NUM}`} className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-line px-3 py-2.5 text-[14px] font-bold text-navy"><Phone size={15} /> {SUPPORT_PHONE}</a>
        </Card>

        <Card id="interdits" title="Articles interdits" icon={<Ban size={16} />} danger>
          <p>Les compagnies aériennes et la douane interdisent les articles suivants. Ils ne peuvent pas être expédiés :</p>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {INTERDITS.map((item) => <p key={item} className="flex gap-1.5 text-[13px] text-ink"><span className="shrink-0 text-red-500">✕</span>{item}</p>)}
          </div>
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
            <AlertTriangle size={13} className="mr-1 inline" />
            Vous êtes responsable du contenu de votre colis. Un article interdit peut être saisi par la douane sans recours. En cas de doute, contactez-nous sur WhatsApp avant votre achat.
          </p>
        </Card>

        <Card id="questions" title="Questions fréquentes" icon={<HelpCircle size={16} />}>
          <div className="divide-y divide-line">
            {FAQ.map(([question, answer]) => (
              <details key={question} className="group py-2.5">
                <summary className="flex cursor-pointer list-none items-start gap-2 font-semibold text-ink">
                  <ChevronRight size={15} className="mt-0.5 shrink-0 text-slate-400 transition-transform group-open:rotate-90" /><span>{question}</span>
                </summary>
                <p className="mt-1.5 pl-6 text-[13px]">{answer}</p>
              </details>
            ))}
          </div>
        </Card>

        <a href={WA_LINK} target="_blank" rel="noreferrer" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-[15px] font-bold text-white">
          <WhatsAppIcon size={16} /> Une question ? Écrivez-nous sur WhatsApp
        </a>
      </main>
    </div>
  );
}
