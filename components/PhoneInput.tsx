"use client";
/*
 * CHAMP TÉLÉPHONE avec choix du pays (Haïti, États-Unis, République dominicaine).
 * L'indicatif est affiché à gauche ; la personne tape seulement son numéro.
 * Espaces, tirets et indicatif tapé en trop sont retirés pendant la saisie,
 * et on ne peut pas taper plus de chiffres que le pays n'en a (lib/phone.ts).
 */
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
        <select aria-label={`Pays · ${label}`} className="input w-[10rem] shrink-0 pl-2.5 pr-8 text-ink" value={country}
          onChange={(e) => { const next = e.target.value as PhoneCountryId; onCountry(next); onValue(cleanLocalPhone(next, value)); }}>
          {PHONE_COUNTRIES.map((p) => <option key={p.id} value={p.id} title={p.name}>{p.short} +{p.dial}</option>)}
        </select>
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
