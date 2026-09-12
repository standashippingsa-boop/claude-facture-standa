"use client";

import { useParams } from "next/navigation";
import PaymentReceiptPage from "@/components/PaymentReceiptPage";

export default function AdminPaymentReceiptPage() {
  const params = useParams<{ id: string }>();
  return <PaymentReceiptPage paymentId={String(params.id ?? "")} backHref="/rapports-financiers" />;
}
