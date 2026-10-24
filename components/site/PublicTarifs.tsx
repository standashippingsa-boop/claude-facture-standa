"use client";
import { useEffect, useState } from "react";
import { TAX_FIXED_USD, TAX_THRESHOLD_LB } from "@/lib/pricing";

type Tarif = { ville: string; prixLivre: number };
type PetitColis = { min: number; max: number; price: number } | null;

const usd = (value: number) => "$" + value.toFixed(2);

/**
 * Prix shipping par ville — compte PERSONNEL seulement (les prix Business ne
 * sont pas publiés). Données lues par /api/public/tarifs (liste blanche).
 * Aucun accès base de données ici : composant de la zone publique.
 */
export default function PublicTarifs() {
  const [state, setState] = useState<{ tarifs: Tarif[]; petitColis: PetitColis } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/public/tarifs").then((res) => res.json())
      .then((json) => { if (json?.ok) setState({ tarifs: json.tarifs ?? [], petitColis: json.petitColis ?? null }); else setError(true); })
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="text-[14px] text-slate-500">Les tarifs sont momentanément indisponibles. Contactez STANDA sur WhatsApp.</p>;
  if (!state) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;

  return (
    <div className="space-y-3">
      <ul className="space-y-2 text-[14px] leading-relaxed text-slate-600">
        <li>• Le prix correspond au <b>poids du colis × tarif de votre ville</b> (tableau plus bas).</li>
        {state.petitColis && <li>• Petit colis entre <b>{state.petitColis.min} et {state.petitColis.max} lb</b> : prix fixe de <b>{usd(state.petitColis.price)}</b>.</li>}
        <li>• À partir de <b>{TAX_THRESHOLD_LB} lb</b> au total, une taxe fixe de <b>{usd(TAX_FIXED_USD)}</b> s&apos;applique.</li>
        <li>• Certains articles comme les téléphones, ordinateurs portables et appareils photo ont un <b>prix forfaitaire</b> : le poids ne s&apos;applique pas.</li>
        <li>• Le prix affiché dans l&apos;application est une <b>estimation</b>. Le prix final est fixé après la pesée du colis à l&apos;entrepôt.</li>
      </ul>
      <div className="overflow-hidden rounded-2xl border border-line">
        <table className="w-full text-left text-[15px]">
          <thead className="bg-navy text-white">
            <tr><th className="px-4 py-3 font-semibold">Ville (agence de retrait)</th><th className="px-4 py-3 text-right font-semibold">Prix par livre</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {state.tarifs.map((row) => (
              <tr key={row.ville}><td className="px-4 py-3 text-navy">{row.ville}</td><td className="px-4 py-3 text-right font-bold tabular-nums text-navy">{usd(row.prixLivre)} / lb</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] leading-relaxed text-slate-500">
        Tarifs du <b>compte Personnel</b>. Le prix d&apos;un colis = son poids × le prix par livre de votre ville. Les comptes Business ont des conditions séparées : contactez STANDA.
        Certains articles (téléphones, ordinateurs…) ou colis spéciaux peuvent avoir un prix fixe ou une taxe, toujours indiqués sur votre facture.
      </p>
    </div>
  );
}
