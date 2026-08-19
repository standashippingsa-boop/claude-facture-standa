"use client";
/*
 * STANDA COMMERCIAL — Bouton "Actualiser" pataje
 * ══════════════════════════════════════════════
 * Yon sèl konpozan pou TOUT sistèm nan (admin, employé, kliyan).
 *
 * RÈG (V12):
 *  • Li rele fonksyon rechajman paj la — li PA rechaje navigatè a, donk
 *    ou pa pèdi filtè, rechèch, seleksyon, ni paj kote ou ye a.
 *  • Pandan l ap travay: se ILUSTRASYON an k ap vire ki parèt, pa yon tèks.
 *  • Lè li fini: ✅ vèt anime parèt yon ti moman, apre sa li retounen nòmal.
 *  • Li rete aktif jiskaske done yo fin desann nèt (bouton dezaktive pandan tan an).
 *
 * <RefreshButton onRefresh={load} />          -> bouton ak etikèt
 * <RefreshButton onRefresh={load} iconOnly /> -> icòn sèlman (header mobil)
 */
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { SuccessCheck } from "./Loader";

export default function RefreshButton({
  onRefresh, label = "Actualiser", className = "", iconOnly = false,
}: {
  onRefresh: () => void | Promise<void>;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  const run = async () => {
    if (busy) return;
    setBusy(true); setOk(false);
    try {
      await onRefresh();
      setOk(true);
      setTimeout(() => setOk(false), 1800);
    } catch { /* paj la jere pwòp erè li */ } finally { setBusy(false); }
  };

  if (iconOnly) {
    return (
      <button type="button" onClick={run} disabled={busy} aria-label="Actualiser"
        title="Actualiser les données"
        className={`w-9 h-9 rounded-lg grid place-items-center disabled:opacity-60 ${className}`}>
        {ok ? <SuccessCheck size={20} /> : <RefreshCw size={19} className={busy ? "animate-spin" : ""} />}
      </button>
    );
  }

  return (
    <button type="button" onClick={run} disabled={busy} title="Actualiser les données"
      className={`btn btn-ghost border border-line ${className}`}>
      {ok ? <SuccessCheck size={16} /> : <RefreshCw size={15} className={busy ? "animate-spin" : ""} />}
      {label}
    </button>
  );
}
