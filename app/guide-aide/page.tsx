import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import AddressGuide from "@/components/site/AddressGuide";
import PublicTarifs from "@/components/site/PublicTarifs";

/**
 * GUIDE ET AIDE — page publique à envoyer aux clients (lien dans Paramètres admin).
 *  1) Entrer l'adresse de Miami sur SHEIN et Amazon ;
 *  2) Comment fonctionne l'expédition ;
 *  3) Prix shipping par ville (compte Personnel).
 * Aucune donnée client : tarifs lus par /api/public/tarifs (liste blanche).
 */
export const metadata: Metadata = {
  title: "Guide et aide — STANDA COMMERCIAL",
  description: "Adresse SHEIN et Amazon, fonctionnement de l'expédition Miami → Haïti et prix par ville.",
  robots: { index: false, follow: false }
};

const STEPS = [
  { title: "Créez votre compte et recevez votre code MC", text: "L'inscription est gratuite. Votre code client personnel commence par MC : c'est lui qui permet de reconnaître vos colis." },
  { title: "Achetez avec l'adresse de Miami", text: "Sur SHEIN, Amazon, Temu… mettez l'adresse de notre dépôt à Miami, avec votre code MC (voir le guide plus haut)." },
  { title: "Réception à Miami", text: "Notre entrepôt reçoit, pèse et enregistre votre colis sur votre compte. Vous recevez une notification." },
  { title: "Voyage vers Haïti", text: "Le colis passe en préparation, en transit, arrive en Haïti puis part vers votre agence. Suivez chaque étape dans l'application." },
  { title: "Disponible à votre agence", text: "Quand le statut passe à « Disponible », votre facture apparaît dans votre espace client." },
  { title: "Payez et récupérez", text: "Présentez-vous à votre agence avec votre code client, réglez votre facture et repartez avec votre colis." }
];

const SECTIONS = [
  { id: "adresse", label: "Adresse SHEIN / Amazon" },
  { id: "fonctionnement", label: "Comment ça marche" },
  { id: "prix", label: "Prix par ville" }
];

export default function GuideAidePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/accueil" aria-label="STANDA COMMERCIAL"><Logo size={36} rounded="rounded-lg" /></Link>
          <p className="flex-1 text-sm font-extrabold text-navy">Guide et aide</p>
          <Link href="/login" className="rounded-lg bg-navy px-3 py-2 text-[13px] font-bold text-white">Mon espace</Link>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6" aria-label="Sections">
          {SECTIONS.map((section) => <a key={section.id} href={`#${section.id}`} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold text-navy hover:bg-mist">{section.label}</a>)}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-14 px-4 py-8 sm:px-6">
        <section id="adresse" className="scroll-mt-32">
          <h1 className="text-[28px] font-extrabold leading-tight text-navy sm:text-[34px]">Entrer votre adresse sur SHEIN et Amazon</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            Suivez les cases numérotées. Remplacez <b>MC-XXXXX</b> par votre propre code client (dans votre espace client, rubrique Adresse).
          </p>
          <div className="mt-8"><AddressGuide /></div>
        </section>

        <section id="fonctionnement" className="scroll-mt-32">
          <h2 className="text-[24px] font-extrabold text-navy sm:text-[28px]">Comment fonctionne l&apos;expédition</h2>
          <ol className="mt-6 grid gap-x-10 lg:grid-cols-2">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4 border-b border-line py-4">
                <p className="w-7 shrink-0 text-[24px] font-extrabold leading-none text-accent">{index + 1}</p>
                <div><h3 className="text-[16px] font-bold text-navy">{step.title}</h3><p className="mt-1 text-[15px] leading-relaxed text-slate-600">{step.text}</p></div>
              </li>
            ))}
          </ol>
          <div className="mt-6 rounded-2xl border-2 border-accent bg-accent-light p-5 text-[14px] leading-relaxed text-navy">
            <p className="text-[16px] font-extrabold">Nous ne récupérons pas les colis à domicile</p>
            <p className="mt-2">STANDA COMMERCIAL ne passe pas prendre de colis chez vous, aux États-Unis ni ailleurs. Nous recevons uniquement les colis livrés à notre dépôt de Miami.</p>
            <p className="mt-2"><b>Le colis est déjà entre vos mains et vous voulez l&apos;envoyer en Haïti ?</b> Expédiez-le vous-même à notre adresse de Miami, Floride, avec un transporteur comme <b>FedEx</b>, <b>UPS</b> ou <b>USPS</b>. Écrivez l&apos;adresse exactement comme dans le guide ci-dessus, <b>avec votre code MC</b> : à son arrivée au dépôt, le colis est enregistré sur votre compte puis envoyé vers votre agence.</p>
          </div>
          <div className="mt-4 rounded-2xl bg-mist p-5 text-[14px] leading-relaxed text-slate-700">
            <p><b>Délai :</b> une fois le colis reçu à Miami, comptez généralement <b>3 à 7 jours ouvrables</b> (lundi au vendredi) jusqu&apos;à votre agence.</p>
            <p className="mt-2">Le délai peut être plus long si la douane l&apos;exige, ou si votre code MC manque dans l&apos;adresse du colis : une réclamation est alors nécessaire avant l&apos;envoi.</p>
          </div>
        </section>

        <section id="prix" className="scroll-mt-32">
          <h2 className="text-[24px] font-extrabold text-navy sm:text-[28px]">Prix shipping par ville</h2>
          <p className="mb-5 mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-600">Le prix dépend de la ville de votre agence de retrait.</p>
          <PublicTarifs />
        </section>

        <p className="border-t border-line pt-6 text-center text-[14px] text-slate-500">
          Une question ? <Link href="/contact" className="font-bold text-navy underline-offset-4 hover:underline">Contactez-nous</Link> ·{" "}
          <Link href="/agences" className="font-bold text-navy underline-offset-4 hover:underline">Nos agences</Link>
        </p>
      </main>
    </div>
  );
}
