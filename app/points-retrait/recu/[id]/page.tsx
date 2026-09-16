"use client";

import { useParams } from "next/navigation";
import PaymentReceiptPage from "@/components/PaymentReceiptPage";

/** Même reçu imprimable depuis le contrôle administratif des agences. */
export default function PickupAdminReceiptPage() {
  const params = useParams<{ id: string }>();
  return <PaymentReceiptPage paymentId={String(params.id ?? "")} backHref="/points-retrait" />;
}
