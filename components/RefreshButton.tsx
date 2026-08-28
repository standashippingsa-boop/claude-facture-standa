"use client";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Spinner, SuccessCheck } from "@/components/Loader";

/**
 * BOUTON ACTUALISER + MIZAJOU OTOMATIK — STANDA COMMERCIAL (v3)
 * ═════════════════════════════════════════════════════════════
 * Konpozan sa a sou CHAK paj sistèm nan (Dashboard, Packages, Clients,
 * Conduces, Factures, Retraits, Journal, Historique, Bon de Remise…) epi li
 * deja resevwa fonksyon rechajman paj la. Se pou sa mizajou otomatik la viv
 * ISIT LA: yon sèl fichye kouvri tout sistèm nan, epi okenn paj pa ka bliye
 * l demen.
 *
 * MIZAJOU OTOMATIK — SAN KLIYAN AN PEZE ANYEN
 * ───────────────────────────────────────────
 * Done yo remonte poukont yo:
 *   • lè paj la fèk louvri
 *   • lè moun nan retounen sou onglè a / app la (visibilitychange, focus)
 *   • lè koneksyon an tounen apre l te tonbe (online)
 *   • chak 60 segond pandan paj la louvri
 *
 * An SILANS: pa gen spinner, pa gen ✅. Ekran an pa klere pou anyen — done
 * ki sou ekran an ranplase sèlman lè nouvo yo fin desann.
 *
 * TWA GAD — POUKISA NOU PA RECHAJE NENPÒT LÈ
 * ──────────────────────────────────────────
 *  1) Yon fenèt ouvè (fakti, detay koli): rechaje ta ka efase seleksyon
 *     an anba men w pandan w ap travay.
 *  2) Yon moun k ap tape nan yon chan: rechaje ta ka pèdi sa l ap ekri.
 *  3) Yon rechajman deja an kou: nou pa lanse yon dezyèm.
 * Nan tou lè twa ka yo nou sote tou senpleman — pwochen tantativ la ap fèt.
 */
export default function RefreshButton({
  onRefresh, label = "Actualiser", autoMs = 60000
}: {
  onRefresh: () => void | Promise<void>;
  label?: string;
  /** Entèval mizajou otomatik (ms). 0 = dezaktive sou paj sa a. */
  autoMs?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  /** Refs: listeners yo li valè aktyèl la san yo pa re-atache chak rann. */
  const running = useRef(false);
  const fn = useRef(onRefresh);
  fn.current = onRefresh;

  /** Èske li san danje pou nou rechaje kounye a? */
  const safe = () => {
    if (running.current) return false;                        // deja an kou
    if (document.visibilityState !== "visible") return false; // paj kache
    // Yon fenèt modal ouvè -> pa touche done ki anba a
    if (document.querySelector(".fixed.inset-0")) return false;
    // Moun nan ap tape -> pa entewonp li
    const el = document.activeElement as HTMLElement | null;
    const tag = el?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return false;
    return true;
  };

  /** Rechajman AN SILANS — pa gen spinner ni ✅. */
  const silent = async () => {
    if (!safe()) return;
    running.current = true;
    try { await fn.current(); } catch { /* paj la jere pwòp erè li */ }
    finally { running.current = false; }
  };

  useEffect(() => {
    if (!autoMs) return;
    const onVisible = () => { if (document.visibilityState === "visible") silent(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", silent);
    const timer = setInterval(silent, autoMs);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", silent);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMs]);

  /** Peze bouton an: la nou MONTRE sa k ap pase. */
  const click = async () => {
    if (busy || running.current) return;
    setBusy(true); setOk(false);
    running.current = true;
    const t0 = Date.now();
    try {
      await fn.current();
      // Si done yo desann twò vit, ilustrasyon an ta klere yon frap je epi
      // ou pa ta wè anyen. Nou kenbe l vizib omwen 600 ms.
      const reste = 600 - (Date.now() - t0);
      if (reste > 0) await new Promise((r) => setTimeout(r, reste));
      setOk(true);
      setTimeout(() => setOk(false), 1800);
    } catch { /* paj la jere pwòp erè li */ }
    finally { running.current = false; setBusy(false); }
  };

  return (
    <button onClick={click} disabled={busy} title="Mettre à jour les données"
      className="btn btn-ghost border border-line !py-1.5 !px-3 !text-xs disabled:opacity-60">
      {busy ? <Spinner size={15} /> : ok ? <SuccessCheck size={16} /> : <RefreshCw size={14} />}
      {label}
    </button>
  );
}
