"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "@/components/icons";
import { getPackagesSansConduce } from "@/lib/db";
import type { Pkg } from "@/lib/types";
import {
  AJOUT_RECENT_JOURS, AJOUT_TARDIF_JOURS, SANS_CONDUCE_JOURS,
  estAjoutTardif, estSansConduceTropLongtemps, joursAvantAjout, joursDepuisArrivee
} from "@/lib/package-age";

/**
 * Alèt anlè paj Packages :
 *  1. koli ki la depi ≥ 7 jou Miami e ki poko nan okenn Conduce ;
 *  2. koli ki fèk antre nan sistèm nan, men ki te rive Miami depi lontan.
 * Klike sou yon koli mete tracking li nan rechèch la.
 */
export default function StaleParcelsAlert({ onPick, refreshKey }: { onPick: (tracking: string) => void; refreshKey?: number }) {
  const [rows, setRows] = useState<Pkg[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getPackagesSansConduce().then((r) => { if (alive) setRows(r); }).catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [refreshKey]);

  const { vieux, tardifs } = useMemo(() => {
    const now = Date.now();
    const list = rows ?? [];
    const byAge = (a: Pkg, b: Pkg) => (joursDepuisArrivee(b, now) ?? 0) - (joursDepuisArrivee(a, now) ?? 0);
    return {
      vieux: list.filter((p) => estSansConduceTropLongtemps(p, now)).sort(byAge),
      tardifs: list.filter((p) => estAjoutTardif(p, now)).sort(byAge)
    };
  }, [rows]);

  if (!vieux.length && !tardifs.length) return null;

  const Row = ({ p, extra }: { p: Pkg; extra?: string }) => (
    <li>
      <button type="button" onClick={() => onPick(p.tracking_number)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg px-2 py-1.5 text-left hover:bg-amber-100/70">
        <span className="font-mono text-[12px] font-semibold text-ink">{p.tracking_number}</span>
        <span className="text-[12px] text-mute">{p.customer_code} · {p.customer_name}</span>
        <span className="text-[11px] text-mute">{p.status}</span>
        <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
          {joursDepuisArrivee(p)} j à Miami{extra ? ` · ${extra}` : ""}
        </span>
      </button>
    </li>
  );

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <div className="flex flex-wrap items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1 space-y-0.5 text-[13px]">
          {vieux.length > 0 && (
            <p><b>{vieux.length} colis</b> à Miami depuis {SANS_CONDUCE_JOURS} jours ou plus, <b>sans Conduce</b>.</p>
          )}
          {tardifs.length > 0 && (
            <p><b>{tardifs.length} colis</b> ajoutés ces {AJOUT_RECENT_JOURS} derniers jours, mais arrivés à Miami {AJOUT_TARDIF_JOURS} jours ou plus avant.</p>
          )}
        </div>
        <button type="button" className="btn btn-ghost text-[12px]" onClick={() => setOpen((v) => !v)}>
          {open ? "Masquer" : "Voir les colis"}
        </button>
      </div>
      {open && (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {vieux.length > 0 && (
            <section>
              <h3 className="mb-1 text-[12px] font-bold uppercase tracking-wide text-amber-700">Sans Conduce depuis longtemps</h3>
              <ul className="max-h-72 overflow-y-auto">{vieux.map((p) => <Row key={p.id} p={p} />)}</ul>
            </section>
          )}
          {tardifs.length > 0 && (
            <section>
              <h3 className="mb-1 text-[12px] font-bold uppercase tracking-wide text-amber-700">Ajoutés en retard</h3>
              <ul className="max-h-72 overflow-y-auto">
                {tardifs.map((p) => <Row key={p.id} p={p} extra={`ajouté ${joursAvantAjout(p)} j après l'arrivée`} />)}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
