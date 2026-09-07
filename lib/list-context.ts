"use client";

import { useEffect, useMemo, useState } from "react";

type ListContext = Record<string, unknown>;

const PREFIX = "standa:list-context:";

/**
 * Kenbe yon lis admin egzakteman nan eta li te ye a lè yon moun antre nan yon
 * fich kliyan / Conduce epi retounen: rechèch, filtè, paj, katab louvri, ak
 * pozisyon nan paj la. Sa rete sèlman nan navigatè admin lan; anyen pa ale
 * nan bazdone a ni sou paj piblik yo.
 */
export function useRememberListContext(
  key: string,
  values: ListContext,
  restore: (saved: ListContext) => void,
) {
  const storageKey = `${PREFIX}${key}`;
  const scrollKey = `${storageKey}:scroll`;
  const serialized = useMemo(() => JSON.stringify(values), [values]);
  const [ready, setReady] = useState(false);

  // Restaure anvan premye sovgad la, pou eta vid la pa janm ranplase eta ki
  // te deja anrejistre a lè lis la remonte apre yon fich detaye.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) restore(JSON.parse(raw) as ListContext);
    } catch {
      // Yon eta ansyen oswa kraze pa dwe janm bloke lis la.
    } finally {
      setReady(true);
    }
    // `key` se idantite lis la; restore a itilize setters paj la.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try { window.sessionStorage.setItem(storageKey, serialized); } catch { /* espas navigatè */ }
  }, [ready, serialized, storageKey]);

  useEffect(() => {
    if (!ready) return;
    let restoreTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const savedY = Number(window.sessionStorage.getItem(scrollKey) ?? "0");
      if (Number.isFinite(savedY) && savedY > 0) {
        restoreTimer = setTimeout(() => window.scrollTo(0, savedY), 0);
      }
    } catch { /* no-op */ }

    const saveScroll = () => {
      try { window.sessionStorage.setItem(scrollKey, String(window.scrollY)); } catch { /* no-op */ }
    };
    window.addEventListener("scroll", saveScroll, { passive: true });
    window.addEventListener("pagehide", saveScroll);
    return () => {
      if (restoreTimer) clearTimeout(restoreTimer);
      saveScroll();
      window.removeEventListener("scroll", saveScroll);
      window.removeEventListener("pagehide", saveScroll);
    };
  }, [ready, scrollKey]);
}

/** Retounen sèlman nan yon chemen entèn ki san danje. */
export function returnToOr(value: string | null | undefined, fallback: string) {
  if (value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  return fallback;
}

/** Ajoute orijin navigasyon an nan yon lyen fich detaye. */
export function withReturnTo(destination: string, origin: string) {
  const separator = destination.includes("?") ? "&" : "?";
  return `${destination}${separator}returnTo=${encodeURIComponent(origin)}`;
}
