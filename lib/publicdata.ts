/*
 * STANDA COMMERCIAL — FRONTYÈ DONE PIBLIK
 * ═══════════════════════════════════════
 * YON SÈL SOUS VERITE pou kesyon an: « kisa yon moun ki PA konekte gen dwa wè? »
 *
 * POUKISA FICHYE SA A EGZISTE
 * ───────────────────────────
 * Sit wèb piblik la louvri pou tout moun. Nenpòt moun sou entènèt ka rele
 * wout tracking la — san kont, san modpas. Donk chak chan nou ekspoze la a
 * se yon chan tout planèt la ka li.
 *
 * Si demen yon moun ajoute yon chan nan tab `packages` (yon nòt entèn, yon
 * telefòn), li PA dwe rive sou sit piblik la pa aksidan. Se pou sa nou pa
 * janm voye yon objè koli dirèkteman: nou KONSTWI yon nouvo objè ak sèlman
 * chan ki nan lis blanch lan. Tout lòt bagay tonbe.
 *
 * RÈG: yon lis BLANCH, pa yon lis nwa. Sa nou pa nonmen isit la pa soti.
 *
 * SA NOU PA JANM EKSPOZE (epi poukisa)
 * ────────────────────────────────────
 *   customer_code   -> se adrès 2 kliyan an; li pèmèt vòlè koli
 *   customer_name   -> idantite yon moun
 *   telefòn/adrès   -> done pèsonèl
 *   pri/taks/fakti  -> enfòmasyon komèsyal prive
 *   kontni          -> yon moun ki eseye nimewo youn apre lòt ta konnen
 *                      kisa ki nan koli moun
 *   vil destinasyon -> ak yon tracking, li di yon vòlè ki agans pou l ale
 *   nòt entèn, conduce_id, invoice_id, mcpack_data -> enfrastrikti entèn
 *
 * SA NOU EKSPOZE (epi poukisa li aksepte)
 * ───────────────────────────────────────
 *   tracking la (jan moun nan tape l) — li deja genyen l
 *   estati a                          — se sa li vin chèche
 *   pwa a                             — DESIZYON BIZNIS konfime: kliyan
 *                                       yo bezwen wè l pou yo estime pri a
 *   dat dènye mouvman an              — kontèks
 *
 * Pou wè tout rès la, fòk moun nan konekte sou kont li. Se règ la.
 */

/** Kolòn EGZAK nou mande bazdone a. Pa gen `select("*")` sou wout piblik. */
export const PUBLIC_PACKAGE_COLUMNS =
  "tracking_number, tracking_manual, status, weight, received_at, created_date, verified_at";

/** Fòm done a jan sit piblik la resevwa l. */
export interface PublicTracking {
  tracking: string;        // sa moun nan tape a (echo)
  status: string;          // estati piblik la
  step: number;            // 1..7 — pou desine liy tan an
  totalSteps: number;
  weight: number;          // lb — 0 si li pa konni
  updatedAt: string | null;// dat dènye mouvman ki konni
}

/** Etap piblik yo — menm lòd ak sistèm entèn nan, san detay entèn. */
export const PUBLIC_STEPS = [
  "Reçu à Miami",
  "En préparation",
  "En transit",
  "Arrivé en Haïti",
  "En route vers agence",
  "Disponible",
  "Livré"
] as const;

/** Fòm minimòm yon liy koli jan wout piblik la li l. */
export interface RawPublicRow {
  tracking_number?: string | null;
  tracking_manual?: string | null;
  status?: string | null;
  weight?: number | string | null;
  received_at?: string | null;
  created_date?: string | null;
  verified_at?: string | null;
}

/**
 * KONSTWI repons piblik la. Nou pa kopye objè a — nou bati yon nouvo objè
 * chan pa chan. Konsa yon nouvo kolòn nan bazdone a PA KA koule deyò.
 */
export function toPublicTracking(row: RawPublicRow, saisie: string): PublicTracking {
  const status = String(row?.status ?? "").trim();
  let step = PUBLIC_STEPS.indexOf(status as (typeof PUBLIC_STEPS)[number]);
  if (status === "Facturé") step = PUBLIC_STEPS.length - 1;
  if (step < 0) step = 0;

  const dates = [row?.verified_at, row?.received_at, row?.created_date]
    .map((d) => String(d ?? "").trim())
    .filter(Boolean);

  const w = Number(row?.weight);

  return {
    tracking: saisie,
    status: status || PUBLIC_STEPS[0],
    step: step + 1,
    totalSteps: PUBLIC_STEPS.length,
    weight: Number.isFinite(w) && w > 0 ? Number(w.toFixed(2)) : 0,
    updatedAt: dates[0] ?? null
  };
}

/**
 * NÒMALIZE sa moun nan tape. Nou aksepte lèt, chif ak tirè sèlman — konsa
 * yon moun pa ka glise yon karaktè jokè (%, _, *) pou l fè yon rechèch laj
 * epi tire plizyè koli alafwa. Se pwoteksyon kont "enumération".
 */
export function normalizePublicTracking(input: unknown): string {
  return String(input ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 60);
}

/** Longè minimòm — anpeche rechèch laj tankou "WR" ki ta bay tout koli. */
export const MIN_TRACKING_LENGTH = 6;
