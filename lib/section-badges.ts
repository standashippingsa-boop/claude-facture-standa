"use client";
/*
 * BOULES DE NOTIFICATION PAR SECTION (barre latérale du personnel)
 * ════════════════════════════════════════════════════════════════
 * Toute action du système est écrite dans le Journal. On lit les lignes
 * récentes, on range chaque action dans la ou les sections qu'elle concerne,
 * et on compte ce qui est arrivé depuis la dernière visite de la section.
 * Ouvrir la section remet son compteur à zéro.
 *
 * La date de dernière visite est gardée sur l'appareil (navigateur).
 * Les actions faites par la personne connectée ne lui sont pas signalées.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

type Rule = { href: string; match: RegExp };

/** Quelle action concerne quelle section. Le Journal reçoit tout. */
const RULES: Rule[] = [
  { href: "/dashboard", match: /Inscription Client|Paiement client reçu|Rapport agence|Retrait Facture|Affilié : contrat|Bon de remise reçu/i },
  { href: "/clients", match: /Inscription Client|Activation Client|Compte client activé|Modification client|Modpas kliyan|Zones clients|Identifiants client/i },
  { href: "/packages", match: /Changement Statut|Correction statut|Colis spécial|Suppression Colis|Correction Tracking|Archivage|Modification Prix|Remise colis|Réception|Vérification Scanner/i },
  { href: "/conduces", match: /Conduce/i },
  { href: "/invoices", match: /Facturation|Annulation Facture|Retrait Facture|Paiement client reçu|Facture MCPACK/i },
  { href: "/bon-remise", match: /Bon de remise|Colis rendus disponibles/i },
  { href: "/rapports-financiers", match: /Paiement client reçu|Paiement MCPACK|Facture MCPACK payée|Rapport clôturé|Rapport agence/i },
  { href: "/affiliates", match: /Affili/i },
  { href: "/annonces", match: /Annonce/i },
  { href: "/sync", match: /Extension Chrome|Synchronisation|Import Facture|Import PDF|Analyse Photo|Journal OCR|Photo non identifiée/i },
  { href: "/historique", match: /Remise colis|Remise groupée/i },
  { href: "/points-retrait", match: /Rapport agence|Bon de remise reçu|Remise groupée|Rapport clôturé/i },
  { href: "/settings", match: /Employé|Compte employé/i },
];
const ALL = "/journal";
export const BADGE_SECTIONS = [...RULES.map((r) => r.href), ALL];

type Seen = Record<string, string>;
const storeKey = (staffId: string) => `standa:seen:${staffId}`;

function readLocal(staffId: string): Seen | null {
  try { const raw = window.localStorage.getItem(storeKey(staffId)); return raw ? JSON.parse(raw) as Seen : null; } catch { return null; }
}
function writeLocal(staffId: string, seen: Seen) {
  try { window.localStorage.setItem(storeKey(staffId), JSON.stringify(seen)); } catch { /* stockage indisponible */ }
}
/** Garde la date la plus récente de chaque section. */
function merge(a: Seen | null, b: Seen | null): Seen {
  const out: Seen = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) if (!out[k] || v > out[k]) out[k] = v;
  return out;
}
const sectionOf = (path: string) => BADGE_SECTIONS.find((href) => path === href || path.startsWith(href + "/")) ?? null;

export function useSectionBadges(staff: { id?: string; prenom?: string; nom?: string } | null | undefined, path: string) {
  const staffId = staff?.id ?? "";
  const me = `${staff?.prenom ?? ""} ${staff?.nom ?? ""}`.trim().toLowerCase();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const seenRef = useRef<Seen | null>(null);
  const busy = useRef(false);

  const persist = useCallback((seen: Seen) => {
    seenRef.current = seen;
    writeLocal(staffId, seen);
  }, [staffId]);

  // Date de dernière visite. Première fois : on part de maintenant.
  const ensureSeen = useCallback(async (): Promise<Seen> => {
    if (seenRef.current) return seenRef.current;
    let seen = merge(readLocal(staffId), null);
    if (!Object.keys(seen).length) {
      const now = new Date().toISOString();
      seen = Object.fromEntries(BADGE_SECTIONS.map((href) => [href, now]));
      persist(seen);
    } else {
      for (const href of BADGE_SECTIONS) if (!seen[href]) seen[href] = new Date().toISOString();
      seenRef.current = seen; writeLocal(staffId, seen);
    }
    return seen;
  }, [staffId, persist]);

  const refresh = useCallback(async () => {
    if (!staffId || busy.current || document.visibilityState !== "visible") return;
    busy.current = true;
    try {
      const seen = await ensureSeen();
      const since = Object.values(seen).sort()[0];
      const { data, error } = await supabase.from("journal")
        .select("action, user_name, created_at")
        .gt("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) return;
      const next: Record<string, number> = {};
      for (const row of (data ?? []) as { action: string; user_name: string | null; created_at: string }[]) {
        const who = String(row.user_name ?? "").toLowerCase();
        if (me && who.startsWith(me)) continue;                       // ses propres actions
        if (row.created_at > (seen[ALL] ?? "")) next[ALL] = (next[ALL] ?? 0) + 1;
        for (const rule of RULES) {
          if (rule.match.test(row.action) && row.created_at > (seen[rule.href] ?? "")) next[rule.href] = (next[rule.href] ?? 0) + 1;
        }
      }
      // La section ouverte reste à zéro.
      const open = sectionOf(window.location.pathname);
      if (open) next[open] = 0;
      setCounts(next);
    } finally { busy.current = false; }
  }, [staffId, me, ensureSeen]);

  // Ouvrir une section la marque comme lue ; la quitter aussi (ce qui est
  // arrivé pendant qu'on la regardait est déjà vu).
  const prevOpen = useRef<string | null>(null);
  useEffect(() => {
    if (!staffId) return;
    const open = sectionOf(path);
    const prev = prevOpen.current;
    prevOpen.current = open;
    if (!open && !prev) return;
    void ensureSeen().then((seen) => {
      const now = new Date().toISOString();
      // On garde la visite précédente pour surligner les nouveautés dans la page.
      if (open && open !== prev && seen[open]) {
        try { window.sessionStorage.setItem(`standa:prev-visit:${open}`, seen[open]); } catch { /* indisponible */ }
        window.dispatchEvent(new Event("standa:prev-visit"));
      }
      const next = { ...seen };
      if (open) next[open] = now;
      if (prev) next[prev] = now;
      persist(next);
      setCounts((c) => ({ ...c, ...(open ? { [open]: 0 } : {}), ...(prev ? { [prev]: 0 } : {}) }));
    });
  }, [path, staffId, ensureSeen, persist]);

  useEffect(() => {
    if (!staffId) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [staffId, refresh]);

  return counts;
}

/** Date de la visite précédente d'une section (pour marquer les lignes « Nouveau »). */
export function usePreviousVisit(href: string): string {
  const read = () => { try { return window.sessionStorage.getItem(`standa:prev-visit:${href}`) ?? ""; } catch { return ""; } };
  const [value, setValue] = useState("");
  useEffect(() => {
    setValue(read());
    const on = () => setValue(read());
    window.addEventListener("standa:prev-visit", on);
    return () => window.removeEventListener("standa:prev-visit", on);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href]);
  return value;
}
