"use client";
/**
 * Impression d'un document de la page (ticket de remise…).
 *
 * Dans un navigateur (ordinateur, Chrome Android) : window.print().
 * Dans l'application Android « Standa Agence » : window.print() ne fait RIEN
 * dans une WebView Android. L'application expose donc un pont natif
 * `StandaPrint.print(nom)` (mobile-apps/agence/.../MainActivity.java) qui
 * ouvre le service d'impression Android sur la page, avec les styles @media print.
 */
type NativePrint = { print: (jobName: string) => void };

export function nativePrintAvailable() {
  return typeof window !== "undefined" && typeof (window as unknown as { StandaPrint?: NativePrint }).StandaPrint?.print === "function";
}

/** Vrai si on est dans une WebView Android sans pont d'impression (ancienne version de l'application). */
export function printUnsupported() {
  if (typeof navigator === "undefined" || nativePrintAvailable()) return false;
  return /; wv\)/.test(navigator.userAgent) || /\bwv\b/.test(navigator.userAgent);
}

export function printDocument(jobName = "Ticket STANDA") {
  const bridge = (window as unknown as { StandaPrint?: NativePrint }).StandaPrint;
  if (bridge && typeof bridge.print === "function") { bridge.print(jobName); return true; }
  if (printUnsupported()) return false;
  window.print();
  return true;
}
