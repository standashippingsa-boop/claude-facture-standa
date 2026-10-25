import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { clientAuthEmail } from "./client-auth";
import { pickupLabel, pickupLocationForCity } from "./pickup-location";
import { normalizeMcCode } from "./utils";

/*
 * MODIFICATION D'UN CLIENT, PARTOUT À LA FOIS
 * ═══════════════════════════════════════════
 * Le code MC, le nom et le WhatsApp sont recopiés dans d'autres tables
 * (colis, factures, demandes de retrait, appareils de notification) et dans
 * l'identifiant de connexion du client. Quand l'administration modifie la
 * fiche, tout est mis à jour ici, côté serveur, pour qu'aucun écran ne garde
 * l'ancienne valeur. Le journal garde l'historique tel quel (traçabilité).
 */

export type ClientEditInput = {
  customer_code: string; fullname: string; surname: string; whatsapp: string; phone: string;
  email: string; address: string; ville_id: string; account_type: string; vip_price_per_lb: string | number | null;
  id_type: string; id_number: string;
};

export type ClientEditResult =
  | { ok: true; changes: string[]; warnings: string[] }
  | { ok: false; reason: string };

const clean = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const ACCOUNT_TYPES = new Set(["Personnel", "Business", "VIP"]);

export async function updateClientEverywhere(
  svc: SupabaseClient, clientId: string, input: ClientEditInput, opts: { isAdmin: boolean }
): Promise<ClientEditResult> {
  const { data: before, error: readError } = await svc.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (readError || !before) return { ok: false, reason: "Client introuvable." };

  const oldCode = String(before.customer_code ?? "").trim();
  const oldUsername = String(before.username ?? "").trim();
  const rawCode = clean(input.customer_code, 40);
  const newCode = rawCode ? normalizeMcCode(rawCode) : "";
  const fullname = clean(input.fullname, 80);
  const surname = clean(input.surname, 80);
  const whatsapp = clean(input.whatsapp, 30);
  const phone = clean(input.phone, 30);
  const email = clean(input.email, 120).toLowerCase();
  const address = clean(input.address, 200);
  const idType = clean(input.id_type, 50);
  const idNumber = clean(input.id_number, 80);
  const accountType = ACCOUNT_TYPES.has(input.account_type) ? input.account_type : "Personnel";

  if (fullname.length < 1) return { ok: false, reason: "Le prénom est obligatoire." };
  if (oldCode && !newCode) return { ok: false, reason: "Le code client ne peut pas être vidé." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, reason: "Adresse électronique invalide." };
  for (const [label, value] of [["Téléphone", phone], ["WhatsApp", whatsapp]] as const) {
    if (value && !/^[\d\s+().-]{7,30}$/.test(value)) return { ok: false, reason: `${label} invalide.` };
  }

  // Tarif VIP : seul l'administrateur le fixe.
  let vipPrice: number | null = before.vip_price_per_lb ?? null;
  if (accountType === "VIP") {
    if (opts.isAdmin) {
      const p = Number(String(input.vip_price_per_lb ?? "").replace(",", "."));
      if (!(Number.isFinite(p) && p > 0)) return { ok: false, reason: "Encodez le prix VIP par livre (ex. 2,50)." };
      vipPrice = Math.round(p * 100) / 100;
    } else if (before.account_type !== "VIP") {
      return { ok: false, reason: "Seul l'administrateur peut passer un client en VIP." };
    }
  } else vipPrice = null;

  // Code unique.
  const codeChanged = !!newCode && newCode !== oldCode;
  if (codeChanged) {
    const [{ data: a }, { data: b }] = await Promise.all([
      svc.from("clients").select("id").eq("customer_code", newCode).neq("id", clientId).maybeSingle(),
      svc.from("clients").select("id").eq("username", newCode).neq("id", clientId).maybeSingle(),
    ]);
    if (a || b) return { ok: false, reason: `Le code « ${newCode} » appartient déjà à un autre client.` };
  }

  // Ville → agence (même règle que l'inscription).
  const patch: Record<string, unknown> = {
    fullname, surname, whatsapp, phone, email: email || null, address,
    id_type: idType, id_number: idNumber, account_type: accountType, vip_price_per_lb: vipPrice,
  };
  if (newCode) patch.customer_code = newCode;
  if (codeChanged && (!oldUsername || oldUsername === oldCode)) patch.username = newCode;
  const villeId = clean(input.ville_id, 36);
  if (villeId && villeId !== before.ville_id) {
    const { data: ville } = await svc.from("villes").select("id, name").eq("id", villeId).maybeSingle();
    if (!ville) return { ok: false, reason: "Ville introuvable." };
    const { data: agencies } = await svc.from("agences").select("nom, ordre, adresse").eq("active", true);
    const agency = pickupLocationForCity(ville.name, agencies ?? []);
    patch.ville_id = ville.id; patch.city = ville.name;
    if (agency) patch.pickup_location = pickupLabel(agency);
  }

  // Identifiant de connexion d'abord : s'il échoue, rien n'est modifié.
  const warnings: string[] = [];
  if (codeChanged && before.auth_user_id) {
    const { error } = await svc.auth.admin.updateUserById(before.auth_user_id, { email: clientAuthEmail(newCode), email_confirm: true });
    if (error) return { ok: false, reason: "Impossible de changer l'identifiant de connexion du client. Rien n'a été modifié." };
  }

  const { error: updateError } = await svc.from("clients").update(patch).eq("id", clientId);
  if (updateError) {
    if (codeChanged && before.auth_user_id && oldCode) {
      await svc.auth.admin.updateUserById(before.auth_user_id, { email: clientAuthEmail(oldCode), email_confirm: true });
    }
    return { ok: false, reason: "Enregistrement impossible." };
  }

  const changes: string[] = [];
  const oldName = [before.fullname, before.surname].filter(Boolean).join(" ").trim();
  const newName = [fullname, surname].filter(Boolean).join(" ").trim();
  const nameChanged = newName !== oldName;
  const whatsappChanged = whatsapp !== String(before.whatsapp ?? "").trim();
  const keys = Array.from(new Set([oldCode, oldUsername].filter(Boolean)));
  const finalCode = newCode || oldCode;

  // Recopie dans les autres tables.
  if (keys.length && (codeChanged || nameChanged || whatsappChanged)) {
    const run = async (table: string, values: Record<string, unknown>) => {
      if (!Object.keys(values).length) return;
      const { error } = await svc.from(table).update(values).in("customer_code", keys);
      if (error) warnings.push(table);
    };
    const named = (extra: Record<string, unknown>) => ({
      ...(codeChanged ? { customer_code: finalCode } : {}),
      ...(nameChanged ? { customer_name: newName } : {}),
      ...extra,
    });
    await run("packages", named({}));
    await run("invoices", named(whatsappChanged ? { whatsapp } : {}));
    await run("retraits", named({}));
    if (codeChanged) {
      await run("fcm_device_tokens", { customer_code: finalCode });
      await run("push_subscriptions", { customer_code: finalCode });
    }
  }
  if (codeChanged) changes.push(`code ${oldCode || "aucun"} → ${finalCode}`);
  if (nameChanged) changes.push(`nom « ${oldName} » → « ${newName} »`);
  if (whatsappChanged) changes.push("WhatsApp");
  for (const [k, label] of [["phone", "téléphone"], ["email", "courriel"], ["address", "adresse"], ["account_type", "type de compte"], ["id_number", "pièce d'identité"]] as const) {
    if (String(before[k] ?? "") !== String(patch[k] ?? "")) changes.push(label);
  }
  if (patch.ville_id) changes.push(`ville → ${patch.city}`);
  return { ok: true, changes, warnings };
}
