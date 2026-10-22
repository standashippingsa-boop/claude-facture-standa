"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarRange, CheckCircle2, ChevronDown, ChevronRight, FileText, History, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/authx";
import { getConduces, getMcpackInvoices } from "@/lib/db";
import { loadMcpackSettings, periodKey, saveMcpackPeriod, setErgensReceipt, type McpackSettings } from "@/lib/mcpack-payable";
import type { Conduce, McpackInvoice } from "@/lib/types";
import { notify } from "@/lib/notify";

/**
 * À PAYER À MCPACK — part STANDA et part Ergens (Dokasav, Blic Express), sur une PÉRIODE.
 *
 * Règles :
 *  - Seuls les colis rattachés à une Conduce comptent (un colis hors Conduce est ignoré).
 *  - La période (dates de Conduce, réglée par l'admin) délimite le lot à payer.
 *    « À payer » = Conduces de la période dont le paiement MCPACK n'est pas validé.
 *    Dès qu'une Conduce (ou sa facture MCPACK) est marquée payée, ses livres passent
 *    dans l'historique. Les Conduces après la période attendent le prochain lot.
 *  - Comptes Ergens : codes réglés dans Paramètres ; sans réglage, reconnaissance par le nom
 *    (fiche client ou nom MCPACK du colis). Tous les autres clients sont à STANDA.
 *  - Montant = livres × tarif (Paramètres, 3 $ par défaut).
 */
type ShareKey = "standa" | "dokasav" | "blic";
const SHARES: Array<{ key: ShareKey; label: string; color: string; onNavy: string; match?: RegExp }> = [
  { key: "standa", label: "STANDA", color: "#1d4ed8", onNavy: "#7aa2ff" },
  { key: "dokasav", label: "Dokasav", color: "#e85e19", onNavy: "#e85e19", match: /doka\s*-?\s*sav/i },
  { key: "blic", label: "Blic Express", color: "#0f9f8f", onNavy: "#0f9f8f", match: /\bblic\b/i }
];
type Lbs = Record<ShareKey, number>;
type ParcelRow = { conduce_id: string; customer_code: string | null; customer_name: string | null; weight: number | string | null; archived?: boolean | null };
type ConduceLine = { conduce: Conduce; day: string; lbs: Lbs; total: number; invoiced: boolean; invoiceId: string | null };
type HistoryEntry = { key: string; label: string; paidAt: string; lines: ConduceLine[]; lbs: Lbs };

const zero = (): Lbs => ({ standa: 0, dokasav: 0, blic: 0 });
const sumLbs = (rows: Lbs[]) => rows.reduce((acc, row) => ({ standa: acc.standa + row.standa, dokasav: acc.dokasav + row.dokasav, blic: acc.blic + row.blic }), zero());
const totalOf = (lbs: Lbs) => lbs.standa + lbs.dokasav + lbs.blic;
const fmtLb = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} lb`;
const fmtUsd = (value: number) => "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Une date seule (« 2026-10-20 ») se lit en heure locale : sinon Haïti (UTC-4) affiche la veille.
const fmtDate = (value: string, withYear = true) => value
  ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T12:00:00" : value).toLocaleDateString("fr-FR", withYear ? { weekday: "short", day: "numeric", month: "short", year: "numeric" } : { weekday: "short", day: "numeric", month: "short" })
  : "—";
const localDay = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const nextDay = (day: string) => { const d = new Date(day + "T12:00:00"); d.setDate(d.getDate() + 1); return localDay(d.toISOString()); };
/** Jour de la Conduce : sa date MCPACK, sinon le jour d'import. */
const conduceDay = (conduce: Conduce) => /^\d{4}-\d{2}-\d{2}/.test(String(conduce.conduce_date ?? "")) ? String(conduce.conduce_date).slice(0, 10) : localDay(conduce.created_at);

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
  const { role, staff } = useRole();
  const [state, setState] = useState<{ conduces: Conduce[]; invoices: McpackInvoice[]; parcels: ParcelRow[]; clientNames: Map<string, string>; settings: McpackSettings } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  // Historique replié par défaut : il s'ouvre avec son bouton.
  const [showHistory, setShowHistory] = useState(false);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [historyCount, setHistoryCount] = useState(6);
  const [editPeriod, setEditPeriod] = useState<{ start: string; end: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const staffName = staff ? `${staff.prenom ?? ""} ${staff.nom ?? ""}`.trim() || staff.username : "";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [conduces, invoices, clients, settings] = await Promise.all([
        getConduces(),
        getMcpackInvoices().catch(() => [] as McpackInvoice[]),
        supabase.from("clients").select("customer_code, fullname").then(({ data }: { data: Array<{ customer_code: string | null; fullname: string | null }> | null }) => data ?? []),
        loadMcpackSettings()
      ]);
      const parcels = await loadConduceParcels(conduces.map((conduce) => conduce.id));
      const clientNames = new Map(clients.map((client) => [String(client.customer_code ?? "").toUpperCase(), String(client.fullname ?? "")]));
      setState({ conduces, invoices, parcels, clientNames, settings });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (role === "admin") void load(); }, [role, load]);

  const view = useMemo(() => {
    if (!state) return null;
    const { settings } = state;
    // 1) Comptes Ergens : codes réglés, sinon nom (fiche client ou nom MCPACK du colis).
    const accountOf = new Map<string, ShareKey>();
    const detected = new Map<string, ShareKey>();
    for (const share of SHARES) {
      if (share.key === "standa") continue;
      const fixed = settings.codes[share.key];
      if (fixed.length) { for (const code of fixed) { accountOf.set(code, share.key); detected.set(code, share.key); } continue; }
      const tag = (code: string, name: string) => {
        const clean = code.trim().toUpperCase();
        if (clean && name && share.match?.test(name)) { accountOf.set(clean, share.key); detected.set(clean, share.key); }
      };
      state.clientNames.forEach((name, code) => tag(code, name));
      for (const parcel of state.parcels) tag(String(parcel.customer_code ?? ""), String(parcel.customer_name ?? ""));
    }

    // 2) Livres par Conduce et par part.
    const byConduce = new Map<string, Lbs>();
    for (const parcel of state.parcels) {
      if (parcel.archived) continue;
      const lbs = byConduce.get(parcel.conduce_id) ?? zero();
      lbs[accountOf.get(String(parcel.customer_code ?? "").trim().toUpperCase()) ?? "standa"] += Number(parcel.weight) || 0;
      byConduce.set(parcel.conduce_id, lbs);
    }
    const invoiceOf = new Map<string, McpackInvoice>();
    for (const invoice of state.invoices) for (const link of invoice.conduces) invoiceOf.set(link.conduce_id, invoice);
    const lines: ConduceLine[] = state.conduces.map((conduce) => {
      const lbs = byConduce.get(conduce.id) ?? zero();
      const invoice = invoiceOf.get(conduce.id);
      return { conduce, day: conduceDay(conduce), lbs, total: totalOf(lbs), invoiced: Boolean(invoice), invoiceId: invoice?.id ?? null };
    }).filter((line) => line.total > 0);

    // 3) Période : à payer / déjà payé dans la période / après la période / avant (ignoré).
    const { start, end } = settings.period;
    const unpaid = lines.filter((line) => line.conduce.payment_status !== "Payé");
    const inPeriod = (line: ConduceLine) => line.day >= start && line.day <= end;
    const pending = unpaid.filter(inPeriod).sort((a, b) => b.day.localeCompare(a.day));
    const paidInPeriod = lines.filter((line) => line.conduce.payment_status === "Payé" && inPeriod(line));
    const after = unpaid.filter((line) => line.day > end);
    const before = unpaid.filter((line) => line.day < start);

    // 4) Historique : payé, regroupé par facture MCPACK (ou par jour de paiement).
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
    const periodLbs = sumLbs([...pending, ...paidInPeriod].map((line) => line.lbs));
    const invoiced = pending.filter((line) => line.invoiced);
    return {
      rate: settings.rate, period: settings.period, receipt: settings.receipts[periodKey(settings.period)] ?? null,
      pending, pendingLbs, periodLbs, paidInPeriod,
      invoicedLbs: totalOf(sumLbs(invoiced.map((line) => line.lbs))), invoicedCount: invoiced.length,
      after: { count: after.length, lbs: totalOf(sumLbs(after.map((line) => line.lbs))), lastDay: after.reduce((max, line) => line.day > max ? line.day : max, "") },
      before: { count: before.length, lbs: totalOf(sumLbs(before.map((line) => line.lbs))) },
      history, detected: Array.from(detected.entries()), fixedCodes: Boolean(settings.codes.dokasav.length || settings.codes.blic.length)
    };
  }, [state]);

  if (role !== "admin") return null;

  const savePeriod = async (start: string, end: string) => {
    setBusy(true);
    try { await saveMcpackPeriod(start, end); setEditPeriod(null); await load(); }
    catch (e) { notify.error(e instanceof Error ? e.message : "Période non enregistrée.", { title: "Période MCPACK" }); }
    finally { setBusy(false); }
  };
  const toggleReceipt = async () => {
    if (!view) return;
    const ergensDue = (view.periodLbs.dokasav + view.periodLbs.blic) * view.rate;
    const key = periodKey(view.period);
    if (view.receipt) { if (!confirm("Annuler l’enregistrement de la part Ergens reçue pour cette période ?")) return; }
    else if (!confirm(`Confirmer qu’Ergens a remis sa part : ${fmtUsd(ergensDue)} (Dokasav + Blic Express) ?`)) return;
    setBusy(true);
    try { await setErgensReceipt(key, view.receipt ? null : { amount: ergensDue, at: new Date().toISOString(), by: staffName }); await load(); }
    catch (e) { notify.error(e instanceof Error ? e.message : "Enregistrement impossible.", { title: "Part Ergens" }); }
    finally { setBusy(false); }
  };
  /** Relevé imprimable (Enregistrer en PDF) de la part Ergens de la période. */
  const printStatement = () => {
    if (!view) return;
    const rows = [...view.pending, ...view.paidInPeriod].filter((line) => line.lbs.dokasav + line.lbs.blic > 0).sort((a, b) => a.day.localeCompare(b.day));
    const esc = (value: string) => value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
    const win = window.open("", "_blank");
    if (!win) { notify.error("Autorisez les fenêtres pour ce site afin d’ouvrir le relevé.", { title: "Relevé Ergens" }); return; }
    const total = view.periodLbs.dokasav + view.periodLbs.blic;
    win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Relevé Ergens ${esc(view.period.start)} au ${esc(view.period.end)}</title>
<style>body{font-family:Arial,sans-serif;color:#0f172a;margin:32px}h1{font-size:20px;margin:0}p{margin:4px 0;color:#475569;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:18px;font-size:13px}th,td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:right}th:first-child,td:first-child{text-align:left}th{background:#0b2a5b;color:#fff}tfoot td{font-weight:bold;border-top:2px solid #0b2a5b}.box{margin-top:18px;padding:12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px}</style></head><body>
<h1>STANDA COMMERCIAL — Relevé MCPACK · Part Ergens</h1>
<p>Période : ${esc(fmtDate(view.period.start))} au ${esc(fmtDate(view.period.end))} · Tarif MCPACK : ${fmtUsd(view.rate)} / lb</p>
<table><thead><tr><th>Conduce</th><th>Date</th><th>Dokasav</th><th>Blic Express</th><th>Montant</th></tr></thead><tbody>
${rows.map((line) => `<tr><td>${esc(line.conduce.conduce_number)}</td><td>${esc(fmtDate(line.day))}</td><td>${fmtLb(line.lbs.dokasav)}</td><td>${fmtLb(line.lbs.blic)}</td><td>${fmtUsd((line.lbs.dokasav + line.lbs.blic) * view.rate)}</td></tr>`).join("")}
</tbody><tfoot><tr><td>Total</td><td></td><td>${fmtLb(view.periodLbs.dokasav)}</td><td>${fmtLb(view.periodLbs.blic)}</td><td>${fmtUsd(total * view.rate)}</td></tr></tfoot></table>
<div class="box">Dokasav : <b>${fmtUsd(view.periodLbs.dokasav * view.rate)}</b> · Blic Express : <b>${fmtUsd(view.periodLbs.blic * view.rate)}</b> · Total Ergens : <b>${fmtUsd(total * view.rate)}</b>${view.receipt ? `<br>Part reçue le ${esc(fmtDate(view.receipt.at))}${view.receipt.by ? " par " + esc(view.receipt.by) : ""}.` : ""}</div>
<p style="margin-top:14px">Édité le ${esc(new Date().toLocaleString("fr-FR"))}</p>
<script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
  };

  const total = view ? totalOf(view.pendingLbs) : 0;
  const ergensPeriod = view ? view.periodLbs.dokasav + view.periodLbs.blic : 0;
  const periodDone = Boolean(view && view.pending.length === 0 && view.paidInPeriod.length > 0);

  return <section className="space-y-3" aria-label="À payer à MCPACK">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="h-sec">À payer à MCPACK</h2>
      <div className="flex items-center gap-3">
        <Link href="/conduces" className="text-xs font-semibold text-navy hover:underline">Valider un paiement</Link>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Actualiser" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button>
      </div>
    </div>

    {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    {!view && !error && <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />}

    {view && <>
      {/* Période suivie */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200/70">
        <CalendarRange size={17} className="shrink-0 text-slate-400" />
        {editPeriod
          ? <form className="flex flex-1 flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void savePeriod(editPeriod.start, editPeriod.end); }}>
              <input type="date" className="input !h-9 !w-auto" value={editPeriod.start} onChange={(e) => setEditPeriod({ ...editPeriod, start: e.target.value })} aria-label="Début de la période" />
              <span className="text-xs text-slate-500">au</span>
              <input type="date" className="input !h-9 !w-auto" value={editPeriod.end} onChange={(e) => setEditPeriod({ ...editPeriod, end: e.target.value })} aria-label="Fin de la période" />
              <button type="submit" disabled={busy} className="btn !h-9 !py-0 text-xs">Enregistrer</button>
              <button type="button" onClick={() => setEditPeriod(null)} className="btn btn-ghost !h-9 !py-0 text-xs">Annuler</button>
            </form>
          : <>
              <p className="min-w-0 flex-1 text-sm text-slate-700">Conduces du <b className="text-slate-900">{fmtDate(view.period.start)}</b> au <b className="text-slate-900">{fmtDate(view.period.end)}</b></p>
              <button type="button" onClick={() => setEditPeriod({ ...view.period })} className="text-xs font-semibold text-navy hover:underline">Modifier la période</button>
            </>}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Solde comme sur une app bancaire */}
        <div className="rounded-2xl bg-[#0b2a5b] p-5 text-white">
          <p className="text-[13px] text-white/70">Reste à payer · {view.pending.length} conduce{view.pending.length > 1 ? "s" : ""} non payée{view.pending.length > 1 ? "s" : ""}</p>
          <p className="mt-1 text-[34px] font-semibold leading-tight tracking-tight tabular-nums">{fmtUsd(total * view.rate)}</p>
          <p className="text-sm text-white/75 tabular-nums">{fmtLb(total)} × {fmtUsd(view.rate)} / lb</p>

          {total > 0 && <>
            <div className="mt-5 flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-white/10" role="img" aria-label={SHARES.map((share) => `${share.label} ${fmtLb(view.pendingLbs[share.key])}`).join(", ")}>
              {SHARES.map((share) => view.pendingLbs[share.key] > 0 && <span key={share.key} title={`${share.label} · ${fmtLb(view.pendingLbs[share.key])} · ${fmtUsd(view.pendingLbs[share.key] * view.rate)}`}
                className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(view.pendingLbs[share.key] / total) * 100}%`, background: share.onNavy }} />)}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {SHARES.map((share) => <div key={share.key} className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-[12px] text-white/70"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: share.onNavy }} />{share.label}</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">{fmtUsd(view.pendingLbs[share.key] * view.rate)}</p>
                <p className="text-[11px] text-white/60 tabular-nums">{fmtLb(view.pendingLbs[share.key])}</p>
              </div>)}
            </div>
          </>}
          {total === 0 && <div className="mt-4 rounded-xl bg-white/10 px-3 py-2.5 text-sm text-white/90">
            {periodDone ? "Toutes les conduces de la période sont payées." : "Aucune conduce non payée dans cette période."}
            {periodDone && <button type="button" disabled={busy} onClick={() => { const start = nextDay(view.period.end); void savePeriod(start, [start, view.after.lastDay, localDay(new Date().toISOString())].filter(Boolean).sort().pop() ?? start); }}
              className="mt-2 block rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#0b2a5b] disabled:opacity-60">Passer à la période suivante</button>}
          </div>}
          {view.after.count > 0 && <p className="mt-4 border-t border-white/15 pt-3 text-[12px] text-white/65">Après le {fmtDate(view.period.end, false)} : {view.after.count} conduce{view.after.count > 1 ? "s" : ""} · {fmtLb(view.after.lbs)} · {fmtUsd(view.after.lbs * view.rate)} (prochaine période)</p>}
        </div>

        {/* Résumé : notre part / part Ergens */}
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
          <div className="divide-y divide-slate-100">
            <SummaryRow color={SHARES[0].color} label="Part STANDA (nous)" value={view.pendingLbs.standa} rate={view.rate} strong />
            <SummaryRow color="#64748b" label="Part Ergens" value={view.pendingLbs.dokasav + view.pendingLbs.blic} rate={view.rate} strong />
            <SummaryRow color={SHARES[1].color} label="Dokasav" value={view.pendingLbs.dokasav} rate={view.rate} indent />
            <SummaryRow color={SHARES[2].color} label="Blic Express" value={view.pendingLbs.blic} rate={view.rate} indent />
          </div>
          <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 text-center">
            <div className="px-3 py-3"><p className="text-[11px] text-slate-500">Facturé par MCPACK</p><p className="text-sm font-semibold tabular-nums text-slate-900">{fmtUsd(view.invoicedLbs * view.rate)}</p><p className="text-[11px] text-slate-400">{view.invoicedCount} conduce{view.invoicedCount > 1 ? "s" : ""}</p></div>
            <div className="px-3 py-3"><p className="text-[11px] text-slate-500">Pas encore facturé</p><p className="text-sm font-semibold tabular-nums text-slate-900">{fmtUsd((total - view.invoicedLbs) * view.rate)}</p><p className="text-[11px] text-slate-400">{view.pending.length - view.invoicedCount} conduce{view.pending.length - view.invoicedCount > 1 ? "s" : ""}</p></div>
          </div>
          {/* Part Ergens de toute la période (payé ou non) : reçue ou pas, et relevé imprimable */}
          {ergensPeriod > 0 && <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3">
            {view.receipt
              ? <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 size={15} className="shrink-0" />Part Ergens reçue · {fmtUsd(view.receipt.amount)} · {fmtDate(view.receipt.at, false)}</p>
              : <p className="min-w-0 flex-1 text-xs text-slate-500">Part Ergens de la période : <b className="text-slate-800">{fmtUsd(ergensPeriod * view.rate)}</b></p>}
            <button type="button" disabled={busy} onClick={() => void toggleReceipt()} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-navy ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60">{view.receipt ? "Annuler" : "Marquer reçue"}</button>
            <button type="button" onClick={printStatement} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-navy ring-1 ring-slate-200 hover:bg-slate-50"><FileText size={13} />Relevé</button>
          </div>}
          <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] leading-relaxed text-slate-500">
            Comptes Ergens {view.fixedCodes ? "(Paramètres)" : "reconnus par le nom"} : {view.detected.length ? view.detected.map(([code, key]) => `${code} (${SHARES.find((share) => share.key === key)?.label})`).join(", ") : "aucun"}.
            {view.before.count > 0 && <> Hors période (avant le {fmtDate(view.period.start, false)}) : {view.before.count} conduce{view.before.count > 1 ? "s" : ""} non payée{view.before.count > 1 ? "s" : ""}, non comptée{view.before.count > 1 ? "s" : ""}.</>}
          </p>
        </div>
      </div>
    </>}

    {/* Détail par conduce */}
    {view && view.pending.length > 0 && <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
      <button type="button" onClick={() => setShowDetail((open) => !open)} aria-expanded={showDetail} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
        <span className="text-sm font-semibold text-slate-900">Détail par conduce · {view.pending.length}</span>
        <ChevronDown size={18} className={`text-slate-400 transition ${showDetail ? "rotate-180" : ""}`} />
      </button>
      {showDetail && <div className="overflow-x-auto border-t border-slate-100">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] text-slate-500">{["Conduce", "État", "STANDA", "Dokasav", "Blic", "Montant"].map((head) => <th key={head} className={`px-4 py-2 font-medium ${head === "Conduce" || head === "État" ? "" : "text-right"}`}>{head}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{view.pending.map((line) => <tr key={line.conduce.id}>
            <td className="px-4 py-2.5"><Link href={`/conduces/${line.conduce.id}`} className="font-mono font-semibold text-navy hover:underline">{line.conduce.conduce_number}</Link><span className="block text-[11px] text-slate-400">{fmtDate(line.day)}</span></td>
            <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${line.invoiced ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{line.invoiced ? "Facturée" : "Non facturée"}</span></td>
            <td className="px-4 py-2.5 text-right tabular-nums">{fmtLb(line.lbs.standa)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{fmtLb(line.lbs.dokasav)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{fmtLb(line.lbs.blic)}</td>
            <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{fmtUsd(line.total * view.rate)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div>}

    {/* Historique des paiements MCPACK */}
    {view && view.history.length > 0 && <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
      <button type="button" onClick={() => setShowHistory((open) => !open)} aria-expanded={showHistory} className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50">
        <History size={16} className="shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">Historique des paiements MCPACK · {view.history.length}</span>
        <ChevronDown size={18} className={`shrink-0 text-slate-400 transition ${showHistory ? "rotate-180" : ""}`} />
      </button>
      {showHistory && <>
      <div className="divide-y divide-slate-100 border-t border-slate-100">{view.history.slice(0, historyCount).map((entry) => {
        const lbs = totalOf(entry.lbs);
        const open = openHistory === entry.key;
        return <div key={entry.key}>
          <button type="button" onClick={() => setOpenHistory(open ? null : entry.key)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{entry.label}</span><span className="block text-xs text-slate-500">Payé le {fmtDate(entry.paidAt)} · {entry.lines.length} conduce{entry.lines.length > 1 ? "s" : ""} · {fmtLb(lbs)}</span></span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{fmtUsd(lbs * view.rate)}</span>
            <ChevronRight size={16} className={`shrink-0 text-slate-300 transition ${open ? "rotate-90" : ""}`} />
          </button>
          {open && <div className="grid grid-cols-3 gap-2 bg-slate-50 px-4 py-3 text-xs">
            {SHARES.map((share) => <div key={share.key}><p className="flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-full" style={{ background: share.color }} />{share.label}</p><p className="mt-0.5 font-semibold tabular-nums text-slate-900">{fmtUsd(entry.lbs[share.key] * view.rate)}</p><p className="tabular-nums text-slate-500">{fmtLb(entry.lbs[share.key])}</p></div>)}
            <p className="col-span-3 text-slate-500">Conduces : {entry.lines.map((line) => line.conduce.conduce_number).join(", ")}</p>
          </div>}
        </div>;
      })}</div>
      {view.history.length > historyCount && <button type="button" onClick={() => setHistoryCount((count) => count + 6)} className="w-full border-t border-slate-100 py-2.5 text-xs font-semibold text-navy hover:bg-slate-50">Voir plus</button>}
      </>}
    </div>}
  </section>;
}

function SummaryRow({ color, label, value, rate, strong = false, indent = false }: { color: string; label: string; value: number; rate: number; strong?: boolean; indent?: boolean }) {
  return <div className={`flex items-center gap-3 py-3 pr-4 ${indent ? "pl-9" : "pl-4"}`}>
    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
    <span className={`min-w-0 flex-1 text-sm ${strong ? "font-semibold text-slate-900" : "text-slate-600"}`}>{label}</span>
    <span className="text-right"><span className={`block text-sm tabular-nums ${strong ? "font-semibold text-slate-900" : "text-slate-700"}`}>{fmtUsd(value * rate)}</span><span className="block text-[11px] tabular-nums text-slate-400">{fmtLb(value)}</span></span>
  </div>;
}
