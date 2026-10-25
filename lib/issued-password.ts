import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey, getSupabaseSecretKey, getSupabaseUrl } from "./supabase-server";
import { clientAuthEmail } from "./client-auth";

/*
 * DERNIER MOT DE PASSE REMIS AU CLIENT (copie chiffrée)
 * ═════════════════════════════════════════════════════
 * Le vrai mot de passe reste haché par Supabase. Pour pouvoir le renvoyer au
 * client sans le changer, le serveur garde une copie CHIFFRÉE (AES-256-GCM)
 * du dernier mot de passe que STANDA lui a remis, dans app_metadata du compte
 * de connexion (seul le serveur peut écrire ce champ). Avant de la renvoyer,
 * on vérifie qu'elle ouvre encore le compte : si le client a choisi lui-même
 * un autre mot de passe, on ne renvoie rien.
 */
const ALGO = "aes-256-gcm";

function key(): Buffer {
  const hex = process.env.PII_ENCRYPTION_KEY?.trim() ?? "";
  if (hex.length === 64) return Buffer.from(hex, "hex");
  // Sans clé dédiée : clé dérivée du secret serveur Supabase (jamais envoyé au navigateur).
  const secret = getSupabaseSecretKey();
  if (!secret) throw new Error("Clé serveur absente.");
  return createHash("sha256").update("standa:issued-password:" + secret).digest();
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["p1", iv.toString("hex"), cipher.getAuthTag().toString("hex"), data.toString("hex")].join(":");
}

function decrypt(blob: string): string | null {
  try {
    const [v, iv, tag, data] = blob.split(":");
    if (v !== "p1") return null;
    const decipher = createDecipheriv(ALGO, key(), Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(data, "hex")), decipher.final()]).toString("utf8");
  } catch { return null; }
}

/** Enregistre la copie chiffrée après une activation ou un nouveau mot de passe. */
export async function rememberIssuedPassword(svc: SupabaseClient, authUserId: string, password: string): Promise<void> {
  try {
    const { data } = await svc.auth.admin.getUserById(authUserId);
    const meta = (data.user?.app_metadata ?? {}) as Record<string, unknown>;
    await svc.auth.admin.updateUserById(authUserId, { app_metadata: { ...meta, issued_pw: encrypt(password) } });
  } catch (error) {
    // Ne bloque jamais l'activation : on pourra toujours envoyer un nouveau mot de passe.
    console.error("[issued-password] enregistrement impossible :", error instanceof Error ? error.message : error);
  }
}

export type IssuedPasswordResult =
  | { ok: true; password: string }
  | { ok: false; reason: string };

/** Relit la copie et vérifie qu'elle ouvre toujours le compte du client. */
export async function readIssuedPassword(svc: SupabaseClient, authUserId: string, code: string): Promise<IssuedPasswordResult> {
  const { data } = await svc.auth.admin.getUserById(authUserId);
  const blob = String((data.user?.app_metadata as Record<string, unknown> | undefined)?.issued_pw ?? "");
  const password = blob ? decrypt(blob) : null;
  if (!password) {
    return { ok: false, reason: "Aucun mot de passe enregistré pour ce client (compte activé avant cette fonction). Envoyez-lui un nouveau mot de passe." };
  }
  const url = getSupabaseUrl(); const anon = getSupabasePublishableKey();
  if (url && anon) {
    const probe = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: signed, error } = await probe.auth.signInWithPassword({ email: clientAuthEmail(code), password });
    if (error || !signed.session) {
      const msg = String(error?.message ?? "").toLowerCase();
      if (msg.includes("rate") || msg.includes("too many")) return { ok: false, reason: "Trop de vérifications. Réessayez dans une minute." };
      return { ok: false, reason: "Le client a changé son mot de passe lui-même. Envoyez-lui un nouveau mot de passe." };
    }
    // Pas de signOut : il fermerait aussi les sessions ouvertes du client.
  }
  return { ok: true, password };
}
