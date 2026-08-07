"use client";
/*
 * STANDA COMMERCIAL — Fiche Conduce (Faz 3)
 * ══════════════════════════════════════════════════════════
 * PA yon kopi Section Package la. Header spesifik Conduce +
 * MENM PackagesEngine la, filtre pa conduce_id. Zewo dwaplikaj kòd.
 */
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Truck, Package, Receipt, Clock, CheckCircle2 } from "lucide-react";
import PackagesEngine from "@/components/PackagesEngine";
import ConduceSummaryPanel from "@/components/ConduceSummaryPanel";
import ConduceManualPaste from "@/components/ConduceManualPaste";
import { getConduces, getConduceStats } from "@/lib/db";
import { dateFr, usd } from "@/lib/utils";
import type { Conduce } from "@/lib/types";

export default function ConduceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [conduce, setConduce] = useState<Conduce | null>(null);
  const [stats, setStats] = useState<{ count: number; weight: number; facturedCount: number; facturedTotal: number; verifiedCount: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    // getConduces() puis filtre pa ID — pa gen getConduceById apa (Zero Duplication)
    const all = await getConduces();
    const c = all.find((x) => x.id === id) ?? null;
    setConduce(c);
    if (c) setStats(await getConduceStats(c.id));
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (loading) return <p className="text-mute p-6">Chargement…</p>;
  if (!conduce) return (
    <div className="space-y-3">
      <Link href="/conduces" className="text-navy inline-flex items-center gap-1 hover:underline text-sm">
        <ArrowLeft size={14} /> Retour aux Conduces
      </Link>
      <p className="card p-6 text-mute">Conduce introuvable.</p>
    </div>
  );

  const pct = stats && stats.count ? Math.round((stats.facturedCount / stats.count) * 100) : 0;
  const restant = stats ? Math.max(0, stats.count - stats.facturedCount) : 0;

  return (
    <div className="space-y-5">
      <Link href="/conduces" className="text-navy inline-flex items-center gap-1 hover:underline text-sm">
        <ArrowLeft size={14} /> Retour aux Conduces
      </Link>

      {/* ===== Header Conduce (spèk: numéro, date, office, poids, facturé, restant, progression) ===== */}
      <div className="card p-5">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Truck size={22} className="text-navy" />
            <div>
              <h1 className="h-page">Conduce {conduce.conduce_number}</h1>
              <p className="text-sm text-mute mt-0.5">
                {conduce.office || "Office —"} · {conduce.conduce_date ? dateFr(conduce.conduce_date) : dateFr(conduce.created_at)}
              </p>
            </div>
          </div>
          <span className="pill pill-gray"><span className="pill-dot" />{conduce.status}</span>
        </div>

        {stats && stats.count === 0 && (
          <div className="rounded-lg bg-amber-50 text-amber-800 text-xs font-semibold px-3 py-2 mb-4 flex items-center gap-2">
            <Clock size={14} /> En attente d&apos;import — utilisez l&apos;Extension Chrome sur MCPACK avec le numéro
            <span className="font-mono">{conduce.conduce_number}</span>, ou complétez manuellement ci-dessous.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          {[
            [<Package size={14} />, "Colis", stats?.count ?? 0],
            [<Truck size={14} />, "Poids total", `${(stats?.weight ?? 0).toFixed(1)} lb`],
            [<Receipt size={14} />, "Total facturé", usd(stats?.facturedTotal ?? 0)],
            [<Clock size={14} />, "Restant à facturer", restant],
            [<CheckCircle2 size={14} />, "Vérifiés MCPACK", `${stats?.verifiedCount ?? 0}/${stats?.count ?? 0}`],
          ].map(([icon, label, val], i) => (
            <div key={i} className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-1.5 text-mute text-[11px]">{icon as any} {label as string}</div>
              <div className="text-lg font-extrabold text-navy mt-0.5">{val as any}</div>
            </div>
          ))}
        </div>

        {/* Progression */}
        <div>
          <div className="flex items-center justify-between text-xs text-mute mb-1">
            <span>Progression (facturation)</span>
            <span className="font-semibold text-ink">{pct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-mist overflow-hidden">
            <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* ===== Tablo Packages (menm motè) + Summary Panel (Faz 4) ===== */}
      <ConduceManualPaste conduceId={conduce.id} conduceNumber={conduce.conduce_number} onLinked={load} />

      <div className="grid lg:grid-cols-[1fr_260px] gap-4 items-start">
        <div><PackagesEngine conduceId={conduce.id} hideHeader /></div>
        <div className="order-first lg:order-last">
          <ConduceSummaryPanel conduceId={conduce.id} />
        </div>
      </div>
    </div>
  );
}
