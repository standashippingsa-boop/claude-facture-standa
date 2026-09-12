"use client";

import Loader from "@/components/Loader";
import OperationsGuide from "@/components/OperationsGuide";
import { useRole } from "@/lib/authx";

export default function GuidePage() {
  const { role, loading } = useRole();
  if (loading) return <Loader />;
  return <OperationsGuide role={role === "admin" ? "admin" : "employe"} backHref="/dashboard" backLabel="Retour au tableau de bord" />;
}
