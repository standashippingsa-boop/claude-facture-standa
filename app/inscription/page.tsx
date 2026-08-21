"use client";
/*
 * ANSYEN LYEN /inscription — kounye a li redirije sou /login?tab=signup.
 * Nou gen 3 LYEN SÈLMAN: /admin-login · /login · /employe
 * Paj sa a rete pou ansyen lyen WhatsApp yo pa kase.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Loader from "@/components/Loader";

export default function InscriptionRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/login?tab=signup"); }, [router]);
  return <Loader />;
}
