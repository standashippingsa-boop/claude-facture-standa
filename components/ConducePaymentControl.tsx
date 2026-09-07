"use client";

import { CheckCircle2, CircleDollarSign, LoaderCircle, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useRole } from "@/lib/authx";
import { setConducePaymentStatus } from "@/lib/db";
import type { Conduce, McpackInvoiceStatus } from "@/lib/types";

/**
 * État de règlement de la facture MCPACK.
 *
 * Ce contrôle ne touche jamais les factures des clients. La table `conduces`
 * est protégée par RLS : seuls les employés connectés peuvent l'utiliser.
 */
export default function ConducePaymentControl({
  conduce, invoiceStatus, compact = false, onChanged,
}: {
  conduce: Conduce;
  /** Yon badge peman sèlman parèt kòm "à payer" apre PDF MCPACK la fin valide. */
  invoiceStatus?: McpackInvoiceStatus;
  compact?: boolean;
  onChanged?: (next: Conduce) => void;
}) {
  const { staff, role } = useRole();
  const [busy, setBusy] = useState(false);
  const paid = conduce.payment_status === "Payé";
  const invoiced = Boolean(invoiceStatus);
  const staffName = staff
    ? `${staff.prenom ?? ""} ${staff.nom ?? ""}`.trim() || (staff.username ?? "")
    : "";

  const toggle = async () => {
    const next = paid ? "Non payé" : "Payé";
    const question = paid
      ? `Remettre la Conduce ${conduce.conduce_number} à « Poko peye MCPACK » ?`
      : `Confirmer que la facture MCPACK de la Conduce ${conduce.conduce_number} est déjà payée ?`;
    if (!window.confirm(question)) return;

    setBusy(true);
    try {
      await setConducePaymentStatus(conduce.id, next, staffName);
      onChanged?.({
        ...conduce,
        payment_status: next,
        payment_paid_at: next === "Payé" ? new Date().toISOString() : null,
        payment_paid_by: next === "Payé" ? staffName : null,
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Impossible de mettre à jour le paiement MCPACK.");
    } finally {
      setBusy(false);
    }
  };

  const paidAt = conduce.payment_paid_at
    ? new Date(conduce.payment_paid_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
    : "";

  if (!role) {
    return paid
      ? <span className="pill pill-green"><CheckCircle2 size={11} className="mr-0.5" />MCPACK payé</span>
      : invoiced
        ? <span className="pill pill-amber"><CircleDollarSign size={11} className="mr-0.5" />Facturée · à payer</span>
        : <span className="pill pill-gray">Pas facturée MCPACK</span>;
  }

  // Yon Conduce ki poko nan yon fakti MCPACK pa dwe montre "à payer":
  // sa ta bay enpresyon li deja gen yon dèt. Li vin peye sèlman apre PDF a
  // fin valide nan espas Factures MCPACK la.
  if (!paid && !invoiced) {
    return <span className={`inline-flex rounded-full bg-slate-100 text-slate-500 font-bold ${compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"}`}>
      Pas facturée MCPACK
    </span>;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={paid
        ? `Payé${paidAt ? ` le ${paidAt}` : ""}. Cliquez pour remettre à non payé.`
        : "Cliquez après avoir réglé la facture MCPACK."}
      className={`inline-flex items-center gap-1.5 rounded-full font-bold transition disabled:opacity-60 ${
        compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"
      } ${paid
        ? "bg-emerald-50 text-emerald-700 hover:bg-amber-50 hover:text-amber-800"
        : "bg-amber-50 text-amber-800 hover:bg-emerald-50 hover:text-emerald-700"
      }`}>
      {busy ? <LoaderCircle size={compact ? 12 : 14} className="animate-spin" /> : paid
        ? <CheckCircle2 size={compact ? 12 : 14} />
        : <CircleDollarSign size={compact ? 12 : 14} />}
      {paid ? "MCPACK payé" : "Facturée · à payer"}
      {paid && !compact && <RotateCcw size={13} className="opacity-55 ml-0.5" />}
    </button>
  );
}
