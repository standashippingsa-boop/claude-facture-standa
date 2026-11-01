"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";

/**
 * Espace client :
 *  - MotionConfig : les animations (motion) respectent le réglage « réduire les
 *    animations » du téléphone.
 *  - Toaster (sonner) : petits messages discrets (« Numéro copié »…). Les
 *    confirmations importantes (paiement, remise) restent sur la page plein
 *    écran de components/Toaster.tsx.
 */
export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster position="top-center" offset={16} duration={2200}
        toastOptions={{ style: { background: "#122B5C", color: "#fff", border: "none", borderRadius: 999, fontSize: 14, fontWeight: 600, padding: "10px 18px", width: "auto", margin: "0 auto" } }} />
    </MotionConfig>
  );
}
