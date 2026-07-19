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
 * Nòmalize yon Customer Code: "25487" -> "MC-25487", "mc-25487" -> "MC-25487".
 * Kle inik kliyan an — menm fòma toupatou (clients, packages, invoices, retraits).
 */
export function normalizeMcCode(raw?: string | null): string {
  const s = String(raw ?? "").trim().replace(/\s+/g, "");
  if (!s) return "";
  const up = s.toUpperCase();
  return up.startsWith("MC-") ? up : up.startsWith("MC") && /^MC\d/.test(up) ? "MC-" + up.slice(2) : "MC-" + up.replace(/^-+/, "");
}
