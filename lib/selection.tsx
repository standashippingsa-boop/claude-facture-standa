"use client";
/*
 * STANDA COMMERCIAL — SÉLECTION GLOBALE DES COLIS
 * ═══════════════════════════════════════════════
 * YON SÈL sous verite pou seleksyon koli, pataje pa TOUT modil yo
 * (Packages, Conduces, Dossier client, Facturation…).
 *
 * PRENSIP:
 *   • Seleksyon = Set<package.id> (ID bazdone, PA index ni tracking)
 *   • RECHÈCHE ≠ SÉLECTION. Filtè, paj, navigasyon, chanjman Conduce,
 *     chanjman statut, tarification: OKENN pa efase seleksyon an.
 *   • Zewo doublon (Set).
 *   • Pèsistans: SÈLMAN ID nan sessionStorage (pa gen done kliyan,
 *     pa gen jeton, pa gen modpas).
 *   • Aksyon yo relije koli yo FRE depi bazdone a (validasyon).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** Ti rezime pou panèl la (an memwa sèlman — pa nan sessionStorage). */
export interface SelSnapshot {
  id: string;
  tracking_number?: string;
  customer_code?: string;
  customer_name?: string;
  weight?: number;
  status?: string;
  conduce_id?: string | null;
}

interface SelectionCtx {
  ids: string[];
  count: number;
  has: (id: string) => boolean;
  toggle: (p: SelSnapshot) => void;
  add: (list: SelSnapshot[]) => void;
  remove: (id: string) => void;
  setMany: (list: SelSnapshot[], checked: boolean) => void;
  clear: () => void;
  snapshots: SelSnapshot[];
  /** Sonje detay yo lè yon paj chaje koli (pou panèl la rete enfòme). */
  hydrate: (list: SelSnapshot[]) => void;
  /** Retire ID ki pa egziste ankò (koli efase) — pa kite "ghost selection". */
  reconcile: (existingIds: string[]) => void;
}

const KEY = "sc_selection_ids_v1";
const Ctx = createContext<SelectionCtx | null>(null);

export function SelectionProvider({ children }: { children: any }) {
  const [ids, setIds] = useState<string[]>([]);
  const [meta, setMeta] = useState<Record<string, SelSnapshot>>({});
  const [ready, setReady] = useState(false);

  // Retabli ID yo (sesyon an sèlman — li disparèt lè navigatè a fèmen)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setIds(arr.filter((x: any) => typeof x === "string"));
      }
    } catch { /* noop */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* noop */ }
  }, [ids, ready]);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  const hydrate = useCallback((list: SelSnapshot[]) => {
    if (!list.length) return;
    setMeta((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const s of list) {
        if (!s?.id) continue;
        const old = next[s.id];
        if (!old || old.status !== s.status || old.weight !== s.weight) { next[s.id] = { ...old, ...s }; changed = true; }
      }
      return changed ? next : prev;
    });
  }, []);

  const toggle = useCallback((p: SelSnapshot) => {
    if (!p?.id) return;
    setMeta((m) => ({ ...m, [p.id]: { ...m[p.id], ...p } }));
    setIds((prev) => (prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]));
  }, []);

  const add = useCallback((list: SelSnapshot[]) => {
    const clean = list.filter((p) => p?.id);
    if (!clean.length) return;
    setMeta((m) => { const n = { ...m }; clean.forEach((p) => { n[p.id] = { ...n[p.id], ...p }; }); return n; });
    setIds((prev) => Array.from(new Set([...prev, ...clean.map((p) => p.id)])));
  }, []);

  const remove = useCallback((id: string) => setIds((prev) => prev.filter((x) => x !== id)), []);

  const setMany = useCallback((list: SelSnapshot[], checked: boolean) => {
    const clean = list.filter((p) => p?.id);
    if (!clean.length) return;
    if (checked) {
      setMeta((m) => { const n = { ...m }; clean.forEach((p) => { n[p.id] = { ...n[p.id], ...p }; }); return n; });
      setIds((prev) => Array.from(new Set([...prev, ...clean.map((p) => p.id)])));
    } else {
      const drop = new Set(clean.map((p) => p.id));
      setIds((prev) => prev.filter((x) => !drop.has(x)));
    }
  }, []);

  const clear = useCallback(() => setIds([]), []);

  const reconcile = useCallback((existingIds: string[]) => {
    if (!existingIds.length) return;
    const alive = new Set(existingIds);
    setIds((prev) => {
      const kept = prev.filter((id) => alive.has(id));
      return kept.length === prev.length ? prev : kept;
    });
  }, []);

  const snapshots = useMemo(
    () => ids.map((id) => meta[id] ?? { id }), [ids, meta]);

  const value: SelectionCtx = {
    ids, count: ids.length, has, toggle, add, remove, setMany, clear, snapshots, hydrate, reconcile,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePackageSelection(): SelectionCtx {
  const c = useContext(Ctx);
  if (c) return c;
  // Fallback san krach si yon konpozan rann deyò provider la
  return {
    ids: [], count: 0, has: () => false, toggle: () => {}, add: () => {}, remove: () => {},
    setMany: () => {}, clear: () => {}, snapshots: [], hydrate: () => {}, reconcile: () => {},
  };
}
