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

  if (error) return <p className="text-[14px] text-slate-500">Pri yo pa disponib kounye a. Ekri STANDA sou WhatsApp.</p>;
  if (!state) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;

  return (
    <div className="space-y-3">
      <ul className="space-y-2 text-[14px] leading-relaxed text-slate-600">
        <li>• Pri a se <b>pwa koli a × pri vil ou a</b> (gade tablo ki anba a).</li>
        <li>• Depi total la rive <b>{TAX_THRESHOLD_LB} lb</b>, gen yon taks fiks <b>{usd(TAX_FIXED_USD)}</b>.</li>
        <li>• Kèk atik tankou telefòn, laptop ak kamera gen yon <b>pri fiks</b> : pwa a pa konte pou yo.</li>
        <li>• Pri ou wè nan aplikasyon an se yon <b>estimasyon</b>. Pri final la fikse apre nou fin peze koli a nan depo a.</li>
      </ul>
      <div className="overflow-hidden rounded-2xl border border-line">
        <table className="w-full text-left text-[15px]">
          <thead className="bg-navy text-white">
            <tr><th className="px-4 py-3 font-semibold">Vil (ajans kote w ap chèche koli)</th><th className="px-4 py-3 text-right font-semibold">Pri pa liv</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {state.tarifs.map((row) => (
              <tr key={row.ville}><td className="px-4 py-3 text-navy">{row.ville}</td><td className="px-4 py-3 text-right font-bold tabular-nums text-navy">{usd(row.prixLivre)} / lb</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] leading-relaxed text-slate-500">
        Pri sa yo se pou <b>kont Personnel</b>. Pri yon koli = pwa li × pri pa liv vil ou a. Kont Business yo gen lòt kondisyon : kontakte STANDA.
        Kèk atik (telefòn, laptop…) oswa koli espesyal ka gen yon pri fiks oswa yon taks, epi sa toujou ekri sou fakti w la.
      </p>
    </div>
  );
}
