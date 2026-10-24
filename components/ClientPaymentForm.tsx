"use client";

import { useMemo, useRef, useState } from "react";
import { Check, CircleDollarSign, Plus, Trash2, X } from "lucide-react";
import { parsePaymentAmount } from "@/lib/invoice-payable";
import { MAX_PAYMENT_LINES, PAYMENT_METHODS, outstandingOf, planPaymentLines, type PaymentInvoice, type PaymentLine } from "@/lib/payment-allocation";
import { Spinner } from "@/components/Loader";
import { notify } from "@/lib/notify";

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
/**
 * `lines` : une ligne par moyen de paiement (un client peut donner des
 * gourdes en espèces ET le reste en dollars par Zelle). `summary` est le texte
 * prêt à afficher : « 5 000 HTG par Espèces + $62.12 par Zelle ».
 */
export type ClientPaymentSubmit = { invoiceIds: string[]; lines: PaymentLine[]; summary: string };

type DraftLine = { id: number; amount: string; currency: "USD" | "HTG"; method: PaymentMethod | ""; reference: string };

const fmtUsd = (value: number) => "$" + Number(value || 0).toFixed(2);
const fmtHtg = (value: number) => new Intl.NumberFormat("fr-HT", { maximumFractionDigits: 2 }).format(Number(value || 0)) + " HTG";
const fmt = (currency: "USD" | "HTG", value: number) => currency === "HTG" ? fmtHtg(value) : fmtUsd(value);
const dateText = (value: string | null) => value ? new Date(value).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }) : "—";
const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");
const needsReference = (method: string) => method === "Zelle" || method === "Virement bancaire" || method === "MonCash" || method === "NatCash";

/**
 * Règlement d'un client : toutes ses factures ouvertes, cochées par défaut.
 * Le caissier entre CHAQUE montant remis avec son moyen de paiement (une
 * ligne par moyen : espèces, MonCash, NatCash, Zelle, virement — en gourdes
 * ou en dollars). La répartition sur les factures (la plus ancienne d'abord)
 * est affichée avant confirmation et refaite à l'identique par le serveur.
 */
export default function ClientPaymentForm({ customerCode, customerName, invoices, initialSelected, busy, onSubmit, onClose, title = "Enregistrer un paiement", className = "", plain = false }: {
  customerCode: string; customerName?: string; invoices: PaymentInvoice[]; initialSelected?: string[];
  busy: boolean; error?: string | null; onSubmit: (payload: ClientPaymentSubmit) => void; onClose: () => void;
  title?: string; className?: string;
  /** Style sobre (app point de retrait) : en-tête blanc, sans dégradé ni cadre. */
  plain?: boolean;
}) {
  const open = useMemo(() => invoices
    .map((invoice) => ({ invoice, remaining: outstandingOf([invoice]) }))
    .filter((row) => row.remaining.usd > 0.009 || row.remaining.htg > 0.009)
    .sort((left, right) => String(left.invoice.created_at ?? "").localeCompare(String(right.invoice.created_at ?? ""))), [invoices]);
  const [selected, setSelected] = useState<string[]>(() => {
    const all = open.map((row) => row.invoice.id);
    const wanted = (initialSelected ?? []).filter((id) => all.includes(id));
    return wanted.length ? wanted : all;
  });
  const nextId = useRef(2);
  const [lines, setLines] = useState<DraftLine[]>([{ id: 1, amount: "", currency: "HTG", method: "", reference: "" }]);
  const fail = (text: string) => notify.error(text, { title: "Paiement non enregistré" });

  const chosen = open.filter((row) => selected.includes(row.invoice.id));
  const chosenInvoices = chosen.map((row) => row.invoice);
  const due = outstandingOf(chosenInvoices);

  /** Lignes déjà complètes (montant + moyen) : elles seules entrent dans le calcul. */
  const toLine = (draft: DraftLine): PaymentLine | null => {
    const amount = parsePaymentAmount(draft.amount);
    if (amount === null || amount <= 0 || !draft.method) return null;
    return { amount, currency: draft.currency, method: draft.method, reference: draft.reference.trim() };
  };
  const ready = lines.map(toLine);
  const complete = ready.every(Boolean);
  const valid = ready.filter((line): line is PaymentLine => line !== null);
  const plan = valid.length && chosenInvoices.length ? planPaymentLines(chosenInvoices, valid) : null;
  const remaining = plan?.ok ? { usd: plan.remainingUsd, htg: plan.remainingHtg } : due;
  const fullyPaid = Boolean(plan?.ok && plan.remainingUsd < 0.01 && plan.remainingHtg < 0.01);

  /** Reste dû AVANT la ligne `index` (ce que les lignes précédentes laissent). */
  const remainingBefore = (index: number) => {
    const before = ready.slice(0, index).filter((line): line is PaymentLine => line !== null);
    if (!before.length) return due;
    const partial = planPaymentLines(chosenInvoices, before);
    return partial.ok ? { usd: partial.remainingUsd, htg: partial.remainingHtg } : { usd: 0, htg: 0 };
  };

  const toggle = (id: string) => { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); };
  const patch = (id: number, change: Partial<DraftLine>) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...change } : line));
  const fillRest = (index: number) => {
    const rest = remainingBefore(index);
    const draft = lines[index];
    const value = draft.currency === "HTG" ? rest.htg : rest.usd;
    if (value <= 0) return fail("Les montants précédents couvrent déjà tout le solde.");
    patch(draft.id, { amount: String(value) });
  };
  const addLine = () => {
    if (lines.length >= MAX_PAYMENT_LINES) return;
    // La nouvelle ligne propose l'autre devise : cas le plus courant (gourdes + dollars).
    const last = lines[lines.length - 1];
    setLines((current) => [...current, { id: nextId.current++, amount: "", currency: last?.currency === "HTG" ? "USD" : "HTG", method: "", reference: "" }]);
  };
  const removeLine = (id: number) => setLines((current) => current.length > 1 ? current.filter((line) => line.id !== id) : current);

  const summary = valid.map((line) => `${fmt(line.currency, line.amount)} par ${line.method}`).join(" + ");

  const submit = () => {
    if (busy) return;
    if (!chosen.length) return fail("Cochez au moins une facture.");
    for (let index = 0; index < lines.length; index++) {
      const label = lines.length > 1 ? `Ligne ${index + 1} : ` : "";
      const amount = parsePaymentAmount(lines[index].amount);
      if (amount === null || amount <= 0) return fail(label + "entrez le montant remis par le client.");
      if (!lines[index].method) return fail(label + "choisissez le moyen de paiement.");
    }
    if (!plan) return fail("Encodez le montant remis par le client.");
    if (!plan.ok) return fail(plan.reason);
    onSubmit({ invoiceIds: chosen.map((row) => row.invoice.id), lines: valid, summary });
  };

  return <section className={cn(plain ? "overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70" : "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.10)]", className)}>
    {plain
      ? <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">{title}</p>
            <h3 className="mt-0.5 truncate text-[17px] font-semibold text-slate-900">{customerCode}{customerName ? <span className="ml-1.5 text-sm font-normal text-slate-500">· {customerName}</span> : null}</h3>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Fermer le paiement" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-40"><X size={18} /></button>
        </header>
      : <header className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-[#0b3270] to-[#1a5bc0] px-4 py-3 text-white">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-100">{title}</p>
        <h3 className="mt-0.5 truncate text-lg font-black">{customerCode}{customerName ? <span className="ml-1.5 text-sm font-semibold text-white/80">· {customerName}</span> : null}</h3>
      </div>
      <button type="button" onClick={onClose} disabled={busy} aria-label="Fermer le paiement" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/80 hover:bg-white/15 disabled:opacity-40"><X size={18} /></button>
    </header>}

    <div className="space-y-4 p-4">
      {!open.length ? <p className="rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800">Ce client n’a aucune facture à régler.</p> : <>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Factures à régler · {chosen.length}/{open.length}</p>
            {open.length > 1 && <button type="button" disabled={busy} onClick={() => setSelected(chosen.length === open.length ? [] : open.map((row) => row.invoice.id))} className="text-xs font-bold text-[#0b3270] hover:underline">{chosen.length === open.length ? "Tout décocher" : "Tout cocher"}</button>}
          </div>
          <div className="space-y-1.5">{open.map((row) => {
            const checked = selected.includes(row.invoice.id);
            const parts = plan?.ok ? plan.allocations.filter((allocation) => allocation.invoice.id === row.invoice.id) : [];
            const status = parts.length ? parts[parts.length - 1].status : "";
            return <button key={row.invoice.id} type="button" role="checkbox" aria-checked={checked} disabled={busy} onClick={() => toggle(row.invoice.id)} className={cn("flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition", checked ? "border-[#0b3270]/30 bg-blue-50/60" : "border-slate-200 bg-white opacity-70")}>
              <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md border-2", checked ? "border-[#0b3270] bg-[#0b3270] text-white" : "border-slate-300")}>{checked && <Check size={14} strokeWidth={3} />}</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-black text-[#0a2b61]">{row.invoice.invoice_number}</span><span className="block text-[11px] text-slate-500">{dateText(row.invoice.created_at)}</span></span>
              <span className="text-right"><span className="block text-sm font-black text-[#bd450b]">{fmtUsd(row.remaining.usd)}</span><span className="block text-[11px] text-slate-500">{fmtHtg(row.remaining.htg)}</span>
                {status && <span className={cn("mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-black", status === "Payé" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>{status === "Payé" ? "Soldée" : "Partiel"}</span>}
              </span>
            </button>;
          })}</div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total dû</p><p className="text-lg font-black text-[#0a2b61]">{fmtUsd(due.usd)} <span className="text-sm font-bold text-slate-500">· {fmtHtg(due.htg)}</span></p></div>
        </div>

        <div className="space-y-3">
          {lines.map((draft, index) => {
            const amount = parsePaymentAmount(draft.amount);
            const badAmount = draft.amount.trim() !== "" && (amount === null || amount <= 0);
            return <div key={draft.id} className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{lines.length > 1 ? `Montant ${index + 1}` : "Montant remis par le client"}</p>
                {lines.length > 1 && <button type="button" disabled={busy} onClick={() => removeLine(draft.id)} className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline disabled:opacity-40"><Trash2 size={13} /> Retirer</button>}
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input value={draft.amount} disabled={busy} onChange={(event) => patch(draft.id, { amount: event.target.value })} type="text" inputMode="decimal" aria-label={`Montant ${index + 1}`}
                  className={cn("input", badAmount && "!border-red-400")} placeholder={draft.currency === "HTG" ? "ex. 13 200" : "ex. 100"} />
                <select value={draft.currency} disabled={busy} onChange={(event) => patch(draft.id, { currency: event.target.value as "USD" | "HTG" })} aria-label={`Devise ${index + 1}`} className="input"><option value="HTG">Gourdes (HTG)</option><option value="USD">Dollars (USD)</option></select>
                <button type="button" disabled={busy || !chosen.length} onClick={() => fillRest(index)} className="min-h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-black text-[#0a2b61] hover:border-[#0b3270]/40 disabled:opacity-40">{index === 0 ? "Tout le solde" : "Le reste"}</button>
              </div>
              {badAmount && <p className="mt-1 text-xs font-semibold text-red-600">Montant invalide.</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">{PAYMENT_METHODS.map((value) => {
                const active = draft.method === value;
                return <button key={value} type="button" disabled={busy} aria-pressed={active} onClick={() => patch(draft.id, { method: value })} className={cn("min-h-9 rounded-lg border-2 px-3 text-[12px] font-bold transition", active ? "border-[#0b3270] bg-[#0b3270] text-white" : "border-slate-200 bg-white text-slate-700 hover:border-[#0b3270]/40")}>{value}</button>;
              })}</div>
              {draft.method && <input value={draft.reference} disabled={busy} onChange={(event) => patch(draft.id, { reference: event.target.value.slice(0, 120) })} aria-label={`Référence ${index + 1}`} className="input mt-2"
                placeholder={draft.method === "Zelle" ? "Nom de l’expéditeur ou n° de confirmation Zelle" : needsReference(draft.method) ? "N° de transaction" : "Note (facultatif)"} />}
            </div>;
          })}
          {lines.length < MAX_PAYMENT_LINES && <button type="button" disabled={busy || !complete || fullyPaid || (plan !== null && !plan.ok)} onClick={addLine}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-sm font-bold text-[#0b3270] hover:border-[#0b3270]/50 disabled:opacity-40">
            <Plus size={16} /> Ajouter un autre moyen de paiement
          </button>}
        </div>

        {plan && !plan.ok && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">{plan.reason}</p>}

        {plan?.ok && <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-900">
          <p className="font-black">Ce qui sera enregistré</p>
          <ul className="mt-1 space-y-0.5">{plan.allocations.map((allocation, index) => <li key={index} className="flex justify-between gap-2"><span>{allocation.invoice.invoice_number} · {allocation.line.method}</span><span className="font-bold">{fmt(allocation.line.currency, allocation.amount)}</span></li>)}</ul>
          <p className="mt-1.5 font-semibold">{!fullyPaid
            ? <>Reste à payer après ce paiement : {fmtUsd(remaining.usd)} · {fmtHtg(remaining.htg)}</>
            : "Tout le solde est réglé."}</p>
        </div>}

        <button type="button" disabled={busy || !chosen.length} onClick={submit} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#e85e19] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#ce4e0d] disabled:opacity-60">
          {busy ? <><Spinner size={16} /> Enregistrement…</> : <><CircleDollarSign size={18} /> Confirmer le paiement{plan?.ok && summary ? ` · ${valid.map((line) => fmt(line.currency, line.amount)).join(" + ")}` : ""}</>}
        </button>
      </>}
    </div>
  </section>;
}

/** Fenêtre centrée (bas d'écran sur mobile) pour les écrans sans dossier client ouvert. */
export function PaymentModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" onClick={onClose}>
    <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>{children}</div>
  </div>;
}
