"use client";
/*
 * STANDA COMMERCIAL — CONDUCES · V16
 * ═══════════════════════════════════
 * Yon Conduce se yon manifest Caribe Tours: yon gwoup koli k ap vwayaje ansanm.
 * Single Source of Truth — statut la KALKILE depi koli yo, jamè dwaplike.
 *
 * DESIGN — sa paj la vle di:
 *   Yon conduce se yon LO k ap avanse nan yon pwosesis. Sa ki enpòtan pou ekip
 *   la se PA yon liy tablo — se KI KOTE lo a rive: konbyen koli fakti, konbyen
 *   verifye, konbyen rete. Donk chak conduce se yon KAT ak yon "rail"
 *   pwogresyon segmante (yon segman pa koli, jiska 40) — se siyati paj la.
 *   Ou wè eta yon lo an yon sèl kout je, san li chif.
 *
 *   • Kat espase (pa yon tablo sere) — chak conduce se yon objè, pa yon ranje
 *   • Bò dwat chak kat: yon ba koulè statut (vèt = fakti, ble = an kou, jòn = vid)
 *   • Seleksyon miltip -> bare aksyon flotan ki monte anba ekran an
 *   • Onglè "En cours / Historique": depi TOUT koli fakti, lo a soti nan travay
 *     kounye a epi li ale nan Historique.
 *
 * Palèt: mak STANDA sèlman (navy #122B5C + vèt #16A34A). Pa gen koulè enpòte.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Boxes, CheckCircle2, ClipboardList, FileDown, Search, X
} from "lucide-react";
import Loader from "@/components/Loader";
import RefreshButton from "@/components/RefreshButton";
import { deriveConduceStatus, getConduces, getConduceStats, setConduceStatus } from "@/lib/db";
import { dateFr } from "@/lib/utils";
import type { Conduce } from "@/lib/types";

interface Row extends Conduce {
  count: number; weight: number; facturedCount: number; verifiedCount: number;
}

export default function ConducesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"actives" | "historique">("actives");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const load = async () => {
    try {
      const list = await getConduces();
      const withStats = await Promise.all(list.map(async (c) => {
        const s = await getConduceStats(c.id);
        // Statut DERIVE depi koli yo — sous verite inik.
        const derived = deriveConduceStatus(s.count, s.facturedCount);
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
  const estArchive = (r: Row) => r.status === "Facturée";
  const actives = all.filter((r) => !estArchive(r));
  const historique = all.filter(estArchive);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (tab === "actives" ? actives : historique).filter((r) =>
      !needle || r.conduce_number.toLowerCase().includes(needle) ||
      (r.office ?? "").toLowerCase().includes(needle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, tab, search]);

  // Rezime lo aktif yo — chif ki gide travay jounen an
  const enCoursKoli = actives.reduce((s, r) => s + r.count, 0);
  const enCoursRete = actives.reduce((s, r) => s + (r.count - r.facturedCount), 0);
  const enCoursPoids = actives.reduce((s, r) => s + r.weight, 0);

  const toggle = (id: string) =>
    setSel((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (rows === null) return <Loader inline />;

  return (
    <div className="space-y-5 pb-28">

      {/* ══ Antèt ══ */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="h-page flex items-center gap-2"><ClipboardList size={22} /> Conduces</h1>
          <p className="text-sm text-mute mt-0.5">Manifestes MCPACK — lots de colis en transport</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input w-64 !pl-9" placeholder="Numéro, office…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink">
                <X size={14} />
              </button>
            )}
          </div>
          <RefreshButton onRefresh={load} />
        </div>
      </div>

      {/* ══ Rezime lo aktif yo ══ */}
      {actives.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            ["Lots en cours", String(actives.length), "text-ink"],
            ["Colis à facturer", String(enCoursRete), enCoursRete > 0 ? "text-navy" : "text-ink"],
            ["Colis au total", String(enCoursKoli), "text-ink"],
            ["Poids", `${enCoursPoids.toFixed(0)} lb`, "text-ink"]
          ] as const).map(([label, val, cls]) => (
            <div key={label} className="card px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-mute">{label}</p>
              <p className={`text-2xl font-extrabold leading-tight mt-0.5 ${cls}`}>{val}</p>
            </div>
          ))}
        </div>
      )}

      {/* ══ Onglè ══ */}
      <div className="flex gap-1 border-b border-line">
        {([["actives", "En cours", actives.length], ["historique", "Historique", historique.length]] as const).map(
          ([k, label, n]) => (
            <button key={k} onClick={() => { setTab(k); setSel(new Set()); }}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
                tab === k ? "border-navy text-navy" : "border-transparent text-mute hover:text-ink"}`}>
              {label} <span className="text-xs font-normal">({n})</span>
            </button>
          ))}
      </div>

      {tab === "historique" && (
        <p className="text-xs text-mute">
          Lots dont <b>tous les colis sont facturés</b>. Consultables, mais retirés de la liste de travail.
        </p>
      )}

      {/* ══ Kat conduce yo ══ */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Boxes size={32} className="mx-auto text-slate-300" />
          <p className="text-sm text-mute mt-3">
            {search.trim()
              ? <>Aucun lot ne correspond à «&nbsp;{search.trim()}&nbsp;».</>
              : tab === "historique"
                ? "Aucun lot entièrement facturé pour le moment."
                : <>Aucun lot en cours. Importez-en depuis{" "}
                    <Link href="/sync" className="text-navy underline font-semibold">Synchronisation</Link>.</>}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((r) => (
            <ConduceCard key={r.id} r={r} checked={sel.has(r.id)}
              onCheck={() => toggle(r.id)}
              onOpen={() => router.push(`/conduces/${r.id}`)} />
          ))}
        </div>
      )}

      {/* ══ Bare aksyon flotan ══ */}
      {sel.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
          <div className="mx-auto max-w-3xl p-4 pointer-events-auto">
            <div className="rounded-2xl bg-navy text-white shadow-lift px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className="font-bold text-sm">{sel.size} lot{sel.size > 1 ? "s" : ""} sélectionné{sel.size > 1 ? "s" : ""}</span>
              <span className="text-[11px] text-white/60 hidden sm:inline">
                {filtered.filter((r) => sel.has(r.id)).reduce((s, r) => s + r.count, 0)} colis ·{" "}
                {filtered.filter((r) => sel.has(r.id)).reduce((s, r) => s + r.weight, 0).toFixed(0)} lb
              </span>
              <div className="flex-1" />
              <Link href="/bon-remise"
                className="rounded-lg bg-white text-navy font-bold text-xs px-3 py-2 inline-flex items-center gap-1.5 hover:bg-white/90">
                <FileDown size={14} /> Bon de Remise
              </Link>
              <button onClick={() => setSel(new Set())}
                className="rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-2">
                Effacer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * KAT CONDUCE — siyati paj la: yon "rail" pwogresyon segmante, yon segman pa
 * koli (jiska 40, apre sa yon ba kontini). Segman vèt = koli fakti.
 * Se pwogresyon reyèl lo a, pa yon dekorasyon.
 */
function ConduceCard({ r, checked, onCheck, onOpen }: {
  r: Row; checked: boolean; onCheck: () => void; onOpen: () => void;
}) {
  const vide = r.count === 0;
  const fini = r.facturedCount >= r.count && r.count > 0;
  const pct = r.count ? Math.round((r.facturedCount / r.count) * 100) : 0;

  const accent = vide ? "bg-amber-400" : fini ? "bg-brand" : "bg-navy-light";
  const segments = Math.min(r.count, 40);

  return (
    <div
      onClick={onOpen}
      className={`relative card card-hover overflow-hidden cursor-pointer transition
        ${checked ? "ring-2 ring-navy" : ""}`}>

      {/* Ba statut sou bò dwat la */}
      <span className={`absolute right-0 inset-y-0 w-1.5 ${accent}`} aria-hidden />

      <div className="flex items-start gap-3 p-4 pr-6">
        <input type="checkbox" className="mt-1 w-4 h-4 shrink-0" checked={checked}
          onClick={(e) => e.stopPropagation()} onChange={onCheck}
          aria-label={`Sélectionner ${r.conduce_number}`} />

        <div className="min-w-0 flex-1">
          {/* Liy 1: nimewo + statut */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-extrabold text-navy text-[15px]">{r.conduce_number}</span>
            {vide
              ? <span className="pill pill-amber"><span className="pill-dot" />En attente</span>
              : fini
                ? <span className="pill pill-green"><CheckCircle2 size={11} />Facturée</span>
                : <span className="pill pill-blue"><span className="pill-dot" />En cours</span>}
          </div>

          {/* Liy 2: kontèks */}
          <p className="text-[11px] text-mute mt-0.5 truncate">
            {r.office || "Office —"} · {r.conduce_date ? dateFr(r.conduce_date) : dateFr(r.created_at)}
          </p>

          {/* Rail pwogresyon — siyati a */}
          {!vide && (
            <div className="mt-3">
              <div className="flex gap-[2px] h-2" aria-hidden>
                {segments <= 40 ? (
                  Array.from({ length: segments }).map((_, i) => (
                    <span key={i}
                      className={`flex-1 rounded-[1px] ${
                        i < Math.round((r.facturedCount / r.count) * segments) ? "bg-brand" : "bg-line"}`} />
                  ))
                ) : (
                  <span className="flex-1 rounded-full bg-line overflow-hidden">
                    <span className="block h-full bg-brand" style={{ width: `${pct}%` }} />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 text-[11px] flex-wrap">
                <span className="text-ink font-semibold">{r.facturedCount}/{r.count} facturés</span>
                <span className="text-mute">{r.verifiedCount}/{r.count} vérifiés</span>
                <span className="text-mute">{r.weight.toFixed(1)} lb</span>
              </div>
            </div>
          )}

          {vide && (
            <p className="text-[11px] text-amber-700 mt-2">
              Lot créé, colis pas encore synchronisés depuis MCPACK.
            </p>
          )}
        </div>

        <ArrowRight size={16} className="text-slate-300 shrink-0 mt-1" />
      </div>
    </div>
  );
}
