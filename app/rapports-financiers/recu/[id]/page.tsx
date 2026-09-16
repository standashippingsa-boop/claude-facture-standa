"use client";

import { useParams } from "next/navigation";
import PaymentReceiptPage from "@/components/PaymentReceiptPage";

/** Reçu ouvert depuis le rapport, sans quitter le périmètre administrateur. */
export default function FinancialReportReceiptPage() {
  const params = useParams<{ id: string }>();
  return <PaymentReceiptPage paymentId={String(params.id ?? "")} backHref="/rapports-financiers" />;
}
