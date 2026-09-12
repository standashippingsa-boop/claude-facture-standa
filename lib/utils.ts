const thousands = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
export const usd = (n: number | string) => {
  const [i, d] = Number(n || 0).toFixed(2).split(".");
  return "$" + thousands(i) + "." + d;
};
export const htg = (n: number | string) => {
  const [i, d] = Number(n || 0).toFixed(2).split(".");
  return thousands(i) + "." + d + " HTG";
};
/** Kenbe ansyen non an pou konpatibilite: tarif/fakti yo an USD */
export const money = usd;
export const dateFr = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR") : "";

export function num(raw: unknown): number {
  if (raw == null) return 0;
  let s = String(raw).replace(/[^0-9.,\-]/g, "").trim();
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Konvèti dat MCPACK (jan li ekri a) an timestamp pou TRIYAJ sèlman.
 * Sipòte: 26/06/2026, 26-06-2026, 2026.07.03, 2026-07-03, 2026/07/03.
 * Afichaj la rete egzakteman jan MCPACK bay li a — fonksyon sa a pa chanje fòma.
 */
export function parseMcpackDate(s?: string | null): number {
  if (!s) return 0;
  const t = String(s).trim();
  let m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);          // jj/mm/aaaa
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
  m = t.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);              // aaaa.mm.jj
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  const d = Date.parse(t);
  return isNaN(d) ? 0 : d;
}

/**
 * Lis operasyon yo swiv avansman reyèl koli a. Sa bay menm lòd la sou admin,
 * dosye kliyan ak pwen retrè: Disponib/Facturé -> vers agence -> arrivé en
 * Haïti -> transit -> reçu à Miami. Lè de koli nan menm etap la, dènye aktivite
 * a rete anwo pou ansyen dosye yo desann otomatikman.
 */
type PackageListRow = {
  status?: string | null;
  created_date?: string | null;
  received_at?: string | null;
  delivered_at?: string | null;
};

export function packageProgressPriority(status?: string | null): number {
  switch (String(status || "").trim()) {
    case "Disponible":
    case "Facturé": return 0;
    case "En route vers agence": return 1;
    case "Arrivé en Haïti": return 2;
    case "En transit":
    case "En préparation": return 3;
    case "Reçu à Miami": return 4;
    default: return 5;
  }
}

export function sortPackagesAvailableFirst<T extends PackageListRow>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const priorityDifference = packageProgressPriority(left.status) - packageProgressPriority(right.status);
    if (priorityDifference) return priorityDifference;

    const activityAt = (item: PackageListRow) =>
      parseMcpackDate(item.delivered_at || item.received_at || item.created_date);
    return activityAt(right) - activityAt(left);
  });
}

/**
 * Nòmalize yon Customer Code: "25487" -> "MC-25487", "mc-25487" -> "MC-25487".
 * Kle inik kliyan an — menm fòma toupatou (clients, packages, invoices, retraits).
 */
export function normalizeMcCode(raw?: string | null): string {
  const s = String(raw ?? "").trim().replace(/\s+/g, "");
  if (!s) return "";
  const up = s.toUpperCase();
  return up.startsWith("MC-") ? up : up.startsWith("MC") && /^MC\d/.test(up) ? "MC-" + up.slice(2) : "MC-" + up.replace(/^-+/, "");
}

/**
 * KLASIFIKASYON TRACKING (V8.5)
 * ─────────────────────────────
 * Tracking ID (Guía) = tout kòd ki kòmanse ak "WR" (ex: WR102600143471).
 * Tracking Number    = tout lòt (GFUS..., TBA..., 1Z..., 9400..., UUS..., SPX...).
 * De kolòn sa yo pa dwe JANM melanje.
 */
export const isGuia = (v?: string | null): boolean =>
  /^WR\d{6,}$/i.test(String(v ?? "").trim());

/** Retire espas/karaktè envizib nan yon kòd tracking. */
export const cleanTracking = (v?: string | null): string =>
  String(v ?? "").trim().replace(/\s+/g, "").toUpperCase();
