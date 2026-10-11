/**
 * STANDA COMMERCIAL — Agregasyon done pou grafik Dashboard admin.
 * Fonksyon PUR (san React, san rezo, san Supabase) — fasil pou verifye,
 * reyitilize kote nou vle. `app/dashboard/page.tsx` rele yo ak done
 * `getChartsData()` (lib/db.ts) voye.
 */

export interface SeriesPoint {
  /** Kle estab pou React (ex: "2026-03" oswa "2026-03-14"). */
  key: string;
  /** Tèks pou afiche (ex: "Mar 2026" oswa "14 mar"). */
  label: string;
  value: number;
}

const MOIS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function ymdKey(d: Date): string {
  return `${ymKey(d)}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Dat valab (string ISO/nenpòt fòma `Date` konprann) -> `Date`, sinon null. */
function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const t = new Date(raw);
  return Number.isNaN(t.getTime()) ? null : t;
}

/** Konte evenman yo pa MWA, sou `months` dènye mwa (jodi a enkli, pi ansyen an premye). */
export function bucketByMonth(dates: (string | null | undefined)[], months = 12): SeriesPoint[] {
  const now = new Date();
  const buckets = new Map<string, SeriesPoint>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = ymKey(d);
    buckets.set(key, { key, label: `${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`, value: 0 });
  }
  for (const raw of dates) {
    const d = parseDate(raw);
    if (!d) continue;
    const b = buckets.get(ymKey(d));
    if (b) b.value++;
  }
  return Array.from(buckets.values());
}

/** Konte evenman yo pa JOU, sou `days` dènye jou (jodi a enkli, pi ansyen an premye). */
export function bucketByDay(dates: (string | null | undefined)[], days = 30): SeriesPoint[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const buckets = new Map<string, SeriesPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(ymdKey(d), { key: ymdKey(d), label: `${d.getDate()} ${MOIS_FR[d.getMonth()]}`, value: 0 });
  }
  for (const raw of dates) {
    const d = parseDate(raw);
    if (!d) continue;
    d.setHours(0, 0, 0, 0);
    const b = buckets.get(ymdKey(d));
    if (b) b.value++;
  }
  return Array.from(buckets.values());
}

/** Endis pwen ki gen pi gwo valè a (pou make "pic" la). -1 si tout bagay vid. */
export function peakIndex(series: SeriesPoint[]): number {
  let best = -1;
  for (let i = 0; i < series.length; i++) {
    if (series[i].value > 0 && (best < 0 || series[i].value > series[best].value)) best = i;
  }
  return best;
}

export interface StatusSlice {
  label: string;
  value: number;
  /** Koulè egzak (hex) — pa yon klas Tailwind, pou nou ka sèvi l tankou SVG/style fill. */
  color: string;
}

/**
 * Separe kliyan yo an "Actif" / "En attente d'activation" (+ "Autre" si gen
 * yon lòt valè — pa ta dwe rive, men nou pa kache done si sa rive).
 * Règ: yon kont san estati (null/vid) konsidere Actif — menm règ ak migration
 * v6 la ("Ansyen kliyan yo rete Actif").
 */
export function splitClientStatus(clients: { account_status?: string | null }[]): StatusSlice[] {
  let actif = 0, attente = 0, autre = 0;
  for (const c of clients) {
    const s = String(c.account_status ?? "").trim();
    if (s === "En attente d'activation") attente++;
    else if (s === "Actif" || !s) actif++;
    else autre++;
  }
  const out: StatusSlice[] = [
    { label: "Actif", value: actif, color: "#10B981" },
    { label: "En attente d'activation", value: attente, color: "#F59E0B" },
  ];
  if (autre) out.push({ label: "Autre", value: autre, color: "#94A3B8" });
  return out;
}
