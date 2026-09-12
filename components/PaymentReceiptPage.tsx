"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, LoaderCircle, Printer, ReceiptText, ShieldCheck } from "lucide-react";
import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";

type ReceiptData = {
  receipt_number: string;
  payment: {
    id: string; amount: number; currency: "USD" | "HTG"; amount_usd: number; amount_htg: number;
    applied_usd: number; applied_htg: number; overpayment_amount: number; payment_method: string;
    payment_reference: string; exchange_rate_used: number; received_by_name: string; recorded_by_role: string; created_at: string;
  };
  invoice: { invoice_number: string; customer_code: string; total_usd: number; total_htg: number; grand_total: number; order_deposit: number; balance_due: number; payment_status: string };
  customer: { code: string; name: string; city: string };
};

const money = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100;
const usd = (value: unknown) => `$${money(value).toFixed(2)}`;
const htg = (value: unknown) => `${new Intl.NumberFormat("fr-HT", { maximumFractionDigits: 2 }).format(money(value))} HTG`;
const dateTime = (value: string) => new Date(value).toLocaleString("fr-CA", { dateStyle: "long", timeStyle: "short" });

export default function PaymentReceiptPage({ paymentId, backHref }: { paymentId: string; backHref: string }) {
  const router = useRouter();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token ?? "";
        const response = await fetch(`/api/payment-receipt?id=${encodeURIComponent(paymentId)}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.reason || "Reçu indisponible.");
        if (!cancelled) setReceipt(result as ReceiptData);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Reçu indisponible.");
      }
    };
    if (paymentId) void load();
    return () => { cancelled = true; };
  }, [paymentId]);

  if (!receipt && !error) return <div className="grid min-h-[60vh] place-items-center"><LoaderCircle className="animate-spin text-navy" size={34} /></div>;
  if (error) return <section className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-red-50 p-6 text-center"><ReceiptText className="mx-auto text-red-600" size={34} /><h1 className="mt-3 text-xl font-black text-navy">Reçu indisponible</h1><p className="mt-2 text-sm text-red-700">{error}</p><button type="button" onClick={() => router.push(backHref)} className="btn btn-primary mt-5">Retour</button></section>;
  if (!receipt) return null;

  const { payment, invoice, customer } = receipt;
  const applied = payment.currency === "USD" ? usd(payment.applied_usd || payment.amount_usd) : htg(payment.applied_htg || payment.amount_htg);
  const received = payment.currency === "USD" ? usd(payment.amount) : htg(payment.amount);
  const source = payment.recorded_by_role === "admin" ? "Administrateur" : "Point de retrait";

  return <div className="mx-auto max-w-2xl space-y-4 py-3 print:max-w-none print:py-0">
    <style jsx global>{`@media print { body * { visibility: hidden; } #payment-receipt, #payment-receipt * { visibility: visible; } #payment-receipt { position: absolute; inset: 0; width: 100%; margin: 0; } }`}</style>
    <div className="flex flex-wrap justify-between gap-2 print:hidden"><button type="button" onClick={() => router.push(backHref)} className="btn btn-ghost inline-flex items-center gap-2"><ArrowLeft size={17} /> Retour</button><button type="button" onClick={() => window.print()} className="btn btn-primary inline-flex items-center gap-2"><Printer size={17} /> Imprimer le reçu</button></div>
    <article id="payment-receipt" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
      <header className="bg-[#09295e] px-6 py-6 text-white sm:px-8"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><Logo size={42} /><div><p className="text-lg font-black tracking-wide">STANDA COMMERCIAL</p><p className="text-xs text-blue-100">Reçu de paiement vérifiable</p></div></div><div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-blue-100">N° de reçu</p><p className="mt-0.5 text-sm font-black">{receipt.receipt_number}</p></div></div></header>
      <div className="space-y-6 p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-dashed border-slate-200 pb-5"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Paiement reçu</p><p className="mt-1 text-3xl font-black text-[#09295e]">{received}</p><p className="mt-1 text-sm text-slate-500">{dateTime(payment.created_at)}</p></div><div className="rounded-2xl bg-emerald-50 px-4 py-3 text-right"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Statut de la facture</p><p className="mt-1 flex items-center justify-end gap-1 text-sm font-black text-emerald-800"><CheckCircle2 size={16} /> {invoice.payment_status || "Paiement enregistré"}</p></div></div>
        <section className="grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2"><Info label="Client" value={customer.name || "Client STANDA"} sub={`${customer.code}${customer.city ? ` · ${customer.city}` : ""}`} /><Info label="Facture concernée" value={invoice.invoice_number} sub={`Code client : ${invoice.customer_code}`} /><Info label="Moyen de paiement" value={payment.payment_method || "Espèces"} sub={payment.payment_reference ? `Référence : ${payment.payment_reference}` : "Aucune référence fournie"} /><Info label="Paiement confirmé par" value={payment.received_by_name || "STANDA Commercial"} sub={source} /></section>
        <section className="overflow-hidden rounded-2xl border border-slate-200"><div className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-200 px-4 py-3 text-sm"><span className="font-semibold text-slate-600">Montant appliqué à la facture</span><b className="text-[#09295e]">{applied}</b></div><div className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-200 px-4 py-3 text-sm"><span className="font-semibold text-slate-600">Équivalent USD</span><b className="text-[#09295e]">{usd(payment.amount_usd)}</b></div><div className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-200 px-4 py-3 text-sm"><span className="font-semibold text-slate-600">Équivalent HTG</span><b className="text-[#09295e]">{htg(payment.amount_htg)}</b></div>{money(payment.overpayment_amount) > 0.009 && <div className="grid grid-cols-[1fr_auto] gap-4 bg-amber-50 px-4 py-3 text-sm"><span className="font-semibold text-amber-800">Arrondi accepté</span><b className="text-amber-900">{payment.currency === "USD" ? usd(payment.overpayment_amount) : htg(payment.overpayment_amount)}</b></div>}</section>
        <footer className="flex gap-2 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><ShieldCheck className="shrink-0 text-blue-700" size={20} /><p>Ce reçu est lié à la facture <b>{invoice.invoice_number}</b> et au paiement enregistré dans le système STANDA. Conservez son numéro pour toute vérification.</p></footer>
      </div>
    </article>
  </div>;
}

function Info({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-black text-[#09295e]">{value}</p><p className="mt-0.5 text-xs text-slate-500">{sub}</p></div>;
}
