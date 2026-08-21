"use client";
/*
 * STANDA COMMERCIAL — POLITIQUE DE CONFIDENTIALITÉ
 * ════════════════════════════════════════════════
 * Paj piblik (pa mande koneksyon). Lyen depi /login, /admin-login, /employe.
 * Ekri an fransè — se lang dokiman ofisyèl kliyan yo.
 */
import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { SITE_URL, SUPPORT_PHONE } from "@/lib/branding";
import { DEPOT } from "@/lib/depot";

const WA = `https://wa.me/${SUPPORT_PHONE.replace(/\D/g, "")}`;
const MAJ = "20 août 2026";

function S({ n, t, children }: { n: string; t: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-sm font-bold text-navy uppercase tracking-wide flex items-baseline gap-2">
        <span className="text-mute font-mono text-xs">{n}</span>{t}
      </h2>
      <div className="mt-3 space-y-2.5 text-[13px] text-slate-600 leading-relaxed">{children}</div>
    </section>
  );
}

const Li = ({ children }: { children: React.ReactNode }) => (
  <li className="flex gap-2"><span className="text-navy shrink-0">•</span><span>{children}</span></li>
);

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-mist py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        <Link href="/login" className="text-navy inline-flex items-center gap-1 hover:underline text-sm font-semibold">
          <ArrowLeft size={15} /> Retour
        </Link>

        <div className="text-center py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="STANDA COMMERCIAL" className="mx-auto h-16 object-contain" />
          <h1 className="text-2xl font-extrabold text-navy mt-3">Politique de confidentialité</h1>
          <p className="text-xs text-mute mt-1">Dernière mise à jour : {MAJ}</p>
        </div>

        <div className="card p-5 sm:p-6 bg-navy text-white">
          <p className="text-[13px] leading-relaxed">
            STANDA COMMERCIAL (Standa Shipping SA) transporte vos colis entre les États-Unis
            et Haïti. Pour cela, nous devons collecter certaines informations vous concernant.
            Cette page explique <b>lesquelles</b>, <b>pourquoi</b>, <b>qui peut les voir</b> et
            <b> quels sont vos droits</b>. Nous ne vendons vos données à personne.
          </p>
        </div>

        <S n="1" t="Informations que nous collectons">
          <p>À votre inscription et pendant l&apos;utilisation du service :</p>
          <ul className="space-y-1.5">
            <Li><b>Identité</b> — nom, prénom, type et numéro de pièce d&apos;identité (carte d&apos;identité nationale ou passeport).</Li>
            <Li><b>Contact</b> — adresse e-mail, téléphone, numéro WhatsApp.</Li>
            <Li><b>Localisation de livraison</b> — pays, ville, deuxième ville, adresse.</Li>
            <Li><b>Compte</b> — votre code client (MC-XXXXX) et un mot de passe chiffré. <b>Nous ne voyons jamais votre mot de passe.</b></Li>
            <Li><b>Colis</b> — numéros de suivi, contenu déclaré, poids, statut, dates de réception.</Li>
            <Li><b>Facturation</b> — montants, taxes, remises, factures PDF, demandes de retrait.</Li>
          </ul>
          <p className="text-[12px] text-mute">
            Nous ne collectons ni votre position GPS, ni vos contacts, ni vos photos.
          </p>
        </S>

        <S n="2" t="Pourquoi nous les utilisons">
          <ul className="space-y-1.5">
            <Li><b>Identifier vos colis</b> — votre code MC est l&apos;adresse 2 utilisée par nos entrepôts. Sans lui, un colis ne peut pas vous être attribué.</Li>
            <Li><b>Transporter et livrer</b> — préparer les manifestes de transport et les bons de remise.</Li>
            <Li><b>Vous facturer</b> — calculer le prix selon le poids et le tarif de votre ville.</Li>
            <Li><b>Vous informer</b> — e-mail et WhatsApp quand un colis arrive à Miami ou devient disponible.</Li>
            <Li><b>Sécurité et obligations légales</b> — vérifier votre identité, prévenir la fraude, respecter les règles douanières.</Li>
          </ul>
          <p className="font-semibold text-ink">
            Nous n&apos;utilisons pas vos données à des fins publicitaires et nous ne les vendons pas.
          </p>
        </S>

        <S n="3" t="Qui peut voir vos informations">
          <ul className="space-y-1.5">
            <Li><b>Vous</b> — dans votre espace client, à tout moment.</Li>
            <Li><b>Le personnel autorisé de STANDA COMMERCIAL</b> — uniquement pour traiter vos colis et vos factures.</Li>
            <Li><b>Nos prestataires techniques</b>, strictement pour faire fonctionner le service :
              hébergement et base de données, envoi d&apos;e-mails, plateforme logistique MCPACK,
              et transporteur pour l&apos;acheminement en Haïti.</Li>
            <Li><b>Les autorités</b> — douanes ou justice, uniquement si la loi l&apos;exige.</Li>
          </ul>
          <p>
            Chaque client ne voit que <b>ses propres</b> colis et factures. L&apos;accès aux données
            est contrôlé au niveau de la base de données elle-même, pas seulement dans l&apos;application.
          </p>
        </S>

        <S n="4" t="Contenu interdit">
          <p>
            Vous êtes responsable de ce que vous expédiez. Les marchandises illégales, dangereuses
            ou interdites à l&apos;importation sont refusées, et peuvent être signalées aux autorités
            compétentes conformément à la loi.
          </p>
        </S>

        <S n="5" t="Durée de conservation">
          <ul className="space-y-1.5">
            <Li><b>Compte et identité</b> — tant que votre compte est actif.</Li>
            <Li><b>Colis, factures et bons de remise</b> — conservés pour nos obligations comptables et douanières, même après la clôture du compte.</Li>
            <Li><b>Compte inactif</b> — vous pouvez demander la fermeture à tout moment (voir section 7).</Li>
          </ul>
        </S>

        <S n="6" t="Sécurité">
          <ul className="space-y-1.5">
            <Li>Les échanges avec l&apos;application sont chiffrés (HTTPS).</Li>
            <Li>Les mots de passe sont stockés sous forme chiffrée irréversible — personne chez nous ne peut les lire.</Li>
            <Li>L&apos;accès aux données est restreint par des règles appliquées directement dans la base de données.</Li>
          </ul>
          <p className="font-semibold text-ink">
            De votre côté : changez le mot de passe temporaire que nous vous envoyons, et ne le
            partagez avec personne. Aucun employé de STANDA COMMERCIAL ne vous demandera
            jamais votre mot de passe.
          </p>
        </S>

        <S n="7" t="Vos droits">
          <ul className="space-y-1.5">
            <Li><b>Consulter</b> les informations que nous détenons sur vous.</Li>
            <Li><b>Corriger</b> une information inexacte (nom, téléphone, adresse, ville).</Li>
            <Li><b>Demander la suppression</b> de votre compte — sous réserve des documents que la loi nous oblige à conserver.</Li>
            <Li><b>Refuser les notifications</b> e-mail ou WhatsApp non essentielles.</Li>
          </ul>
          <p>Pour exercer ces droits, contactez-nous (section 9). Nous répondons sous 30 jours.</p>
        </S>

        <S n="8" t="Application installée et cookies">
          <p>
            L&apos;application s&apos;installe sur votre téléphone pour fonctionner plus vite et
            rester accessible depuis votre écran d&apos;accueil. Elle stocke localement de quoi
            vous garder connecté et afficher vos pages rapidement.
          </p>
          <p>
            <b>Nous n&apos;utilisons aucun cookie publicitaire ni traceur tiers.</b> Vous pouvez
            désinstaller l&apos;application à tout moment ; cela n&apos;efface pas votre compte.
          </p>
        </S>

        <S n="9" t="Nous contacter">
          <p><b>STANDA COMMERCIAL</b> — Standa Shipping SA</p>
          <ul className="space-y-1.5">
            <Li>Téléphone / WhatsApp : <b>{SUPPORT_PHONE}</b></Li>
            <Li>Site : {SITE_URL.replace("https://", "")}</Li>
            <Li>Entrepôt États-Unis : {DEPOT.address1}, {DEPOT.city}, {DEPOT.state} {DEPOT.zip}</Li>
          </ul>
          <a href={WA} target="_blank" rel="noreferrer" className="btn btn-wa justify-center w-full mt-3">
            <MessageCircle size={15} /> Nous écrire sur WhatsApp
          </a>
        </S>

        <S n="10" t="Modifications">
          <p>
            Nous pouvons mettre à jour cette politique. La date en haut de page indique la
            dernière version. Pour tout changement important, nous vous préviendrons dans
            l&apos;application ou par WhatsApp.
          </p>
        </S>

        <p className="text-center text-[11px] text-mute py-4">
          © {new Date().getFullYear()} STANDA COMMERCIAL — Standa Shipping SA
        </p>
      </div>
    </div>
  );
}
