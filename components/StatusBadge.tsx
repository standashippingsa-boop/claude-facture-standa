/**
 * Badge statut. "Disponible" / "Facturé" / "Livré" se sikwi entèn STANDA a;
 * tout lòt valè se statut MCPACK vèbatim (TRANSFERIDO, EN TRANSITO...) — yo
 * afiche egzakteman jan MCPACK ekri yo, an oranj pou montre koli a an transit.
 */
export default function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "Disponible": "bg-emerald-100 text-emerald-700",
    "Facturé": "bg-blue-100 text-blue-700",
    "Livré": "bg-slate-200 text-slate-600"
  };
  return (
    <span className={`badge whitespace-nowrap ${styles[status] ?? "bg-amber-50 text-amber-700"}`}>
      {status}
    </span>
  );
}
