import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * CHIFRAMAN DONE PÈSONÈL (PII) — telefòn ak adrès kliyan.
 * ═══════════════════════════════════════════════════════
 * AES-256-GCM: chiffrement authentifié (un tag empêche toute modification
 * silencieuse du blob chiffré), IV aléatoire à chaque appel (deux clients
 * avec le même numéro ne produisent jamais le même texte chiffré).
 *
 * Format stocké: "v1:<iv_hex>:<tag_hex>:<ciphertext_hex>" — le préfixe de
 * version permet de faire évoluer l'algorithme plus tard sans casser les
 * valeurs déjà en base. Ce module ne s'importe que côté serveur ("server-only").
 *
 * ⚠️ La clé (PII_ENCRYPTION_KEY, 64 caractères hex = 32 octets) doit être
 * définie dans Vercel (jamais dans le dépôt). Générez-en une avec:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * Perdre cette clé rend TOUTES les données chiffrées irrécupérables —
 * conservez-la aussi dans un coffre séparé (ex: gestionnaire de mots de passe
 * de l'entreprise), pas seulement dans Vercel.
 */
const ALGO = "aes-256-gcm";
const IV_LEN = 12; // taille recommandée pour GCM

function getKey(): Buffer {
  const hex = process.env.PII_ENCRYPTION_KEY?.trim() ?? "";
  if (hex.length !== 64) {
    throw new Error(
      "PII_ENCRYPTION_KEY manquante ou invalide (il faut 64 caractères hex = 32 octets)."
    );
  }
  return Buffer.from(hex, "hex");
}

/** Chiffre une chaîne. Chaîne vide -> chaîne vide (rien à protéger). */
export function encryptPII(plain: string): string {
  const value = String(plain ?? "");
  if (!value) return "";
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Déchiffre une valeur produite par encryptPII. Par sécurité (jamais planter
 * l'appelant sur une donnée corrompue ou une mauvaise clé), retourne ""
 * en cas d'échec plutôt que de lever une exception.
 *
 * Filet de compatibilité: une valeur qui ne commence pas par "v1:" est
 * considérée comme une ancienne donnée en clair (avant migration) et
 * retournée telle quelle. À retirer une fois le backfill terminé — voir
 * scripts/encrypt-existing-pii.mjs.
 */
export function decryptPII(stored: string | null | undefined): string {
  const value = String(stored ?? "");
  if (!value) return "";
  if (!value.startsWith("v1:")) return value;
  const parts = value.split(":");
  if (parts.length !== 4) return "";
  const [, ivHex, tagHex, dataHex] = parts;
  try {
    const key = getKey();
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const plain = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return "";
  }
}
