import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Lecture sûre du corps d'une requête (routes publiques).
 *  1. Taille maximale : un envoi trop gros est refusé avant d'être lu en entier.
 *  2. JSON valide uniquement.
 *  3. Contrôle zod : types et longueurs ; le premier problème est renvoyé.
 * Une requête refusée ne touche jamais la base de données.
 */
export async function readJsonBody<S extends z.ZodTypeAny>(
  req: Request, schema: S, maxBytes = 32_000
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  const refuse = (reason: string, status: number) => ({ ok: false as const, response: NextResponse.json({ ok: false, reason }, { status }) });
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return refuse("Envoi trop volumineux.", 413);
  let text = "";
  try { text = await req.text(); } catch { return refuse("Demande invalide.", 400); }
  if (text.length > maxBytes) return refuse("Envoi trop volumineux.", 413);
  let raw: unknown;
  try { raw = text ? JSON.parse(text) : {}; } catch { return refuse("Demande invalide.", 400); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return refuse(parsed.error.issues[0]?.message ?? "Demande invalide.", 400);
  return { ok: true, data: parsed.data };
}

/** Objet JSON quelconque : seule la taille est contrôlée (la route vérifie le détail). */
export const anyObject = z.record(z.unknown());

/** Formulaire de contact du site. */
export const contactSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(80, "Nom trop long."),
  email: z.string().trim().max(120, "Courriel trop long.").optional().default(""),
  phone: z.string().trim().max(30, "Téléphone trop long.").optional().default(""),
  subject: z.string().trim().max(120, "Sujet trop long.").optional().default(""),
  message: z.string().trim().min(1, "Le message est obligatoire.").max(3000, "Message trop long : 3000 caractères maximum."),
  website: z.string().max(200).optional().default(""),
});
