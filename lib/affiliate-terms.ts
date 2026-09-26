/**
 * PWOGRAM AFFILIATION — kondisyon peman (menm valè ak kontra PDF la, atik 6).
 * Komisyon yo kalkile an USD men yo peye SÈLMAN an goud, a to fiks sa a,
 * pa MonCash oswa NatCash. Si to a chanje, fò kontra PDF la chanje tou.
 */
export const AFFILIATE_PAYOUT_RATE_HTG = 132.5;
export const AFFILIATE_PAYOUT_METHODS = ["MonCash", "NatCash"] as const;
export type AffiliatePayoutMethod = typeof AFFILIATE_PAYOUT_METHODS[number];

export const toPayoutHtg = (usd: number) => Math.round(Number(usd || 0) * AFFILIATE_PAYOUT_RATE_HTG * 100) / 100;

export const formatHtg = (value: number) =>
  `${new Intl.NumberFormat("fr-HT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))} HTG`;

/** Bucket Storage kote kontra siyen yo antre (prive — sèlman lyen siyen). */
export const SIGNED_CONTRACT_BUCKET = "affiliate-contracts";

/** Kontra siyen: PDF (eskane) oswa foto. Limit = bucket affiliate-contracts. */
export const SIGNED_CONTRACT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};
const SIGNED_CONTRACT_EXT_BY_FILE_EXT: Record<string, string> = { pdf: "pdf", jpg: "jpg", jpeg: "jpg", png: "png" };
export const SIGNED_CONTRACT_MAX_BYTES = 15 * 1024 * 1024;

/**
 * Rezoud ekstansyon kontra siyen an: MIME an premye; si li vid (kèk
 * navigatè/telefòn/app eskane pa bay MIME), nou tonbe sou ekstansyon non
 * fichye a — menm apwòch ak `validateUpload` nan lib/upload.ts.
 */
export function resolveSignedContractExt(contentType: string, filename?: string): string | undefined {
  const type = String(contentType ?? "").toLowerCase();
  const byMime = SIGNED_CONTRACT_TYPES[type];
  if (byMime) return byMime;
  if (type) return undefined; // MIME prezan men pa rekonèt — pa fè sipozisyon
  const ext = String(filename ?? "").split(".").pop()?.toLowerCase() ?? "";
  return SIGNED_CONTRACT_EXT_BY_FILE_EXT[ext];
}

/**
 * MIME kanonik pou yon ekstansyon rezoud. Bucket la refize tout lòt MIME
 * (allowed_mime_types): yon fichye san MIME ta monte kòm
 * application/octet-stream epi Storage ta rejte l — fò navigatè a re-etikte
 * l ak MIME sa a anvan l voye l.
 */
export function signedContractMime(ext: string): string {
  return Object.entries(SIGNED_CONTRACT_TYPES).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
}
