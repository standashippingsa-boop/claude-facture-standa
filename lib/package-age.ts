import { parseMcpackDate } from "./utils";

/*
 * Laj yon koli — konbyen jou li gen depi l rive Miami.
 * ════════════════════════════════════════════════
 * Referans lan se « Creado » MCPACK (`created_date`) : jou koli a rive nan
 * adrès Miami a. `created_at` se jou koli a antre nan SISTÈM nou an ; si de
 * dat sa yo lwen youn ak lòt, koli a te la lontan anvan nou te konnen l.
 */

/** Yon koli ki pa nan okenn Conduce apre kantite jou sa a dwe siyale. */
export const SANS_CONDUCE_JOURS = 7;
/** Ekar (an jou) ant arive Miami ak antre nan sistèm nan ki fè l « ajouté en retard ». */
export const AJOUT_TARDIF_JOURS = 7;
/** Yon koli « fèk ajoute » si l antre nan sistèm nan nan dènye jou sa yo. */
export const AJOUT_RECENT_JOURS = 3;

type AgeInput = { created_date?: string | null; received_at?: string | null; created_at?: string | null };

const DAY = 86_400_000;
const midnight = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const toTime = (s?: string | null) => {
  if (!s) return 0;
  const t = parseMcpackDate(s) || new Date(s).getTime();
  return t && !isNaN(t) ? t : 0;
};

/** Jou depi koli a rive Miami (0 = jodi a). received_at se sèlman yon ranplasman. */
export function joursDepuisArrivee(p: AgeInput, now = Date.now()): number | null {
  const t = toTime(p.created_date) || toTime(p.received_at);
  if (!t) return null;
  const d = Math.round((midnight(now) - midnight(t)) / DAY);
  return d >= 0 ? d : null;
}

/** Konbyen jou koli a te pase Miami anvan l antre nan sistèm nan. */
export function joursAvantAjout(p: AgeInput): number | null {
  const arrivee = toTime(p.created_date);
  const ajout = toTime(p.created_at);
  if (!arrivee || !ajout) return null;
  const d = Math.round((midnight(ajout) - midnight(arrivee)) / DAY);
  return d >= 0 ? d : null;
}

/** Fèk antre nan sistèm nan, men li te rive Miami depi lontan. */
export function estAjoutTardif(p: AgeInput, now = Date.now()): boolean {
  const ajout = toTime(p.created_at);
  const avant = joursAvantAjout(p);
  return !!ajout && avant != null && avant >= AJOUT_TARDIF_JOURS && now - ajout <= AJOUT_RECENT_JOURS * DAY;
}

/** Koli ki ta dwe deja nan yon Conduce. */
export function estSansConduceTropLongtemps(
  p: AgeInput & { conduce_id?: string | null; status?: string | null; archived?: boolean | null },
  now = Date.now()
): boolean {
  if (p.conduce_id || p.archived || p.status === "Livré" || p.status === "Facturé") return false;
  const j = joursDepuisArrivee(p, now);
  return j != null && j >= SANS_CONDUCE_JOURS;
}
