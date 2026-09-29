"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import RemiseTicketPage from "@/components/RemiseTicketPage";

/** Ticket de remise imprimable — agent du point de retrait (sa zone seulement, vérifié par le serveur). */
function AgentRemiseTicket() {
  const params = useSearchParams();
  return <RemiseTicketPage packageId={String(params.get("package") ?? "")} backHref="/espace-remise" autoPrint={params.get("print") === "1"} />;
}

export default function AgentRemiseTicketPage() {
  return <Suspense fallback={null}><AgentRemiseTicket /></Suspense>;
}
