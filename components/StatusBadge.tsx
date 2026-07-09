export default function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "Disponible": "bg-emerald-100 text-emerald-700",
    "Facturé": "bg-blue-100 text-blue-700",
    "Livré": "bg-slate-200 text-slate-600"
  };
  return <span className={`badge ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>{status}</span>;
}
