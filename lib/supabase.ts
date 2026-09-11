import { createClient } from "@supabase/supabase-js";

/**
 * Chak espas travay kenbe pwòp sesyon li nan navigatè a. Konsa yon admin ka
 * rete konekte nan yon onglet pandan yon ajan retrè konekte nan yon lòt,
 * san youn pa ranplase kont lòt la.
 */
export type AuthRealm = "admin" | "employe" | "agent_retrait" | "client";
const AUTH_REALM_KEY = "standa:auth-realm";

function activeAuthRealm() {
  if (typeof window === "undefined") return "default";
  try { return window.sessionStorage.getItem(AUTH_REALM_KEY) || "default"; }
  catch { return "default"; }
}

export function setAuthRealm(realm: AuthRealm) {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(AUTH_REALM_KEY, realm); }
  catch { /* Le navigateur peut bloquer le stockage privé : l'authentification reste fonctionnelle. */ }
}

const isolatedAuthStorage = {
  getItem(key: string) {
    if (typeof window === "undefined") return null;
    try { return window.localStorage.getItem(`${key}:${activeAuthRealm()}`); }
    catch { return null; }
  },
  setItem(key: string, value: string) {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(`${key}:${activeAuthRealm()}`, value); }
    catch { /* Storage indisponible : Supabase gère la session en mémoire. */ }
  },
  removeItem(key: string) {
    if (typeof window === "undefined") return;
    try { window.localStorage.removeItem(`${key}:${activeAuthRealm()}`); }
    catch { /* Nothing else to remove. */ }
  }
};

/*
 * Le site public doit rester consultable même avant la configuration locale
 * de Supabase. Sans ces variables, on crée un client inerte : les écrans qui
 * ont besoin de données affichent alors leur message d'indisponibilité, mais
 * l'accueil, les agences et les pages d'information ne plantent jamais.
 * Aucune clé de service n'est utilisée ici.
 */
const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const configuredPublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  || "";

/**
 * Vrai seulement lorsque le navigateur peut joindre le projet Supabase.
 * Les écrans publics restent consultables sans ces variables, mais aucune
 * tentative de connexion ne doit alors être présentée comme un mauvais mot
 * de passe.
 */
export const isSupabaseConfigured = Boolean(
  configuredUrl
  && configuredPublishableKey
  && !configuredUrl.includes("XXXXXXXX")
  && !configuredPublishableKey.includes("your-anon-public-key")
  && !configuredPublishableKey.includes("your-publishable-key")
);

const url = configuredUrl || "https://standa-local-unconfigured.invalid";
const publishableKey = configuredPublishableKey || "standa-local-unconfigured-publishable-key";

export const supabase = createClient(
  url,
  publishableKey,
  { auth: { storage: isolatedAuthStorage } }
);
