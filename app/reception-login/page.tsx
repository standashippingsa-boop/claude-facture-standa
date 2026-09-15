"use client";

import StaffLogin from "@/components/StaffLogin";

/** Porte d'entrée spécifique à l'agent de réception (arrivée des Conduces). */
export default function ReceptionLoginPage() {
  return (
    <StaffLogin
      title="Réception"
      subtitle="Accès réservé aux agents de réception STANDA COMMERCIAL"
      destination="/reception"
      requiredRole="agent_reception"
      backgroundImage="/parcel-boxes-background.png"
    />
  );
}
