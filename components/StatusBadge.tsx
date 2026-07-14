/**
 * Badge statut ENTÈN (admin sèlman ki chanje yo).
 * Nenpòt lòt valè (ansyen done / MCPACK) afiche vèbatim an gri.
 */
const STYLES: Record<string, string> = {
  "Reçu à Miami": "bg-sky-100 text-sky-700",
  "En préparation": "bg-amber-100 text-amber-700",
  "En transit": "bg-indigo-100 text-indigo-700",
  "Arrivé en Haïti": "bg-teal-100 text-teal-700",
  "En route vers agence": "bg-violet-100 text-violet-700",
  "Disponible": "bg-emerald-100 text-emerald-700",
  "Facturé": "bg-blue-100 text-blue-700",
  "Livré": "bg-slate-200 text-slate-600"
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge whitespace-nowrap ${STYLES[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}
