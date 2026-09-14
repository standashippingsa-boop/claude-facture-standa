import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAuthEmail, clientAuthEmailCandidates } from "./client-auth";

type AuthIdentity = { id: string; email?: string | null };

export type EnsureClientAuthResult =
  | { ok: true; authUserId: string }
  | { ok: false; reason: string };

/**
 * Cherche une identité technique déjà créée pour un code MC. Supabase ne
 * propose pas de recherche directe par e-mail à l'administration; on parcourt
 * donc ses pages seulement pendant une activation ou une réinitialisation.
 */
async function findTechnicalIdentity(svc: SupabaseClient, code: string): Promise<AuthIdentity | null> {
  const wanted = new Set(clientAuthEmailCandidates(code));
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("Impossible de vérifier le compte de connexion.");
    const users = (data.users ?? []) as AuthIdentity[];
    const found = users.find((user) => wanted.has(String(user.email ?? "").trim().toLowerCase()));
    if (found) return found;
    if (users.length < 1000) break;
  }
  return null;
}

/**
 * Garantit qu'un profil client et son identité Supabase pointent toujours vers
 * le même compte. Cette opération est idempotente : elle récupère aussi les
 * anciens comptes dont le courriel technique avait un format historique.
 */
export async function ensureClientAuthAccount(
  svc: SupabaseClient,
  clientId: string,
  code: string,
  password: string,
  options: { activate?: boolean } = {}
): Promise<EnsureClientAuthResult> {
  const { data: client } = await svc.from("clients")
    .select("id, auth_user_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { ok: false, reason: "Client introuvable." };

  // Avant toute modification d'identité, on protège l'unicité du code. Ainsi
  // une tentative d'activation sur un code déjà attribué ne peut jamais
  // modifier le mot de passe du véritable titulaire de ce code.
  if (options.activate) {
    const [{ data: codeOwner }, { data: usernameOwner }] = await Promise.all([
      svc.from("clients").select("id").eq("customer_code", code).maybeSingle(),
      svc.from("clients").select("id").eq("username", code).maybeSingle(),
    ]);
    const owner = codeOwner ?? usernameOwner;
    if (owner && owner.id !== clientId) {
      return { ok: false, reason: `Le code "${code}" est déjà attribué à un autre client.` };
    }
  }

  const canonicalEmail = clientAuthEmail(code);
  let identity: AuthIdentity | null = null;
  let created = false;

  if (client.auth_user_id) {
    const { data, error } = await svc.auth.admin.getUserById(client.auth_user_id);
    if (!error && data.user) identity = data.user as AuthIdentity;
  }

  if (!identity) {
    try {
      identity = await findTechnicalIdentity(svc, code);
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : "Vérification du compte impossible." };
    }
  }

  if (identity) {
    const { data: owner } = await svc.from("clients").select("id")
      .eq("auth_user_id", identity.id).maybeSingle();
    if (owner && owner.id !== clientId) {
      return { ok: false, reason: "Ce compte de connexion est déjà associé à un autre client." };
    }
    const { error } = await svc.auth.admin.updateUserById(identity.id, {
      email: canonicalEmail,
      password,
      email_confirm: true,
    });
    if (error) return { ok: false, reason: "Mise à jour du compte impossible. Réessayez." };
  } else {
    const { data, error } = await svc.auth.admin.createUser({
      email: canonicalEmail,
      password,
      email_confirm: true,
    });
    if (error || !data.user) return { ok: false, reason: "Création du compte impossible. Réessayez." };
    identity = data.user as AuthIdentity;
    created = true;
  }

  const update: Record<string, unknown> = {
    auth_user_id: identity.id,
    username: code,
    must_change_password: false,
  };
  if (options.activate) {
    update.customer_code = code;
    update.account_status = "Actif";
  }
  const { error: profileError } = await svc.from("clients").update(update).eq("id", clientId);
  if (profileError) {
    if (created) await svc.auth.admin.deleteUser(identity.id).catch(() => null);
    return { ok: false, reason: "Mise à jour du profil impossible. Réessayez." };
  }

  return { ok: true, authUserId: identity.id };
}
