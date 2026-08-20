"use client";
/*
 * STANDA COMMERCIAL — Liste des Conduces (Faz 3)
 * Chak Conduce se yon gwoupman Package (Single Source of Truth — pa dwaplikaj).
 *
 * HISTORIQUE (V14):
 *   Depi TOUT koli nan yon conduce fin fakti, conduce a pase "Facturée" epi
 *   li SOTI nan onglè "En cours" pou l ale nan onglè "Historique".
 *   Statut la KALKILE depi koli yo (jamè yon chan dwaplike), epi li ekri nan
 *   bazdone a sèlman lè li chanje — konsa lòt paj yo wè menm verite a.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import RefreshButton from "@/components/RefreshButton";
import Loader from "@/components/Loader";
import { ClipboardList, ExternalLink } from "lucide-react";
import { deriveConduceStatus, getConduces, getConduceStats, setConduceStatus } from "@/lib/db";
import { dateFr } from "@/lib/utils";
import type { Conduce } from "@/lib/types";

interface Row extends Conduce {
  count: number; weight: number; facturedCount: number; verifiedCount: number;
}

export default function ConducesPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"actives" | "historique">("actives");

  const load = async () => {
    try {
      const list = await getConduces();
      const withStats = await Promise.all(list.map(async (c) => {
        const s = await getConduceStats(c.id);
        // Statut DERIVE depi koli yo — sous verite inik.
        const derived = deriveConduceStatus(s.count, s.facturedCount);
        // Sinkronize bazdone a sèlman si li chanje (evite ekriti initil).
        if (derived !== c.status) {
          try { await setConduceStatus(c.id, derived); } catch { /* pa bloke afichaj la */ }
        }
        return {
          ...c, status: derived,
          count: s.count, weight: s.weight,
          facturedCount: s.facturedCount, verifiedCount: s.verifiedCount
        };
      }));
      setRows(withStats);
    } catch { setRows([]); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const all = rows ?? [];
  /** Conduce ki gen TOUT koli li fakti -> Historique. Rès la -> En cours. */
  const estArchive = (r: Row) => r.status === "Facturée";
  const actives = all.filter((r) => !estArchive(r));
  const historique = all.filter(estArchive);

  const filtered = (tab === "actives" ? actives : historique).filter((r) =>
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
        <div className="flex gap-2 items-center">
          <input className="input w-64" placeholder="Rechercher un numéro, office…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <RefreshButton onRefresh={load} />
        </div>
      </div>

      {/* Onglè: En cours / Historique */}
      <div className="flex gap-1 border-b border-line">
        {([["actives", "En cours", actives.length], ["historique", "Historique", historique.length]] as const).map(
          ([k, label, n]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
                tab === k ? "border-navy text-navy" : "border-transparent text-mute hover:text-ink"}`}>
              {label} <span className="text-xs font-normal">({n})</span>
            </button>
          ))}
      </div>

      {tab === "historique" && (
        <p className="text-xs text-mute">
          Conduces dont <b>tous les colis sont facturés</b>. Elles restent consultables mais
          n&apos;encombrent plus la liste de travail.
        </p>
      )}

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
              <tr><td colSpan={9} className="py-4"><Loader inline size={56} /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-mute">
                {tab === "historique"
                  ? "Aucune conduce entièrement facturée pour le moment."
                  : <>Aucune conduce en cours. Utilisez <Link href="/sync" className="text-navy underline font-semibold">Synchronisation → Importer des Conduces</Link>.</>}
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
                    : r.status === "Facturée"
                      ? <span className="pill pill-green"><span className="pill-dot" />Facturée</span>
                      : <span className="pill pill-blue"><span className="pill-dot" />{r.status}</span>}
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
