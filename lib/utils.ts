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
