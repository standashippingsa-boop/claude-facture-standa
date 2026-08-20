"use client";
/*
 * STANDA COMMERCIAL — RÉSUMÉ CONDUCE · V17
 * ════════════════════════════════════════
 * RÈG: yon rezime pa gen sans toutotan tout koli yo poko fakti — chif yo ta
 * enkonplè epi yo ta twonpe w. Donk:
 *   • Koli ki rete pou fakti  -> panèl la MONTRE PWOGRESYON an epi li di
 *                                konbyen koli ki manke. Pa gen fo total.
 *   • Tout koli fakti          -> REZIME KONPLÈ ak benefis estime.
 *
 * BENEFIS ESTIME = pwa total × 0.80 USD (MCPACK fakti ~3.00/lb).
 * Se yon ESTIMASYON pou pilotaj, pa yon chif kontabilite.
 *
 * LAJÈ: panèl la pran TOUT lajè paj la (pa yon ti kolòn nan kwen).
 * Mobile: kat ki anpile 2 pa 2. READ-ONLY — li pa touche okenn kalkil.
 */
import { useEffect, useState } from "react";
import {
  CheckCircle2, Clock, DollarSign, FileText, Lock, Package, Receipt, TrendingUp, Truck, Users
} from "lucide-react";
import { getConduceStats, getConduceSummary } from "@/lib/db";
import { MCPACK_COST_PER_LB, PROFIT_PER_LB, estimateProfit } from "@/lib/pricing";
import { usd } from "@/lib/utils";

type Summary = Awaited<ReturnType<typeof getConduceSummary>>;
type Stats = Awaited<ReturnType<typeof getConduceStats>>;

export default function ConduceSummaryPanel({ conduceId, refreshKey }: {
  conduceId: string; refreshKey?: number;
}) {
  const [s, setS] = useState<Summary | null>(null);
  const [st, setSt] = useState<Stats | null>(null);

  useEffect(() => {
    Promise.all([getConduceSummary(conduceId), getConduceStats(conduceId)])
      .then(([a, b]) => { setS(a); setSt(b); })
      .catch(() => { setS(null); setSt(null); });
  }, [conduceId, refreshKey]);

  if (!s || !st) return (
    <div className="card p-4"><p className="text-xs text-mute">Chargement du résumé…</p></div>
  );

  const vide = st.count === 0;
  const restant = Math.max(0, st.count - st.facturedCount);
  const complet = !vide && restant === 0;
  const pct = st.count ? Math.round((st.facturedCount / st.count) * 100) : 0;
  const benefice = estimateProfit(s.poids);
  const coutMcpack = Number((s.poids * MCPACK_COST_PER_LB).toFixed(2));

  /* ── Poko konplè: montre pwogresyon an, pa yon fo rezime ── */
  if (!complet) {
    return (
      <div className="card p-5">
        <div className="flex items-start gap-3">
          <Lock size={18} className="text-slate-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">Résumé disponible une fois tout facturé</p>
            <p className="text-xs text-mute mt-1 leading-relaxed">
              {vide
                ? "Aucun colis synchronisé dans cette conduce pour le moment."
                : <>Il reste <b className="text-navy">{restant} colis</b> à facturer sur {st.count}.
                   Le résumé et le bénéfice estimé s&apos;afficheront quand tout sera facturé.</>}
            </p>
            {!vide && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-line overflow-hidden">
                  <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-bold text-navy tabular-nums shrink-0">{pct}%</span>
              </div>
            )}
          </div>
        </div>

        {!vide && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-line">
            {([
              ["Colis", String(st.count)],
              ["Facturés", String(st.facturedCount)],
              ["Restants", String(restant)],
              ["Poids", `${s.poids.toFixed(1)} lb`]
            ] as const).map(([k, v]) => (
              <div key={k}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-mute">{k}</p>
                <p className="text-lg font-extrabold text-ink leading-tight">{v}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── Konplè: rezime antye ── */
  const cells: [React.ReactNode, string, string][] = [
    [<Package key="a" size={13} />, "Colis", String(s.packages)],
    [<CheckCircle2 key="b" size={13} />, "Facturés", String(s.factures)],
    [<Truck key="c" size={13} />, "Poids", `${s.poids.toFixed(1)} lb`],
    [<Users key="d" size={13} />, "Clients", String(s.clients)],
    [<Receipt key="e" size={13} />, "Taxes", usd(s.taxes)],
    [<DollarSign key="f" size={13} />, "Remises", usd(s.remises)],
    [<FileText key="g" size={13} />, "Montant facturé", usd(s.montantFacture)],
    [<Clock key="h" size={13} />, "Total général", usd(s.totalGeneral)],
  ];

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 size={16} className="text-brand" />
        <h2 className="text-sm font-bold text-navy uppercase tracking-wide">Résumé de la conduce</h2>
        <span className="pill pill-green ml-auto"><span className="pill-dot" />Entièrement facturée</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
        {cells.map(([icon, label, val], i) => (
          <div key={i} className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-mute">
              {icon}{label}
            </p>
            <p className="text-lg font-extrabold text-ink leading-tight mt-0.5 truncate">{val}</p>
          </div>
        ))}
      </div>

      {/* Benefis estime */}
      <div className="mt-4 pt-4 border-t border-line grid sm:grid-cols-[1fr_auto] gap-3 items-center">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-mute">
            <TrendingUp size={13} /> Bénéfice estimé
          </p>
          <p className="text-[11px] text-mute mt-1 leading-relaxed">
            {s.poids.toFixed(1)} lb × {usd(PROFIT_PER_LB)}/lb ·
            coût MCPACK estimé {usd(coutMcpack)} ({usd(MCPACK_COST_PER_LB)}/lb).
            <br />Estimation de pilotage — ce n&apos;est pas un chiffre comptable.
          </p>
        </div>
        <div className="bg-navy rounded-xl px-5 py-3 text-center sm:text-right">
          <p className="text-[10px] text-white/55 uppercase tracking-wide font-bold">Bénéfice</p>
          <p className="text-2xl font-extrabold text-white leading-tight">{usd(benefice)}</p>
        </div>
      </div>
    </div>
  );
}
