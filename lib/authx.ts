"use client";
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabase";
import { Staff, StaffRole } from "./types";
import { normalizeMcCode } from "./utils";

/** Username -> imèl sentetik (Supabase Auth mande imèl; kliyan pa janm wè sa) */
export const staffEmail = (u: string) => `${u.trim().toLowerCase()}@staff.standacommercialsa.com`;
export const clientEmail = (mc: string) => `${mc.trim().toLowerCase()}@client.standacommercialsa.com`;

export type ClientSignInFailure = "configuration" | "unconfirmed" | "network" | "invalid";
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
  const candidates = Array.from(new Set([normalized, raw.toUpperCase(), raw].filter(Boolean)));
  let networkFailed = false;
  let unconfirmed = false;

  for (const code of candidates) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: clientEmail(code),
        password
      });
      if (!error && data.session) return { ok: true };
      const message = String(error?.message ?? "").toLowerCase();
      if (message.includes("not confirmed")) unconfirmed = true;
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
    return "Votre compte n'est pas encore activé. Contactez STANDA COMMERCIAL sur WhatsApp.";
  }
  if (reason === "network") {
    return "Impossible de joindre le service de connexion. Vérifiez votre connexion internet puis réessayez.";
  }
  return `Le code ${code || "MC-XXXXX"} ou le mot de passe est incorrect. Vérifiez votre saisie puis réessayez.`;
}

export async function getMyStaff(): Promise<Staff | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: s } = await supabase.from("staff").select("*")
    .eq("auth_user_id", data.user.id).maybeSingle();
  return (s as Staff) ?? null;
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
