"use client";

import StaffLogin from "@/components/StaffLogin";

/** Porte d'entrée spécifique aux personnes qui remettent les colis. */
export default function PointRetraitLoginPage() {
  return (
    <StaffLogin
      title="Point de retrait"
      subtitle="Accès réservé aux agents de remise STANDA COMMERCIAL"
      destination="/espace-remise"
    />
  );
}
