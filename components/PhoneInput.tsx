"use client";
/*
 * CHAMP TÉLÉPHONE avec choix du pays (Haïti, États-Unis, République dominicaine).
 * L'indicatif est affiché à gauche ; la personne tape seulement son numéro.
 * Espaces, tirets et indicatif tapé en trop sont retirés pendant la saisie,
 * et on ne peut pas taper plus de chiffres que le pays n'en a (lib/phone.ts).
 */
import ChoicePicker from "@/components/ChoicePicker";
import { PHONE_COUNTRIES, cleanLocalPhone, detectPhoneCountry, formatPhone, phoneCountry, type PhoneCountryId } from "@/lib/phone";

export default function PhoneInput({ id, label, country, onCountry, value, onValue, error }: {
  id: string; label: string;
  country: PhoneCountryId; onCountry: (c: PhoneCountryId) => void;
  value: string; onValue: (digits: string) => void;
  error?: string;
}) {
  const c = phoneCountry(country);
  return (
    <div className="block">
      <label htmlFor={id} className="text-xs font-semibold text-slate-600">{label}</label>
      <div className="mt-1 flex gap-2">
        <div className="w-[8.6rem] shrink-0">
          <ChoicePicker title="Pays du numéro" placeholder="Pays" value={country}
            options={PHONE_COUNTRIES.map((p) => ({ value: p.id, label: `${p.name}  +${p.dial}`, hint: `${p.length} chiffres, ex. ${p.example}` }))}
            display={(choice) => { const p = phoneCountry(choice.value); return `${p.short} +${p.dial}`; }}
            onChange={(v) => { const next = v as PhoneCountryId; onCountry(next); onValue(cleanLocalPhone(next, value)); }} />
        </div>
        <div className="min-w-0 flex-1">
          <input id={id} type="tel" inputMode="numeric" autoComplete="tel-national" className="input"
            placeholder={c.example} value={formatPhone(country, value)}
            onChange={(e) => {
              // Numéro tapé ou collé avec son indicatif (+509, +1 809…) : le bon pays est choisi tout seul.
              const found = detectPhoneCountry(e.target.value);
              const target = found ?? country;
              if (found && found !== country) onCountry(found);
              onValue(cleanLocalPhone(target, e.target.value));
            }}
            aria-invalid={!!error} aria-describedby={`${id}-help`} />
        </div>
      </div>
      <span id={`${id}-help`} className="mt-0.5 block text-[11px] text-slate-400">{c.name} : {c.length} chiffres, sans l&apos;indicatif +{c.dial}.</span>
      {error && <span className="block text-xs text-red-600">{error}</span>}
    </div>
  );
}
