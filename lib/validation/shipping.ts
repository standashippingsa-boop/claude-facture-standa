import { z } from "zod";

/**
 * VALIDASYON ZOD — FÒM SHIPPING (adrès, pwa, detay livrezon).
 * ═══════════════════════════════════════════════════════════
 * Sèl kote sa a defini règ yo, pou tout wout API rele MENM sekma a olye
 * chak wout envante pwòp regex/limit pa li — sa evite yon wout ki bliye
 * yon verifikasyon yon lòt gen deja.
 */

export const addressSchema = z.string()
  .trim()
  .min(3, "Adresse trop courte.")
  .max(200, "Adresse trop longue (200 caractères max).");

// Telefòn/WhatsApp: chif, espas, +, (), - sèlman — 7 a 30 karaktè.
export const phoneSchema = z.string()
  .trim()
  .regex(/^[\d\s+().-]{7,30}$/, "Numéro de téléphone invalide.");

export const villeIdSchema = z.string()
  .uuid("Sélectionnez une ville dans la liste.");

/** Pwa yon koli (kg) — jamè negatif, jamè yon valè absid (erè sezi). */
export const weightSchema = z.coerce.number()
  .finite("Poids invalide.")
  .nonnegative("Le poids ne peut pas être négatif.")
  .max(500, "Poids invalide (max 500 kg).");

/** Detay livrezon/profil shipping kliyan an — itilize nan enskripsyon. */
export const clientShippingSchema = z.object({
  address: addressSchema,
  phone: phoneSchema,
  whatsapp: phoneSchema,
  ville_id: villeIdSchema,
});

/** Yon koli k ap antre (ex: extension Chrome MCPACK, ingest agence). */
export const incomingPackageSchema = z.object({
  guia: z.string().trim().regex(/^WR\d{6,}$/i, "Guía invalide (doit commencer par WR)."),
  tracking_number: z.string().trim().max(64).optional(),
  customer_code: z.string().trim().max(30).optional(),
  customer_name: z.string().trim().max(120).optional(),
  weight: weightSchema.optional(),
  content: z.string().trim().max(500).optional(),
  created_date: z.string().trim().max(40).optional(),
  status_raw: z.string().trim().max(120).optional(),
});

/** Anvlòp batch pou /api/ingest — limit gwosè batch la anplis chak eleman. */
export const ingestBatchSchema = z.object({
  packages: z.array(z.unknown()).min(1, "Aucun package reçu.").max(500, "Trop de colis en un seul envoi (max 500)."),
});

/** Aplike sekma a sou yon sèl eleman, san fè tout batch la echwe pou 1 move liy. */
export function safeParsePackage(raw: unknown) {
  return incomingPackageSchema.safeParse(raw);
}
