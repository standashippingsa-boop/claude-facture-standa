import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCircle2, CircleDollarSign, FileText, Package, ScanLine, ShieldCheck, Truck, Users } from "lucide-react";

export type GuideRole = "admin" | "employe" | "agent_retrait";

type GuideSection = {
  title: string;
  description: string;
  icon: typeof Package;
  steps: string[];
};

const content: Record<GuideRole, { label: string; introduction: string; sections: GuideSection[]; reminders: string[] }> = {
  admin: {
    label: "Administrateur",
    introduction: "Ce guide vous aide à gérer les colis, les factures, les agences et les accès sans perdre le suivi entre les différents espaces.",
    sections: [
      { title: "1. Ajouter et suivre les colis", description: "Chaque colis ajouté se synchronise avec les dossiers clients, l’équipe et le point de retrait concerné.", icon: Package, steps: ["Ajoutez ou importez les colis depuis Packages ou Synchronisation.", "Vérifiez le code client, le tracking, la ville de retrait et le statut.", "Utilisez les filtres avant de créer un conduce, un bon de remise ou une facture."] },
      { title: "2. Conduces et disponibilité", description: "Un conduce permet de regrouper les colis arrivés en Haïti et de les orienter vers une agence.", icon: Truck, steps: ["Créez ou ouvrez le folder du conduce, puis ajoutez les colis correspondants.", "Dans le folder, choisissez la ville lorsque les colis deviennent disponibles.", "Le même statut devient visible pour le client, l’administration, les employés et l’agence."] },
      { title: "3. Factures et paiements", description: "Les montants envoyés au client sont la référence de paiement pour l’agence.", icon: CircleDollarSign, steps: ["Sélectionnez les colis disponibles, puis générez la facture.", "Pour un colis spécial, saisissez le prix demandé avant de finaliser.", "Enregistrez le moyen de paiement; les paiements partiels restent comme solde client."] },
      { title: "4. Contrôle des accès", description: "Les comptes, tarifs, agences et paramètres restent réservés à l’administration.", icon: Users, steps: ["Créez les comptes employés et les comptes d’agents de retrait dans Paramètres.", "Associez chaque agent à sa ville de retrait.", "Consultez les rapports et les soldes avant toute réconciliation."] }
    ],
    reminders: ["Ne modifiez jamais un colis livré : il est conservé dans l’historique.", "Un bon de remise et sa ville doivent toujours correspondre.", "Les prix d’un colis spécial sont saisis manuellement et passent dans la facture client."]
  },
  employe: {
    label: "Employé",
    introduction: "Ce guide présente le travail quotidien : organiser les colis, préparer les factures et maintenir des informations exactes pour les clients.",
    sections: [
      { title: "1. Vérifier les colis", description: "Travaillez toujours à partir d’un filtre ou d’une recherche pour éviter de modifier le mauvais colis.", icon: ScanLine, steps: ["Recherchez par code client, tracking ou statut.", "Contrôlez la ville, la quantité et le contenu avant de confirmer une opération.", "Signalez toute anomalie de tracking ou de note spéciale à l’administrateur."] },
      { title: "2. Préparer le transport", description: "Les conduces permettent de garder le contrôle des colis avant leur disponibilité en agence.", icon: Truck, steps: ["Ajoutez les colis au bon conduce.", "Gardez les colis spéciaux avec leur note et leur étoile.", "Ne mélangez pas les villes lorsque vous préparez un bon de remise."] },
      { title: "3. Préparer une facture", description: "Une facture ne contient que les colis sélectionnés pour le client.", icon: FileText, steps: ["Vérifiez les colis facturables et leurs tarifs.", "Contrôlez les colis spéciaux qui demandent un prix manuel.", "Après finalisation, confirmez que la facture et les colis apparaissent dans le dossier du client."] },
      { title: "4. Garder les données cohérentes", description: "Les mêmes statuts se retrouvent dans tous les espaces : une seule mise à jour suffit.", icon: CheckCircle2, steps: ["Utilisez les boutons de statut prévus par le système.", "N’effacez pas un colis livré; il appartient à l’historique.", "Consultez l’administrateur avant de corriger une facture ou un paiement finalisé."] }
    ],
    reminders: ["Les anciennes données sont classées en bas, les plus récentes en haut.", "Un colis facturé n’est remis qu’après paiement complet ou règlement du solde.", "N’utilisez jamais les paramètres d’accès d’un autre employé."]
  },
  agent_retrait: {
    label: "Agent de point de retrait",
    introduction: "Ce guide est conçu pour le téléphone, la tablette ou l’ordinateur. Votre rôle est de recevoir, vérifier, encaisser et remettre les colis de votre ville.",
    sections: [
      { title: "1. Rechercher le bon client", description: "Ouvrez un dossier sans parcourir tous les colis.", icon: ScanLine, steps: ["Saisissez le code client pour afficher son dossier.", "Vous pouvez aussi taper exactement les 6 derniers chiffres d’un tracking : un seul colis s’affiche.", "Si le système indique plusieurs résultats, demandez ou saisissez le tracking complet."] },
      { title: "2. Recevoir un bon de remise", description: "Les bons de votre ville uniquement sont visibles dans l’espace de retrait.", icon: Truck, steps: ["Ouvrez le bon correspondant à votre ville et vérifiez son résumé.", "Sélectionnez-le pour le recevoir; cliquez à nouveau dessus pour annuler une sélection faite par erreur.", "Après confirmation, les colis deviennent disponibles et leurs tarifs sont appliqués automatiquement."] },
      { title: "3. Encaisser avant la remise", description: "Le montant à utiliser est celui de la facture client.", icon: CircleDollarSign, steps: ["Ouvrez le numéro de facture pour voir tous les colis et le total.", "Enregistrez le montant reçu, la devise et le moyen de paiement (espèces, MonCash, NatCash, Zelle ou virement).", "Un ancien solde doit être réglé avant de remettre de nouveaux colis."] },
      { title: "4. Confirmer la remise", description: "Une seule confirmation remet tous les colis sélectionnés du client.", icon: CheckCircle2, steps: ["Cochez les colis prêts et payés à remettre.", "Utilisez le bouton unique Confirmer la remise.", "Les colis passent à Livré et la facture complète va dans l’historique."] }
    ],
    reminders: ["Ne remettez jamais un colis sans facture ou sans paiement complet.", "Le rapport montre vos encaissements et les clients qui ont un solde.", "Votre lien est réservé à votre rôle : ne partagez pas votre mot de passe."]
  }
};

export default function OperationsGuide({ role, backHref, backLabel }: { role: GuideRole; backHref: string; backLabel: string }) {
  const guide = content[role];
  return <div className="min-h-screen bg-gradient-to-b from-sky-100 via-[#f5f8ff] to-white text-slate-900">
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Link href={backHref} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-[#0a2b61] shadow-sm transition hover:border-blue-200 hover:bg-blue-50"><ArrowLeft size={18} />{backLabel}</Link>
      <section className="mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-[#071b43] via-[#0d3270] to-[#2563eb] p-6 text-white shadow-[0_20px_40px_rgba(20,76,160,0.2)] sm:p-8"><div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15"><BookOpen size={25} /></span><div><p className="text-xs font-black uppercase tracking-[0.18em] text-sky-100">STANDA COMMERCIAL</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Guide d’utilisation — {guide.label}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">{guide.introduction}</p></div></div></section>
      <section className="mt-6 grid gap-4 md:grid-cols-2">{guide.sections.map((section) => { const Icon = section.icon; return <article key={section.title} className="rounded-3xl border border-white bg-white p-5 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-[#1457be]"><Icon size={22} /></span><h2 className="mt-4 text-lg font-black text-[#0a2b61]">{section.title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{section.description}</p><ol className="mt-4 space-y-3">{section.steps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-5 text-slate-700"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-100 text-xs font-black text-[#1457be]">{index + 1}</span><span>{step}</span></li>)}</ol></article>; })}</section>
      <section className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5"><div className="flex items-center gap-2 text-emerald-800"><ShieldCheck size={21} /><h2 className="font-black">À ne pas oublier</h2></div><ul className="mt-3 grid gap-2 text-sm leading-6 text-emerald-950 sm:grid-cols-3">{guide.reminders.map((reminder) => <li key={reminder} className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={17} />{reminder}</li>)}</ul></section>
    </main>
  </div>;
}
