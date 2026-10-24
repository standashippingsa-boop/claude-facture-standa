"use client";
import { useEffect, useState } from "react";

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

  if (error) return <p className="text-[14px] text-slate-500">Les tarifs sont momentanément indisponibles. Contactez-nous sur WhatsApp.</p>;
  if (!state) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;

  return (
    <div className="space-y-3">
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
      {state.petitColis && (
        <p className="rounded-xl bg-accent-light px-4 py-3 text-[14px] text-navy">
          <b>Petits colis :</b> un colis de {state.petitColis.min} à {state.petitColis.max} lb peut être facturé au tarif fixe de <b>{usd(state.petitColis.price)}</b>.
        </p>
      )}
      <p className="text-[13px] leading-relaxed text-slate-500">
        Tarifs du <b>compte Personnel</b>. Le prix d&apos;un colis = son poids × le prix par livre de votre ville. Les comptes Business ont des conditions séparées : contactez-nous.
        Certains articles (téléphones, ordinateurs…) ou colis spéciaux peuvent avoir un prix fixe ou une taxe, toujours indiqués sur votre facture.
      </p>
    </div>
  );
}
