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
  const name = fullName?.trim() || "Non ak siyati w";
  const [first, ...rest] = (fullName?.trim() || "").split(/\s+/);
  const firstName = fullName?.trim() ? first : "Non w";
  const lastName = fullName?.trim() ? rest.join(" ") || first : "Siyati w";
  const C = <b className="whitespace-nowrap">{code}</b>;

  return (
    <div lang="ht" className="space-y-8 text-ink">
      <section className="rounded-2xl border-2 border-navy p-4">
        <p className="text-[15px] font-bold text-navy">Règ ki pi enpòtan an</p>
        <p className="mt-1 text-[14px] leading-relaxed text-slate-700">
          Kòd ou {C} dwe parèt sou <b>chak</b> kòmand. San kòd sa a, nou pa ka konnen koli a se pou ou, menm si non w ekri sou li.
        </p>
      </section>

      <section>
        <h3 className="text-[19px] font-bold text-navy">Sou Amazon</h3>
        <p className="mt-1 text-[13.5px] text-slate-600">Account, Your Addresses, Add address. Ranpli kaz ki antoure yo.</p>
        <div className="mt-4">
          <Form title="Add a new address" store="Amazon">
            <Field label="Country/Region" value="United States" select note={<>Chwazi <b>United States</b>.</>} />
            <Field label="Full name (First and Last name)" value={`${name} ${code}`} note={<>Non w, epi kòd ou {C} touprè l. Se plas ki pi sèten sou Amazon.</>} />
            <Field label="Phone number" value={phoneDigits} note={<>Telefòn depo nou an : <b>{phoneDigits}</b>.</>} />
            <Field label="Street address" value={DEPOT.address1} note={<>Ekri <b>{DEPOT.address1}</b>.</>} />
            <Field label="Apt, suite, unit, building" value={code} note={<>Ou ka mete kòd ou {C} la tou. Men li pi sèten bò kote non w.</>} />
            <Field label="City" value={DEPOT.city} note={<>Ekri <b>{DEPOT.city}</b>.</>} />
            <Field label="State" value={DEPOT.state} select note={<>Chwazi <b>{DEPOT.state}</b>.</>} />
            <Field label="ZIP Code" value={DEPOT.zip} note={<>Ekri <b>{DEPOT.zip}</b>.</>} />
            <div className="rounded-full bg-[#ffd814] py-2.5 text-center text-[13.5px] font-semibold text-[#111]">Use this address</div>
          </Form>
        </div>
      </section>

      <section>
        <h3 className="text-[19px] font-bold text-navy">Sou SHEIN</h3>
        <p className="mt-1 text-[13.5px] text-slate-600">Me, Address Book, Add address. Ranpli kaz ki antoure yo.</p>
        <div className="mt-4">
          <Form title="Adresse de livraison" store="SHEIN">
            <Field label="Location" value="United States" select note={<>Chwazi <b>United States</b>.</>} />
            <Field label="First Name" value={firstName} note={<><b>Non</b> w.</>} />
            <Field label="Last Name" value={lastName} note={<><b>Siyati</b> w.</>} />
            <Field label="Phone Number" value={phonePlain} prefix="US +1" note={<>Telefòn depo nou an : <b>{phonePlain}</b>.</>} />
            <Field label="Address Finder" empty="Pa sèvi avè l" />
            <Field label="Street address" value={DEPOT.address1} note={<>Sèlman <b>{DEPOT.address1}</b>. Pa sèvi ak Address Finder.</>} />
            <Field label="Apt, suite, unit, etc" value={code} note={<>Kòd ou {C}, pa mete anyen ankò.</>} />
            <Field label="State/Province" value="FLORIDA" select note={<>Chwazi <b>FLORIDA</b>.</>} />
            <Field label="City" value="Miami" select note={<>Chwazi <b>Miami</b>.</>} />
            <Field label="Postcode" value={DEPOT.zip} note={<>Ekri <b>{DEPOT.zip}</b>.</>} />
            <div className="bg-black py-2.5 text-center text-[13.5px] font-bold text-white">Save</div>
          </Form>
        </div>
      </section>

      <section className="rounded-2xl border-2 border-navy p-4">
        <p className="text-[15px] font-bold text-navy">Apre ou fin pase kòmand, verifye adrès la</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-slate-700">
          <li>Louvri kòmand ou sou sit la (Your Orders, Order details).</li>
          <li>Gade adrès livrezon an : kòd ou {C} dwe parèt ladan l.</li>
          <li>Si kòd la pa ladan l, modifye adrès kòmand lan epi ajoute kòd ou anvan yo voye koli a.</li>
        </ol>
        <p className="mt-2 text-[13.5px] text-slate-700">San kòd la, nou pa ka konnen koli a se pou ou, menm si non w ekri sou li.</p>
      </section>
    </div>
  );
}
