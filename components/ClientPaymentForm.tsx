"use client";

import { useMemo, useState } from "react";
import { Banknote, Building2, Check, CircleDollarSign, Landmark, Smartphone, X } from "lucide-react";
import { parsePaymentAmount } from "@/lib/invoice-payable";
import { PAYMENT_METHODS, planPaymentAllocation, type PaymentInvoice } from "@/lib/payment-allocation";
import { Spinner } from "@/components/Loader";
import { notify } from "@/lib/notify";

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type ClientPaymentSubmit = { invoiceIds: string[]; amount: number; currency: "USD" | "HTG"; method: PaymentMethod; reference: string };

const fmtUsd = (value: number) => "$" + Number(value || 0).toFixed(2);
const fmtHtg = (value: number) => new Intl.NumberFormat("fr-HT", { maximumFractionDigits: 2 }).format(Number(value || 0)) + " HTG";
const fmt = (currency: "USD" | "HTG", value: number) => currency === "HTG" ? fmtHtg(value) : fmtUsd(value);
const dateText = (value: string | null) => value ? new Date(value).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }) : "—";
const round2 = (value: number) => Math.round(value * 100) / 100;
const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

const METHOD_ICONS: Record<PaymentMethod, typeof Banknote> = {
  "Espèces": Banknote, MonCash: Smartphone, NatCash: Smartphone, Zelle: Landmark, "Virement bancaire": Building2
};

function remainingOf(invoice: PaymentInvoice) {
  const plan = planPaymentAllocation([invoice], 0.01, "USD");
  return plan.ok ? { usd: plan.dueUsd, htg: plan.dueHtg } : { usd: 0, htg: 0 };
}

/**
 * Règlement d'un client : toutes ses factures ouvertes, cochées par défaut.
 * Le caissier entre le montant TOTAL remis ; la répartition (la plus ancienne
 * d'abord) est affichée avant confirmation et refaite à l'identique par le serveur.
 */
export default function ClientPaymentForm({ customerCode, customerName, invoices, initialSelected, busy, onSubmit, onClose, title = "Enregistrer un paiement", className = "" }: {
  customerCode: string; customerName?: string; invoices: PaymentInvoice[]; initialSelected?: string[];
  busy: boolean; error?: string | null; onSubmit: (payload: ClientPaymentSubmit) => void; onClose: () => void;
  title?: string; className?: string;
}) {
  const open = useMemo(() => invoices
    .map((invoice) => ({ invoice, remaining: remainingOf(invoice) }))
    .filter((row) => row.remaining.usd > 0.009 || row.remaining.htg > 0.009)
    .sort((left, right) => String(left.invoice.created_at ?? "").localeCompare(String(right.invoice.created_at ?? ""))), [invoices]);
  const [selected, setSelected] = useState<string[]>(() => {
    const all = open.map((row) => row.invoice.id);
    const wanted = (initialSelected ?? []).filter((id) => all.includes(id));
    return wanted.length ? wanted : all;
  });
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "HTG">("HTG");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [reference, setReference] = useState("");
  const fail = (text: string) => notify.error(text, { title: "Paiement non enregistré" });

  const chosen = open.filter((row) => selected.includes(row.invoice.id));
  const dueUsd = round2(chosen.reduce((total, row) => total + row.remaining.usd, 0));
  const dueHtg = round2(chosen.reduce((total, row) => total + row.remaining.htg, 0));
  const typed = parsePaymentAmount(amount);
  const plan = typed && typed > 0 && chosen.length ? planPaymentAllocation(chosen.map((row) => row.invoice), typed, currency) : null;
  const paidAll = (value: "USD" | "HTG") => typed !== null && currency === value && Math.abs(typed - (value === "HTG" ? dueHtg : dueUsd)) < 0.01;
  const needsReference = method === "Zelle" || method === "Virement bancaire" || method === "MonCash" || method === "NatCash";

  const toggle = (id: string) => { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); };
  const fillAll = (value: "USD" | "HTG") => { setCurrency(value); setAmount(String(round2(value === "HTG" ? dueHtg : dueUsd))); };

  const submit = () => {
    if (!chosen.length) return fail("Cochez au moins une facture.");
    if (typed === null || typed <= 0) return fail("Entrez le montant remis par le client.");
    if (!method) return fail("Choisissez le moyen de paiement.");
    if (plan && !plan.ok) return fail(plan.reason);
   
    onSubmit({ invoiceIds: chosen.map((row) => row.invoice.id), amount: typed, currency, method, reference: reference.trim() });
  };

  return <section className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.10)]", className)}>
    <header className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-[#0b3270] to-[#1a5bc0] px-4 py-3 text-white">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-100">{title}</p>
        <h3 className="mt-0.5 truncate text-lg font-black">{customerCode}{customerName ? <span className="ml-1.5 text-sm font-semibold text-white/80">· {customerName}</span> : null}</h3>
      </div>
      <button type="button" onClick={onClose} aria-label="Fermer le paiement" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/80 hover:bg-white/15"><X size={18} /></button>
    </header>

    <div className="space-y-4 p-4">
      {!open.length ? <p className="rounded-xl bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800">Ce client n’a aucune facture à régler.</p> : <>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Factures à régler · {chosen.length}/{open.length}</p>
            {open.length > 1 && <button type="button" onClick={() => setSelected(chosen.length === open.length ? [] : open.map((row) => row.invoice.id))} className="text-xs font-bold text-[#0b3270] hover:underline">{chosen.length === open.length ? "Tout décocher" : "Tout cocher"}</button>}
          </div>
          <div className="space-y-1.5">{open.map((row) => {
            const checked = selected.includes(row.invoice.id);
            const part = plan?.ok ? plan.allocations.find((allocation) => allocation.invoice.id === row.invoice.id) : undefined;
            return <button key={row.invoice.id} type="button" role="checkbox" aria-checked={checked} onClick={() => toggle(row.invoice.id)} className={cn("flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition", checked ? "border-[#0b3270]/30 bg-blue-50/60" : "border-slate-200 bg-white opacity-70")}>
              <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md border-2", checked ? "border-[#0b3270] bg-[#0b3270] text-white" : "border-slate-300")}>{checked && <Check size={14} strokeWidth={3} />}</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-black text-[#0a2b61]">{row.invoice.invoice_number}</span><span className="block text-[11px] text-slate-500">{dateText(row.invoice.created_at)}</span></span>
              <span className="text-right"><span className="block text-sm font-black text-[#bd450b]">{fmtUsd(row.remaining.usd)}</span><span className="block text-[11px] text-slate-500">{fmtHtg(row.remaining.htg)}</span>
                {part && <span className={cn("mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-black", part.status === "Payé" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>{part.status === "Payé" ? "Soldée" : "Partiel"} · {fmt(currency, part.amount)}</span>}
              </span>
            </button>;
          })}</div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total dû</p><p className="text-lg font-black text-[#0a2b61]">{fmtUsd(dueUsd)} <span className="text-sm font-bold text-slate-500">· {fmtHtg(dueHtg)}</span></p></div>
          <div className="mt-2 grid grid-cols-2 gap-2">{(["HTG", "USD"] as const).map((value) => <button key={value} type="button" disabled={!chosen.length} onClick={() => fillAll(value)} className={cn("min-h-11 rounded-xl border-2 px-2 text-xs font-black transition disabled:opacity-40", paidAll(value) ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-[#0a2b61] hover:border-[#0b3270]/40")}>Tout payer en {value === "HTG" ? "gourdes" : "dollars"}</button>)}</div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Montant remis par le client</span><input value={amount} onChange={(event) => { setAmount(event.target.value); }} type="text" inputMode="decimal" className="input" placeholder={currency === "HTG" ? "ex. 13 200" : "ex. 100"} /></label>
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Devise</span><select value={currency} onChange={(event) => { setCurrency(event.target.value as "USD" | "HTG"); }} className="input"><option value="HTG">Gourdes (HTG)</option><option value="USD">Dollars (USD)</option></select></label>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-bold text-slate-600">Moyen de paiement <span className="text-red-600">*</span></p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{PAYMENT_METHODS.map((value) => {
            const Icon = METHOD_ICONS[value];
            const active = method === value;
            return <button key={value} type="button" aria-pressed={active} onClick={() => { setMethod(value); }} className={cn("flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-2 py-1.5 text-[12px] font-bold transition", active ? "border-[#0b3270] bg-[#0b3270] text-white" : "border-slate-200 bg-white text-slate-700 hover:border-[#0b3270]/40")}><Icon size={16} />{value}</button>;
          })}</div>
        </div>

        {method && <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Référence {needsReference ? "de la transaction" : "(facultatif)"}</span><input value={reference} onChange={(event) => setReference(event.target.value.slice(0, 120))} className="input" placeholder={method === "Zelle" ? "Nom de l’expéditeur ou n° de confirmation Zelle" : needsReference ? "N° de transaction" : "Note (facultatif)"} /></label>}

        {plan?.ok && <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-900">
          <p className="font-black">Répartition automatique</p>
          <ul className="mt-1 space-y-0.5">{plan.allocations.map((allocation) => <li key={allocation.invoice.id} className="flex justify-between gap-2"><span>{allocation.invoice.invoice_number}</span><span className="font-bold">{fmt(currency, allocation.amount)} · {allocation.status}</span></li>)}</ul>
          {(() => { const rest = round2((currency === "HTG" ? dueHtg : dueUsd) - (typed ?? 0)); return rest > 0.009 ? <p className="mt-1.5 font-semibold">Reste à payer après ce paiement : {fmt(currency, rest)}</p> : null; })()}
        </div>}

        <button type="button" disabled={busy || !chosen.length} onClick={submit} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#e85e19] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#ce4e0d] disabled:opacity-60">
          {busy ? <><Spinner size={16} /> Enregistrement…</> : <><CircleDollarSign size={18} /> Confirmer le paiement{typed ? ` · ${fmt(currency, typed)}` : ""}</>}
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
