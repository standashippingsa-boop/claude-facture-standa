/**
 * Badge statut ENTÈN (admin sèlman ki chanje yo).
 * Nenpòt lòt valè (ansyen done / MCPACK) afiche vèbatim an gri.
 * Estil pill ak ti pwen kolore (dashboard pwofesyonèl).
 */
const STYLES: Record<string, string> = {
  "Reçu à Miami": "bg-sky-50 text-sky-700",
  "En préparation": "bg-amber-50 text-amber-700",
  "En transit": "bg-indigo-50 text-indigo-700",
  "Arrivé en Haïti": "bg-teal-50 text-teal-700",
  "En route vers agence": "bg-violet-50 text-violet-700",
  "Disponible": "bg-brand-light text-brand-dark",
  "Facturé": "bg-blue-50 text-blue-700",
  "Livré": "bg-slate-100 text-slate-600"
};

export default function StatusBadge({ status }: { status: string }) {
  const cls = STYLES[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`pill whitespace-nowrap ${cls}`}>
      <span className="pill-dot" /> {status}
    </span>
  );
}
