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
import RefreshButton from "@/components/RefreshButton";
import Loader from "@/components/Loader";
import { getConduceById, getConduceStats } from "@/lib/db";
import { dateFr, usd } from "@/lib/utils";
import type { Conduce } from "@/lib/types";

export default function ConduceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [conduce, setConduce] = useState<Conduce | null>(null);
  const [stats, setStats] = useState<{
    count: number; weight: number; facturedCount: number; facturedTotal: number; verifiedCount: number;
    disponibleCount: number; livreCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  /** Chèche conduce a DIRÈKTEMAN pa ID. Vrè erè yo remonte — pa "introuvable" an blan. */
  const load = async () => {
    setErr(null);
    try {
      const c = await getConduceById(id);
      setConduce(c);
      if (c) setStats(await getConduceStats(c.id));
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (loading) return <Loader inline />;
  if (!conduce) return (
    <div className="space-y-3">
      <Link href="/conduces" className="text-navy inline-flex items-center gap-1 hover:underline text-sm">
        <ArrowLeft size={14} /> Retour aux Conduces
      </Link>
      <div className="card p-6 space-y-3">
        {err ? (
          <>
            <p className="text-sm font-bold text-red-700">Erreur de chargement</p>
            <p className="text-xs text-mute break-all">{err}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-ink">Conduce introuvable</p>
            <p className="text-xs text-mute break-all">
              Aucune conduce avec l&apos;identifiant <span className="font-mono">{id}</span>.
              Elle a peut-être été supprimée.
            </p>
          </>
        )}
        <button className="btn btn-ghost border border-line !text-xs" onClick={() => { setLoading(true); load(); }}>
          Réessayer
        </button>
      </div>
    </div>
  );

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
                {stats && stats.count > 0 && conduce.updated_at && (
                  <> · Dernière synchronisation : {new Date(conduce.updated_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton onRefresh={load} />
            <span className="pill pill-gray"><span className="pill-dot" />{conduce.status}</span>
          </div>
        </div>

        {stats && stats.count === 0 && (
          <div className="rounded-lg bg-amber-50 text-amber-800 text-xs font-semibold px-3 py-2 mb-4 flex items-center gap-2">
            <Clock size={14} /> En attente d&apos;import — sur MCPACK, ouvrez la Conduce
            <span className="font-mono">{conduce.conduce_number}</span>, exportez le fichier Excel et importez-le ci-dessous.
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 mb-4">
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
      </div>

      {/* ===== Tablo Packages (menm motè) + Summary Panel (Faz 4) ===== */}
      <ConduceManualPaste conduceId={conduce.id} conduceNumber={conduce.conduce_number} onLinked={load} />

      {/* Rezime — PLEINE LARGEUR, anlè tablo a (li te twò sere nan kwen an) */}
      <ConduceSummaryPanel conduceId={conduce.id} />

      <PackagesEngine conduceId={conduce.id} hideHeader />
    </div>
  );
}
