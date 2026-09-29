"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import RemiseTicketPage from "@/components/RemiseTicketPage";
import { returnToOr } from "@/lib/list-context";

/** Ticket de remise imprimable — administration et employés (toutes zones). */
function AdminRemiseTicket() {
  const params = useSearchParams();
  return <RemiseTicketPage packageId={String(params.get("package") ?? "")}
    backHref={returnToOr(params.get("returnTo"), "/historique")} autoPrint={params.get("print") === "1"} />;
}

export default function AdminRemiseTicketPage() {
  return <Suspense fallback={null}><AdminRemiseTicket /></Suspense>;
}
