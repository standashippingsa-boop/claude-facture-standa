import type { ReactNode } from "react";
import { DEPOT } from "@/lib/depot";

/**
 * GUIDE : COMMENT ENTRER L'ADRESSE DE MIAMI SUR AMAZON ET SHEIN
 * Formulaires recréés en HTML (aucune vraie donnée de client). Chaque case à
 * remplir est entourée, avec une courte explication à côté et une flèche.
 *
 * Utilisé à deux endroits :
 *   • /guide-aide et /guide-adresse (pages publiques) avec le code MC-XXXXX
 *   • Espace client, Guide et aide, avec le vrai code et le vrai nom du client
 * Ce fichier ne doit jamais importer Supabase (zone publique, check:isolation).
 */
const phoneDigits = DEPOT.phone.replace(/^\+1\s*/, "");
const phonePlain = phoneDigits.replace(/\D/g, "");

/** Flèche dessinée : pointe vers la case (à gauche sur ordinateur, vers le haut sur téléphone). */
function Arrow() {
  return (
    <>
      <svg aria-hidden="true" viewBox="0 0 48 24" className="hidden h-5 w-10 shrink-0 text-navy sm:block" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M46 12C34 12 22 6 6 12" /><path d="M12 6 6 12l6 6" />
      </svg>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-navy sm:hidden" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V5" /><path d="m6 11 6-6 6 6" />
      </svg>
    </>
  );
}

/** Une case du formulaire. `note` = la case est entourée et expliquée à côté. */
function Field({ label, value, empty, select, prefix, note }: {
  label: string; value?: string; empty?: string; select?: boolean; prefix?: string; note?: ReactNode;
}) {
  const box = (
    <div>
      <p className="mb-1 text-[12.5px] font-semibold text-[#111]">{label}</p>
      <div className="flex min-h-10 items-center justify-between gap-2 rounded-md border border-slate-400 bg-white px-3 text-[13.5px]">
        {prefix && <span className="shrink-0 border-r border-slate-300 pr-2 text-slate-500">{prefix}</span>}
        <span className={`min-w-0 flex-1 truncate ${value ? "font-semibold text-[#111]" : "text-slate-400"}`}>{value || empty}</span>
        {select && <span aria-hidden="true" className="text-slate-500">›</span>}
      </div>
    </div>
  );
  if (!note) return <div className="opacity-60">{box}</div>;
  return (
    <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] sm:items-center sm:gap-2">
      {/* La case entourée */}
      <div className="rounded-xl border-2 border-navy p-2">{box}</div>
      {/* L'explication à côté, avec une flèche vers la case */}
      <div className="flex items-start gap-1.5 sm:items-center">
        <Arrow />
        <p className="text-[12.5px] leading-snug text-navy">{note}</p>
      </div>
    </div>
  );
}

function Form({ title, store, children }: { title: string; store: string; children: ReactNode }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-line bg-mist px-4 py-2.5 text-[13px] font-semibold text-[#111]">
        <span>{title}</span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{store}</span>
      </div>
      <div className="space-y-3.5 p-4">{children}</div>
    </figure>
  );
}

export default function AddressGuide({ code = "MC-XXXXX", fullName }: { code?: string; fullName?: string }) {
  const name = fullName?.trim() || "Votre prénom et votre nom";
  const [first, ...rest] = (fullName?.trim() || "").split(/\s+/);
  const firstName = fullName?.trim() ? first : "Votre prénom";
  const lastName = fullName?.trim() ? rest.join(" ") || first : "Votre nom";
  const C = <b className="whitespace-nowrap">{code}</b>;

  return (
    <div className="space-y-8 text-ink">
      <section className="rounded-2xl border-2 border-navy p-4">
        <p className="text-[15px] font-bold text-navy">La règle la plus importante</p>
        <p className="mt-1 text-[14px] leading-relaxed text-slate-700">
          Votre code {C} doit apparaître sur <b>chaque</b> commande. Sans ce code, nous ne pouvons pas identifier votre colis, même si votre nom est écrit dessus.
        </p>
      </section>

      <section>
        <h3 className="text-[19px] font-bold text-navy">Sur Amazon</h3>
        <p className="mt-1 text-[13.5px] text-slate-600">Compte, Vos adresses, Ajouter une adresse. Remplissez les cases entourées.</p>
        <div className="mt-4">
          <Form title="Add a new address" store="Amazon">
            <Field label="Country/Region" value="United States" select note={<>Choisissez <b>United States</b>.</>} />
            <Field label="Full name (First and Last name)" value={`${name} ${code}`} note={<>Votre nom, puis votre code {C} juste à côté. C&apos;est la place la plus sûre sur Amazon.</>} />
            <Field label="Phone number" value={phoneDigits} note={<>Le téléphone de notre dépôt : <b>{phoneDigits}</b>.</>} />
            <Field label="Street address" value={DEPOT.address1} note={<>Écrivez <b>{DEPOT.address1}</b>.</>} />
            <Field label="Apt, suite, unit, building" value={code} note={<>Vous pouvez aussi y mettre votre code {C}. Il reste plus sûr à côté de votre nom.</>} />
            <Field label="City" value={DEPOT.city} note={<>Écrivez <b>{DEPOT.city}</b>.</>} />
            <Field label="State" value={DEPOT.state} select note={<>Choisissez <b>{DEPOT.state}</b>.</>} />
            <Field label="ZIP Code" value={DEPOT.zip} note={<>Écrivez <b>{DEPOT.zip}</b>.</>} />
            <div className="rounded-full bg-[#ffd814] py-2.5 text-center text-[13.5px] font-semibold text-[#111]">Use this address</div>
          </Form>
        </div>
      </section>

      <section>
        <h3 className="text-[19px] font-bold text-navy">Sur SHEIN</h3>
        <p className="mt-1 text-[13.5px] text-slate-600">Moi, Adresses, Ajouter une adresse. Remplissez les cases entourées.</p>
        <div className="mt-4">
          <Form title="Adresse de livraison" store="SHEIN">
            <Field label="Location" value="United States" select note={<>Choisissez <b>United States</b>.</>} />
            <Field label="First Name" value={firstName} note={<>Votre <b>prénom</b>.</>} />
            <Field label="Last Name" value={lastName} note={<>Votre <b>nom de famille</b>.</>} />
            <Field label="Phone Number" value={phonePlain} prefix="US +1" note={<>Le téléphone de notre dépôt : <b>{phonePlain}</b>.</>} />
            <Field label="Address Finder" empty="Ne pas utiliser" />
            <Field label="Street address" value={DEPOT.address1} note={<>Seulement <b>{DEPOT.address1}</b>. N&apos;utilisez pas Address Finder.</>} />
            <Field label="Apt, suite, unit, etc" value={code} note={<>Votre code {C}, et rien d&apos;autre.</>} />
            <Field label="State/Province" value="FLORIDA" select note={<>Choisissez <b>FLORIDA</b>.</>} />
            <Field label="City" value="Miami" select note={<>Choisissez <b>Miami</b>.</>} />
            <Field label="Postcode" value={DEPOT.zip} note={<>Écrivez <b>{DEPOT.zip}</b>.</>} />
            <div className="bg-black py-2.5 text-center text-[13.5px] font-bold text-white">Save</div>
          </Form>
        </div>
      </section>

      <section className="rounded-2xl border-2 border-navy p-4">
        <p className="text-[15px] font-bold text-navy">Après votre commande, vérifiez l&apos;adresse</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-slate-700">
          <li>Ouvrez votre commande sur le site (Vos commandes, Détails de la commande).</li>
          <li>Regardez l&apos;adresse de livraison : votre code {C} doit y apparaître.</li>
          <li>Si le code n&apos;y est pas, modifiez l&apos;adresse de la commande et ajoutez votre code avant l&apos;expédition.</li>
        </ol>
        <p className="mt-2 text-[13.5px] text-slate-700">Sans le code, nous ne pouvons pas identifier votre colis, même si votre nom est écrit dessus.</p>
      </section>
    </div>
  );
}
