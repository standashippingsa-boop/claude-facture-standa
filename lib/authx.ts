"use client";
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabase";
import { Staff, StaffRole } from "./types";
import { normalizeMcCode } from "./utils";
import { clientAuthEmail, clientAuthEmailCandidates } from "./client-auth";

/** Username -> imèl sentetik (Supabase Auth mande imèl; kliyan pa janm wè sa) */
export const staffEmail = (u: string) => `${u.trim().toLowerCase()}@staff.standacommercialsa.com`;
export const clientEmail = clientAuthEmail;

export type ClientSignInFailure = "configuration" | "unconfirmed" | "network" | "rate_limited" | "invalid";
export type ClientSignInResult = { ok: true } | { ok: false; reason: ClientSignInFailure };

/**
 * Connexion client centralisée pour les deux portes d'entrée (/login et PWA).
 *
 * Les comptes clients utilisent une adresse technique dérivée du code MC. Le
 * mot de passe est volontairement conservé exactement tel que l'utilisateur
 * l'a saisi : supprimer des espaces de début ou de fin modifierait un mot de
 * passe valide et provoquerait un refus incompréhensible.
 */
export async function signInClientWithCode(inputCode: string, password: string): Promise<ClientSignInResult> {
  if (!isSupabaseConfigured) return { ok: false, reason: "configuration" };

  const raw = inputCode.trim();
  const normalized = normalizeMcCode(raw);
  const candidates = clientAuthEmailCandidates(raw);
  let networkFailed = false;
  let unconfirmed = false;

  for (const email of candidates) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (!error && data.session) {
        // Un compte ancien peut encore utiliser l'ancienne forme technique du
        // code MC. Après preuve du mot de passe, le serveur le remet sur la
        // forme actuelle sans interrompre la connexion du client.
        try {
          await fetch("/api/client-auth/reconcile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: data.session.access_token, code: normalized }),
          });
        } catch {
          // La session déjà validée reste utilisable même si la réparation est
          // momentanément indisponible; elle sera rejouée à la prochaine connexion.
        }
        return { ok: true };
      }
      const message = String(error?.message ?? "").toLowerCase();
      if (message.includes("not confirmed")) unconfirmed = true;
      if (message.includes("too many requests") || message.includes("rate limit") || message.includes("security purposes")) {
        return { ok: false, reason: "rate_limited" };
      }
      if (message.includes("fetch") || message.includes("network") || message.includes("timeout")) networkFailed = true;
    } catch {
      networkFailed = true;
    }
  }

  if (unconfirmed) return { ok: false, reason: "unconfirmed" };
  if (networkFailed) return { ok: false, reason: "network" };
  return { ok: false, reason: "invalid" };
}

export function clientSignInErrorMessage(reason: ClientSignInFailure, code: string): string {
  if (reason === "configuration") {
    return "Le service de connexion n'est pas configuré sur cet ordinateur. Ajoutez les clés publiques Supabase dans le fichier .env.local, puis redémarrez l'application.";
  }
  if (reason === "unconfirmed") {
    return "Votre compte n'est pas encore activé. Contactez Standa Commercial sur WhatsApp.";
  }
  if (reason === "network") {
    return "Impossible de joindre le service de connexion. Vérifiez votre connexion internet puis réessayez.";
  }
  if (reason === "rate_limited") {
    return "Trop de tentatives de connexion ont été détectées. Attendez quelques minutes avant de réessayer.";
  }
  return `Le code ${code || "MC-XXXXX"} ou le mot de passe est incorrect. Vérifiez votre encodage, puis réessayez.`;
}

export async function getMyStaff(): Promise<Staff | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: s } = await supabase.from("staff").select("*")
    .eq("auth_user_id", data.user.id).maybeSingle();
  return (s as Staff) ?? null;
}

/**
 * Qui est connecté ? Contrairement à getMyStaff(), une PANNE (réseau coupé,
 * Supabase qui répond 503/522, délai dépassé) n'est jamais confondue avec
 * « personne n'est connecté ».
 *
 * Pourquoi : le Shell renvoyait l'administrateur vers /login dès qu'une
 * lecture échouait ; /login le renvoyait aussitôt vers /dashboard (il est
 * bien connecté) ; le tableau de bord se rechargeait, échouait de nouveau…
 * L'écran clignotait entre les deux pages et chaque tour envoyait une
 * rafale de requêtes qui surchargeait encore plus Supabase.
 */
export type WhoAmI =
  | { kind: "staff"; staff: Staff }
  | { kind: "client" }
  | { kind: "none" }
  | { kind: "error" };

export async function whoAmI(): Promise<WhoAmI> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!data.user) {
      // Pas de session enregistrée, ou session refusée par Supabase (401/403) :
      // vraiment déconnecté. Tout le reste (réseau, 5xx) = panne passagère.
      const status = (error as { status?: number } | null)?.status;
      const loggedOut = !error || error.name === "AuthSessionMissingError" || status === 401 || status === 403;
      return loggedOut ? { kind: "none" } : { kind: "error" };
    }
    const staff = await supabase.from("staff").select("*").eq("auth_user_id", data.user.id).maybeSingle();
    if (staff.error) return { kind: "error" };
    if (staff.data) return { kind: "staff", staff: staff.data as Staff };
    const client = await supabase.from("clients").select("id").eq("auth_user_id", data.user.id).maybeSingle();
    if (client.error) return { kind: "error" };
    return client.data ? { kind: "client" } : { kind: "none" };
  } catch {
    return { kind: "error" };
  }
}

/** Hook wòl (pou kache bouton efase yo pou Employé, elatriye) */
export function useRole(): { role: StaffRole | null; loading: boolean; staff: Staff | null } {
  const [role, setRole] = useState<StaffRole | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getMyStaff().then((s) => { setStaff(s); setRole(s?.role ?? null); setLoading(false); });
  }, []);
  return { role, loading, staff };
}

/** Rele API admin-auth la ak token sesyon an */
export async function adminApi(action: string, payload: Record<string, unknown> = {}) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/admin-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, token: data.session?.access_token ?? "", ...payload })
  });
  return res.json();
}
