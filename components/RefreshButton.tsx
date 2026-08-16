"use client";
/*
 * STANDA COMMERCIAL — Bouton "Actualiser" pataje
 * ══════════════════════════════════════════════
 * Yon sèl konpozan pou TOUT sistèm nan (admin, employé, kliyan).
 * Li rele fonksyon rechajman paj la — li PA rechaje navigatè a,
 * donk ou pa pèdi filtè, rechèch, ni paj kote ou ye a.
 */
import { useState } from "react";
import { RefreshCw } from "lucide-react";

export default function RefreshButton({
  onRefresh, label = "Actualiser", className = "",
}: { onRefresh: () => void | Promise<void>; label?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [okAt, setOkAt] = useState<number | null>(null);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onRefresh();
      setOkAt(Date.now());
      setTimeout(() => setOkAt(null), 1600);
    } catch { /* paj la jere pwòp erè li */ } finally { setBusy(false); }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      title="Actualiser les données"
      className={`btn btn-ghost border border-line ${className}`}>
      <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
      {busy ? "Actualisation…" : okAt ? "À jour ✓" : label}
    </button>
  );
}
