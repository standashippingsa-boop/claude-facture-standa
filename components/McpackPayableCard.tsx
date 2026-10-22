"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, History, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/authx";
import { getConduces, getMcpackInvoices } from "@/lib/db";
import type { Conduce, McpackInvoice } from "@/lib/types";

/**
 * À PAYER À MCPACK — part STANDA et part Ergens (Dokasav, Blic Express).
 *
 * Règles :
 *  - Seuls les colis rattachés à une Conduce comptent (un colis hors Conduce est ignoré).
 *  - « À payer » = Conduces dont le paiement MCPACK n'est pas validé (payment_status ≠ « Payé »).
 *    Dès que la Conduce (ou sa facture MCPACK) est marquée payée, ses livres passent
 *    dans l'historique et le compteur repart avec les Conduces suivantes.
 *  - Tous les clients sont à STANDA sauf les comptes Ergens, reconnus par leur nom
 *    (fiche client ou nom MCPACK du colis) : Dokasav et Blic Express.
 *  - Montant = livres × tarif MCPACK.
 * Lecture seule : rien n'est écrit ici. Le paiement se valide dans Conduces.
 */
const RATE_USD_PER_LB = 3;
type ShareKey = "standa" | "dokasav" | "blic";
const SHARES: Array<{ key: ShareKey; label: string; color: string; match?: RegExp }> = [
  { key: "standa", label: "STANDA", color: "#1d4ed8" },
  { key: "dokasav", label: "Dokasav", color: "#e85e19", match: /doka\s*-?\s*sav/i },
  { key: "blic", label: "Blic Express", color: "#0f9f8f", match: /\bblic\b/i }
];
type Lbs = Record<ShareKey, number>;
type ParcelRow = { conduce_id: string; customer_code: string | null; customer_name: string | null; weight: number | string | null; archived?: boolean | null };
type ConduceLine = { conduce: Conduce; lbs: Lbs; total: number; invoiced: boolean; invoiceId: string | null };
type HistoryEntry = { key: string; label: string; paidAt: string; lines: ConduceLine[]; lbs: Lbs };

const zero = (): Lbs => ({ standa: 0, dokasav: 0, blic: 0 });
const sumLbs = (rows: Lbs[]) => rows.reduce((acc, row) => ({ standa: acc.standa + row.standa, dokasav: acc.dokasav + row.dokasav, blic: acc.blic + row.blic }), zero());
const totalOf = (lbs: Lbs) => lbs.standa + lbs.dokasav + lbs.blic;
const fmtLb = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} lb`;
const fmtUsd = (value: number) => "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Une date seule (« 2026-10-20 ») se lit en heure locale : sinon Haïti (UTC-4) affiche la veille.
const fmtDate = (value: string) => value
  ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T12:00:00" : value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
  : "—";

/** Tous les colis des Conduces, page par page (Supabase plafonne chaque lecture à 1000 lignes). */
async function loadConduceParcels(conduceIds: string[]): Promise<ParcelRow[]> {
  const out: ParcelRow[] = [];
  for (let i = 0; i < conduceIds.length; i += 100) {
    const chunk = conduceIds.slice(i, i + 100);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("packages")
        .select("id, conduce_id, customer_code, customer_name, weight, archived")
        .in("conduce_id", chunk).order("id", { ascending: true }).range(from, from + 999);
      if (error) throw error;
      out.push(...((data ?? []) as ParcelRow[]));
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}

export default function McpackPayableCard() {
  const { role } = useRole();
  const [state, setState] = useState<{ conduces: Conduce[]; invoices: McpackInvoice[]; parcels: ParcelRow[]; clientNames: Map<string, string> } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [historyCount, setHistoryCount] = useState(6);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [conduces, invoices, clients] = await Promise.all([
        getConduces(),
        getMcpackInvoices().catch(() => [] as McpackInvoice[]),
        supabase.from("clients").select("customer_code, fullname").then(({ data }: { data: Array<{ customer_code: string | null; fullname: string | null }> | null }) => data ?? [])
      ]);
      const parcels = await loadConduceParcels(conduces.map((conduce) => conduce.id));
      const clientNames = new Map(clients.map((client) => [String(client.customer_code ?? "").toUpperCase(), String(client.fullname ?? "")]));
      setState({ conduces, invoices, parcels, clientNames });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (role === "admin") void load(); }, [role, load]);

  const view = useMemo(() => {
    if (!state) return null;
    // 1) Comptes Ergens : un code client dont la fiche OU un colis porte le nom Dokasav / Blic.
    const accountOf = new Map<string, ShareKey>();
    const detected = new Map<string, { key: ShareKey; name: string }>();
    const tag = (code: string, name: string) => {
      const clean = code.trim().toUpperCase();
      if (!clean || !name) return;
      for (const share of SHARES) if (share.match?.test(name)) { accountOf.set(clean, share.key); if (!detected.has(clean)) detected.set(clean, { key: share.key, name }); }
    };
    state.clientNames.forEach((name, code) => tag(code, name));
    for (const parcel of state.parcels) tag(String(parcel.customer_code ?? ""), String(parcel.customer_name ?? ""));

    // 2) Livres par Conduce et par part.
    const byConduce = new Map<string, Lbs>();
    for (const parcel of state.parcels) {
      if (parcel.archived) continue;
      const lbs = byConduce.get(parcel.conduce_id) ?? zero();
      const key = accountOf.get(String(parcel.customer_code ?? "").trim().toUpperCase()) ?? "standa";
      lbs[key] += Number(parcel.weight) || 0;
      byConduce.set(parcel.conduce_id, lbs);
    }
    const invoiceOf = new Map<string, McpackInvoice>();
    for (const invoice of state.invoices) for (const link of invoice.conduces) invoiceOf.set(link.conduce_id, invoice);
    const lines: ConduceLine[] = state.conduces.map((conduce) => {
      const lbs = byConduce.get(conduce.id) ?? zero();
      const invoice = invoiceOf.get(conduce.id);
      return { conduce, lbs, total: totalOf(lbs), invoiced: Boolean(invoice), invoiceId: invoice?.id ?? null };
    }).filter((line) => line.total > 0);

    // 3) En cours = pas encore payé. Historique = payé, regroupé par facture MCPACK (ou par jour de paiement).
    const pending = lines.filter((line) => line.conduce.payment_status !== "Payé")
      .sort((a, b) => String(b.conduce.conduce_date ?? b.conduce.created_at).localeCompare(String(a.conduce.conduce_date ?? a.conduce.created_at)));
    const groups = new Map<string, HistoryEntry>();
    for (const line of lines.filter((item) => item.conduce.payment_status === "Payé")) {
      const paidAt = line.conduce.payment_paid_at ?? "";
      const invoice = line.invoiceId ? state.invoices.find((item) => item.id === line.invoiceId) : undefined;
      const key = invoice ? "inv:" + invoice.id : "day:" + paidAt.slice(0, 10);
      const entry = groups.get(key) ?? { key, label: invoice ? (invoice.file_name || "Facture MCPACK") : "Paiement MCPACK", paidAt, lines: [], lbs: zero() };
      entry.lines.push(line);
      if (paidAt > entry.paidAt) entry.paidAt = paidAt;
      groups.set(key, entry);
    }
    const history = Array.from(groups.values()).map((entry) => ({ ...entry, lbs: sumLbs(entry.lines.map((line) => line.lbs)) }))
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
    const pendingLbs = sumLbs(pending.map((line) => line.lbs));
    const invoicedLbs = totalOf(sumLbs(pending.filter((line) => line.invoiced).map((line) => line.lbs)));
    return { pending, pendingLbs, invoicedLbs, invoicedCount: pending.filter((line) => line.invoiced).length, history, detected: Array.from(detected.entries()) };
  }, [state]);

  if (role !== "admin") return null;

  const total = view ? totalOf(view.pendingLbs) : 0;
  const ergens = view ? view.pendingLbs.dokasav + view.pendingLbs.blic : 0;

  return <section className="space-y-3" aria-label="À payer à MCPACK">
    <div className="flex items-center justify-between gap-3">
      <h2 className="h-sec">À payer à MCPACK</h2>
      <div className="flex items-center gap-3">
        <Link href="/conduces" className="text-xs font-semibold text-navy hover:underline">Valider un paiement</Link>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Actualiser" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button>
      </div>
    </div>

    {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {!view && !error && <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />}

    {view && <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      {/* Solde comme sur une app bancaire */}
      <div className="rounded-2xl bg-[#0b2a5b] p-5 text-white">
        <p className="text-[13px] text-white/70">Total à payer · {view.pending.length} conduce{view.pending.length > 1 ? "s" : ""} non payée{view.pending.length > 1 ? "s" : ""}</p>
        <p className="mt-1 text-[34px] font-semibold leading-tight tracking-tight tabular-nums">{fmtUsd(total * RATE_USD_PER_LB)}</p>
        <p className="text-sm text-white/75 tabular-nums">{fmtLb(total)} × {fmtUsd(RATE_USD_PER_LB)} / lb</p>

        {total > 0 && <>
          <div className="mt-5 flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-white/10" role="img" aria-label={SHARES.map((share) => `${share.label} ${fmtLb(view.pendingLbs[share.key])}`).join(", ")}>
            {SHARES.map((share) => view.pendingLbs[share.key] > 0 && <span key={share.key} title={`${share.label} · ${fmtLb(view.pendingLbs[share.key])} · ${fmtUsd(view.pendingLbs[share.key] * RATE_USD_PER_LB)}`}
              className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(view.pendingLbs[share.key] / total) * 100}%`, background: share.key === "standa" ? "#7aa2ff" : share.color }} />)}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {SHARES.map((share) => <div key={share.key} className="min-w-0">
              <p className="flex items-center gap-1.5 text-[12px] text-white/70"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: share.key === "standa" ? "#7aa2ff" : share.color }} />{share.label}</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">{fmtUsd(view.pendingLbs[share.key] * RATE_USD_PER_LB)}</p>
              <p className="text-[11px] text-white/60 tabular-nums">{fmtLb(view.pendingLbs[share.key])}</p>
            </div>)}
          </div>
        </>}
        {total === 0 && <p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-sm text-white/85">Toutes les conduces sont payées. Rien à régler pour le moment.</p>}
      </div>

      {/* Résumé : notre part / part Ergens / état de facturation */}
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
        <div className="divide-y divide-slate-100">
          <SummaryRow color={SHARES[0].color} label="Part STANDA (nous)" lbs={view.pendingLbs.standa} strong />
          <SummaryRow color="#64748b" label="Part Ergens" lbs={ergens} strong />
          <SummaryRow color={SHARES[1].color} label="Dokasav" lbs={view.pendingLbs.dokasav} indent />
          <SummaryRow color={SHARES[2].color} label="Blic Express" lbs={view.pendingLbs.blic} indent />
        </div>
        <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 text-center">
          <div className="px-3 py-3"><p className="text-[11px] text-slate-500">Facturé par MCPACK</p><p className="text-sm font-semibold tabular-nums text-slate-900">{fmtUsd(view.invoicedLbs * RATE_USD_PER_LB)}</p><p className="text-[11px] text-slate-400">{view.invoicedCount} conduce{view.invoicedCount > 1 ? "s" : ""}</p></div>
          <div className="px-3 py-3"><p className="text-[11px] text-slate-500">Pas encore facturé</p><p className="text-sm font-semibold tabular-nums text-slate-900">{fmtUsd((total - view.invoicedLbs) * RATE_USD_PER_LB)}</p><p className="text-[11px] text-slate-400">{view.pending.length - view.invoicedCount} conduce{view.pending.length - view.invoicedCount > 1 ? "s" : ""}</p></div>
        </div>
        <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] leading-relaxed text-slate-500">
          Comptes Ergens reconnus : {view.detected.length ? view.detected.map(([code, info]) => `${code} (${SHARES.find((share) => share.key === info.key)?.label})`).join(", ") : "aucun pour l’instant"}.
        </p>
      </div>
    </div>}

    {/* Détail par conduce */}
    {view && view.pending.length > 0 && <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
      <button type="button" onClick={() => setShowDetail((open) => !open)} aria-expanded={showDetail} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
        <span className="text-sm font-semibold text-slate-900">Détail par conduce</span>
        <ChevronDown size={18} className={`text-slate-400 transition ${showDetail ? "rotate-180" : ""}`} />
      </button>
      {showDetail && <div className="overflow-x-auto border-t border-slate-100">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] text-slate-500">{["Conduce", "État", "STANDA", "Dokasav", "Blic", "Montant"].map((head) => <th key={head} className={`px-4 py-2 font-medium ${head === "Conduce" || head === "État" ? "" : "text-right"}`}>{head}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{view.pending.map((line) => <tr key={line.conduce.id}>
            <td className="px-4 py-2.5"><Link href={`/conduces/${line.conduce.id}`} className="font-mono font-semibold text-navy hover:underline">{line.conduce.conduce_number}</Link><span className="block text-[11px] text-slate-400">{fmtDate(line.conduce.conduce_date ?? line.conduce.created_at)}</span></td>
            <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${line.invoiced ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{line.invoiced ? "Facturée" : "Non facturée"}</span></td>
            <td className="px-4 py-2.5 text-right tabular-nums">{fmtLb(line.lbs.standa)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{fmtLb(line.lbs.dokasav)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{fmtLb(line.lbs.blic)}</td>
            <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{fmtUsd(line.total * RATE_USD_PER_LB)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div>}

    {/* Historique des paiements MCPACK */}
    {view && view.history.length > 0 && <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
      <p className="flex items-center gap-2 px-4 pb-2 pt-3.5 text-sm font-semibold text-slate-900"><History size={16} className="text-slate-400" />Historique des paiements MCPACK</p>
      <div className="divide-y divide-slate-100">{view.history.slice(0, historyCount).map((entry) => {
        const lbs = totalOf(entry.lbs);
        const open = openHistory === entry.key;
        return <div key={entry.key}>
          <button type="button" onClick={() => setOpenHistory(open ? null : entry.key)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{entry.label}</span><span className="block text-xs text-slate-500">Payé le {fmtDate(entry.paidAt)} · {entry.lines.length} conduce{entry.lines.length > 1 ? "s" : ""} · {fmtLb(lbs)}</span></span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{fmtUsd(lbs * RATE_USD_PER_LB)}</span>
            <ChevronRight size={16} className={`shrink-0 text-slate-300 transition ${open ? "rotate-90" : ""}`} />
          </button>
          {open && <div className="grid grid-cols-3 gap-2 bg-slate-50 px-4 py-3 text-xs">
            {SHARES.map((share) => <div key={share.key}><p className="flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-full" style={{ background: share.color }} />{share.label}</p><p className="mt-0.5 font-semibold tabular-nums text-slate-900">{fmtUsd(entry.lbs[share.key] * RATE_USD_PER_LB)}</p><p className="tabular-nums text-slate-500">{fmtLb(entry.lbs[share.key])}</p></div>)}
            <p className="col-span-3 text-slate-500">Conduces : {entry.lines.map((line) => line.conduce.conduce_number).join(", ")}</p>
          </div>}
        </div>;
      })}</div>
      {view.history.length > historyCount && <button type="button" onClick={() => setHistoryCount((count) => count + 6)} className="w-full border-t border-slate-100 py-2.5 text-xs font-semibold text-navy hover:bg-slate-50">Voir plus</button>}
    </div>}
  </section>;
}

function SummaryRow({ color, label, lbs, strong = false, indent = false }: { color: string; label: string; lbs: number; strong?: boolean; indent?: boolean }) {
  return <div className={`flex items-center gap-3 py-3 pr-4 ${indent ? "pl-9" : "pl-4"}`}>
    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
    <span className={`min-w-0 flex-1 text-sm ${strong ? "font-semibold text-slate-900" : "text-slate-600"}`}>{label}</span>
    <span className="text-right"><span className={`block text-sm tabular-nums ${strong ? "font-semibold text-slate-900" : "text-slate-700"}`}>{fmtUsd(lbs * RATE_USD_PER_LB)}</span><span className="block text-[11px] tabular-nums text-slate-400">{fmtLb(lbs)}</span></span>
  </div>;
}
