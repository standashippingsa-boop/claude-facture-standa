import type { ReactNode } from "react";
import { DEPOT } from "@/lib/depot";

/**
 * GID: KIJAN POU ANTRE ADRÈS MIAMI A SOU SHEIN AK AMAZON
 * ═══════════════════════════════════════════════════════════════════
 * Fòm yo REKREYE an HTML (pa foto kliyan): okenn vrè non, telefòn ni kòd
 * kliyan pa parèt. Chak chan pou ranpli antoure an wouj ak yon nimewo,
 * epi menm nimewo a eksplike anba fòm nan.
 *
 * Itilize de kote:
 *   • /guide-adresse (paj piblik kache, lyen nan Paramètres admin) — kòd MC-XXXXX
 *   • Espace client → Guide et aide — ak VRÈ kòd ak non kliyan an
 * Fichye sa a pa dwe janm enpòte Supabase (zòn piblik, gade check:isolation).
 */
const phoneDigits = DEPOT.phone.replace(/^\+1\s*/, "");
const phonePlain = phoneDigits.replace(/\D/g, "");

type Step = { n: number; title: string; text: ReactNode };

/** Yon chan fòm. `n` = chan an antoure an wouj ak nimewo sa a. */
function Field({ label, value, n, empty, hint, select, prefix }: {
  label: string; value?: string; n?: number; empty?: string; hint?: string; select?: boolean; prefix?: string;
}) {
  return (
    <div className="relative">
      <p className="mb-1 flex items-center gap-1.5 text-[13px] font-bold text-[#111]">
        {n !== undefined && <span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-600 text-[11px] font-black text-white">{n}</span>}
        {label}
      </p>
      <div className={`flex min-h-11 items-center justify-between gap-2 rounded-md border bg-white px-3 text-[14px] ${n !== undefined ? "border-red-600 ring-[3px] ring-red-500/70" : "border-slate-400"}`}>
        {prefix && <span className="shrink-0 border-r border-slate-300 pr-2 text-slate-500">{prefix}</span>}
        <span className={`min-w-0 flex-1 truncate ${value ? "font-semibold text-[#111]" : "text-slate-400"}`}>{value || empty}</span>
        {select && <span aria-hidden="true" className="text-slate-500">›</span>}
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function Phone({ store, tone, children }: { store: string; tone: "amazon" | "shein"; children: ReactNode }) {
  return (
    <figure className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[1.6rem] border-[6px] border-[#1d1d1f] bg-white shadow-xl">
      <div className={`flex items-center justify-between px-4 py-3 text-sm font-semibold ${tone === "amazon" ? "bg-[#f3c487] text-[#111]" : "bg-white text-[#111] border-b border-slate-200"}`}>
        <span aria-hidden="true">←</span>
        <span>{tone === "amazon" ? "Edit your shipping address" : "Adresse de livraison"}</span>
        <span className="text-[11px] font-bold opacity-70">{store}</span>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </figure>
  );
}

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li key={step.n} className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-600 text-[13px] font-black text-white">{step.n}</span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-navy">{step.title}</p>
            <p className="mt-0.5 text-[14px] leading-relaxed text-slate-700">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function AddressGuide({ code = "MC-XXXXX", fullName }: { code?: string; fullName?: string }) {
  const nameExample = fullName?.trim() || "Votre prénom et votre nom";
  const [first, ...rest] = (fullName?.trim() || "").split(/\s+/);
  const firstName = fullName?.trim() ? first : "Votre prénom";
  const lastName = fullName?.trim() ? rest.join(" ") || first : "Votre nom";
  const street = `${DEPOT.address1} ${code}`;
  const C = <b className="whitespace-nowrap text-red-700">{code}</b>;

  const amazonSteps: Step[] = [
    { n: 1, title: "Country/Region", text: <>Choisissez <b>United States</b>.</> },
    { n: 2, title: "Full name", text: <>Écrivez <b>votre propre nom</b> (prénom et nom), comme sur votre pièce d&apos;identité.</> },
    { n: 3, title: "Phone number", text: <>Mettez le téléphone de notre dépôt : <b>{phoneDigits}</b>.</> },
    { n: 4, title: "Street address", text: <>Écrivez <b>{DEPOT.address1}</b>, un espace, puis votre code {C}. C&apos;est grâce à ce code que nous savons que le colis est à vous.</> },
    { n: 5, title: "Unit or suite number", text: <>Laissez <b>vide</b>.</> },
    { n: 6, title: "City", text: <>Écrivez <b>{DEPOT.city}</b>.</> },
    { n: 7, title: "State", text: <>Choisissez <b>{DEPOT.state}</b>.</> },
    { n: 8, title: "ZIP Code", text: <>Écrivez <b>{DEPOT.zip}</b>.</> },
    { n: 9, title: "Use this address", text: <>Cochez « Make this my default address » si vous voulez la garder, puis touchez <b>Use this address</b>.</> },
  ];
  const sheinSteps: Step[] = [
    { n: 1, title: "Location", text: <>Choisissez <b>United States</b>.</> },
    { n: 2, title: "First Name", text: <>Votre <b>prénom</b>.</> },
    { n: 3, title: "Last Name", text: <>Votre <b>nom de famille</b>.</> },
    { n: 4, title: "Phone Number", text: <>Laissez <b>US +1</b> et écrivez le téléphone de notre dépôt : <b>{phonePlain}</b>.</> },
    { n: 5, title: "Street address", text: <>Écrivez seulement <b>{DEPOT.address1}</b>. N&apos;utilisez pas « Address Finder » : il peut changer l&apos;adresse.</> },
    { n: 6, title: "Apt, suite, unit (ligne 2)", text: <>Écrivez votre code {C} ici, et rien d&apos;autre. Sur SHEIN, le code va <b>toujours</b> dans cette case.</> },
    { n: 7, title: "State/Province", text: <>Choisissez <b>FLORIDA</b>.</> },
    { n: 8, title: "City", text: <>Choisissez <b>Miami</b>.</> },
    { n: 9, title: "Postcode", text: <>Écrivez <b>{DEPOT.zip}</b>.</> },
    { n: 10, title: "Save", text: <>Activez « Make Default » si vous voulez la garder, puis touchez <b>Save</b>.</> },
  ];

  return (
    <div className="space-y-10 text-ink">
      <section className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-[15px] font-extrabold text-red-800">La règle la plus importante</p>
        <p className="mt-1 text-[14px] leading-relaxed text-red-900">
          Votre code {C} doit apparaître sur <b>chaque</b> adresse. Sur <b>Amazon</b>, écrivez le juste après <b>{DEPOT.address1}</b>, sur la même ligne.
          Sur <b>SHEIN</b>, écrivez le dans la case de la <b>ligne 2</b> (Apt, suite, unit). Sans ce code, nous ne pouvons pas savoir à qui appartient le colis.
        </p>
      </section>

      <section>
        <h2 className="text-[22px] font-extrabold text-navy">Sur Amazon</h2>
        <p className="mt-1 text-[14px] text-slate-600">Compte → Vos adresses → Ajouter une adresse. Remplissez les cases entourées en rouge.</p>
        <div className="mt-5 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
          <Phone store="Amazon" tone="amazon">
            <Field n={1} label="Country/Region" value="United States" select />
            <Field n={2} label="Full name (First and Last name)" value={nameExample} />
            <Field n={3} label="Phone number" value={phoneDigits} hint="May be used to assist delivery" />
            <div className="rounded-full border border-slate-400 py-2 text-center text-[13px] text-slate-500">Use my location, ne pas toucher</div>
            <Field n={4} label="Street address" value={street} />
            <Field n={5} label="Unit or suite number" empty="Laisser vide" />
            <Field n={6} label="City" value={DEPOT.city} />
            <div className="grid grid-cols-2 gap-3">
              <Field n={7} label="State" value={DEPOT.state} select />
              <Field n={8} label="ZIP Code" value={DEPOT.zip} />
            </div>
            <div className="relative">
              <span aria-hidden="true" className="absolute -left-2 -top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-red-600 text-[12px] font-black text-white shadow">9</span>
              <div className="rounded-full bg-[#ffd814] py-3 text-center text-[14px] font-semibold text-[#111] ring-[3px] ring-red-500/70">Use this address</div>
            </div>
          </Phone>
          <Steps steps={amazonSteps} />
        </div>
      </section>

      <section>
        <h2 className="text-[22px] font-extrabold text-navy">Sur SHEIN</h2>
        <p className="mt-1 text-[14px] text-slate-600">Moi → Adresses → Ajouter une adresse. Remplissez les cases entourées en rouge.</p>
        <div className="mt-5 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
          <Phone store="SHEIN" tone="shein">
            <Field n={1} label="Location *" value="United States" select />
            <Field n={2} label="First Name *" value={firstName} />
            <Field n={3} label="Last Name *" value={lastName} />
            <Field n={4} label="Phone Number *" value={phonePlain} prefix="US +1" />
            <Field label="Address Finder" empty="Ne pas utiliser" />
            <Field n={5} label="Street address *" value={DEPOT.address1} />
            <Field n={6} label="Apt, suite, unit, etc (optional)" value={code} />
            <Field n={7} label="State/Province *" value="FLORIDA" select />
            <Field n={8} label="City *" value="Miami" select />
            <Field n={9} label="Postcode *" value={DEPOT.zip} />
            <div className="relative">
              <span aria-hidden="true" className="absolute -left-2 -top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-red-600 text-[12px] font-black text-white shadow">10</span>
              <div className="bg-black py-3 text-center text-[14px] font-bold text-white ring-[3px] ring-red-500/70">Save</div>
            </div>
          </Phone>
          <Steps steps={sheinSteps} />
        </div>
      </section>

      <section className="rounded-xl bg-mist p-4">
        <p className="text-[15px] font-extrabold text-navy">Avant de valider votre commande</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-slate-700">
          <li>Vérifiez que le code {C} est bien écrit, sans faute.</li>
          <li>Si le site propose de « corriger » ou « suggérer » l&apos;adresse, gardez celle que vous avez écrite avec votre code.</li>
          <li>Une question ? Écrivez à STANDA sur WhatsApp avant de payer.</li>
        </ul>
      </section>
    </div>
  );
}
