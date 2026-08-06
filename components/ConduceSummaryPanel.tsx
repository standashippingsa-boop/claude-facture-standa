"use client";
/*
 * STANDA COMMERCIAL — Summary Panel Conduce (Faz 4)
 * Estatistik konplè bò dwat paj Conduce a. READ-ONLY, pa touche kalkil.
 */
import { useEffect, useState } from "react";
import { Package, CheckCircle2, Clock, Truck, Receipt, DollarSign, FileText, Users } from "lucide-react";
import { getConduceSummary } from "@/lib/db";
import { usd } from "@/lib/utils";

export default function ConduceSummaryPanel({ conduceId, refreshKey }: { conduceId: string; refreshKey?: number }) {
  const [s, setS] = useState<Awaited<ReturnType<typeof getConduceSummary>> | null>(null);

  useEffect(() => {
    getConduceSummary(conduceId).then(setS).catch(() => setS(null));
  }, [conduceId, refreshKey]);

  if (!s) return (
    <div className="card p-4">
      <p className="text-xs text-mute">Chargement du résumé…</p>
    </div>
  );

  const rows: [React.ReactNode, string, string][] = [
    [<Package size={13} />, "Packages", String(s.packages)],
    [<CheckCircle2 size={13} />, "Facturés", String(s.factures)],
    [<Clock size={13} />, "Non facturés", String(s.nonFactures)],
    [<Truck size={13} />, "Poids", `${s.poids.toFixed(1)} lb`],
    [<Receipt size={13} />, "Taxes", usd(s.taxes)],
    [<DollarSign size={13} />, "Remises", usd(s.remises)],
    [<FileText size={13} />, "Montant facturé", usd(s.montantFacture)],
    [<Users size={13} />, "Clients", String(s.clients)],
  ];

  return (
    <div className="card p-4 space-y-1">
      <p className="text-[10px] font-bold text-mute uppercase tracking-wide mb-2">Résumé de la Conduce</p>
      {rows.map(([icon, label, val], i) => (
        <div key={i} className="flex items-center justify-between py-1.5 border-b border-line last:border-0">
          <span className="flex items-center gap-1.5 text-xs text-mute">{icon}{label}</span>
          <span className="text-sm font-semibold text-ink">{val}</span>
        </div>
      ))}
      <div className="bg-navy rounded-lg px-3 py-2.5 mt-2 flex items-center justify-between">
        <span className="text-xs text-white/70">Total Général</span>
        <span className="text-lg font-extrabold text-white">{usd(s.totalGeneral)}</span>
      </div>
    </div>
  );
}
