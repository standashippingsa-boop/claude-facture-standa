"use client";
/*
 * STANDA COMMERCIAL — Liste des Conduces (Faz 3)
 * Chak Conduce se yon gwoupman Package (Single Source of Truth — pa dwaplikaj).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, ExternalLink } from "lucide-react";
import { getConduces, getConduceStats } from "@/lib/db";
import { dateFr } from "@/lib/utils";
import type { Conduce } from "@/lib/types";

interface Row extends Conduce {
  count: number; weight: number; facturedCount: number; verifiedCount: number;
}

export default function ConducesPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const list = await getConduces();
      const withStats = await Promise.all(list.map(async (c) => {
        const s = await getConduceStats(c.id);
        return { ...c, count: s.count, weight: s.weight, facturedCount: s.facturedCount, verifiedCount: s.verifiedCount };
      }));
      setRows(withStats);
    })().catch(() => setRows([]));
  }, []);

  const filtered = (rows ?? []).filter((r) =>
    !search.trim() || r.conduce_number.toLowerCase().includes(search.trim().toLowerCase()) ||
    (r.office ?? "").toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="h-page">Conduces</h1>
          <p className="text-sm text-mute mt-0.5">Manifestes MCPACK — groupes de colis (Caribe Tours)</p>
        </div>
        <input className="input w-64" placeholder="Rechercher un numéro, office…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr>
            {[
              { h: "Numéro", a: "text-left" },
              { h: "Office", a: "text-left" },
              { h: "Date", a: "text-left" },
              { h: "Colis", a: "text-right" },
              { h: "Poids", a: "text-right" },
              { h: "Facturés", a: "text-right" },
              { h: "Vérifiés", a: "text-right" },
              { h: "Statut", a: "text-left" },
              { h: "", a: "text-left w-full" },
            ].map((c) => <th key={c.h} className={`thc ${c.a}`}>{c.h}</th>)}
          </tr></thead>
          <tbody>
            {rows === null ? (
              <tr><td colSpan={9} className="text-center py-10 text-mute">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-mute">
                Aucune conduce. Utilisez <Link href="/sync" className="text-navy underline font-semibold">Synchronisation → Importer des Conduces</Link>.
              </td></tr>
            ) : filtered.map((r, i) => (
              <tr key={r.id} className={i % 2 ? "bg-mist" : ""}>
                <td className="tdc font-bold text-navy font-mono">{r.conduce_number}</td>
                <td className="tdc">{r.office || "—"}</td>
                <td className="tdc whitespace-nowrap">{r.conduce_date ? dateFr(r.conduce_date) : dateFr(r.created_at)}</td>
                <td className="tdc text-right font-semibold">{r.count}</td>
                <td className="tdc text-right whitespace-nowrap">{r.weight.toFixed(1)} lb</td>
                <td className="tdc text-right whitespace-nowrap">{r.facturedCount}/{r.count}</td>
                <td className="tdc text-right whitespace-nowrap">{r.verifiedCount}/{r.count}</td>
                <td className="tdc whitespace-nowrap">
                  {r.count === 0
                    ? <span className="pill pill-amber"><span className="pill-dot" />En attente</span>
                    : <span className="pill pill-gray"><span className="pill-dot" />{r.status}</span>}
                </td>
                <td className="tdc whitespace-nowrap">
                  <Link href={`/conduces/${r.id}`} className="inline-flex items-center gap-1 text-navy hover:underline font-semibold">
                    Ouvrir <ExternalLink size={13} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
