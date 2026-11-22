import { createClient } from "@supabase/supabase-js";

/**
 * Chak espas travay kenbe pwòp sesyon li nan navigatè a. Konsa yon admin ka
 * rete konekte nan yon onglet pandan yon ajan retrè konekte nan yon lòt,
 * san youn pa ranplase kont lòt la.
 */
export type AuthRealm = "admin" | "employe" | "agent_retrait" | "agent_reception" | "client";
const AUTH_REALM_KEY = "standa:auth-realm";
const PORTAL_HISTORY_KEY_PREFIX = "standa:portal-history-boundary:";

function activeAuthRealm() {
  if (typeof window === "undefined") return "default";
  try { return window.sessionStorage.getItem(AUTH_REALM_KEY) || "default"; }
  catch { return "default"; }
}

/** Espace actif dans cet onglet (jamais partagé avec un nouvel onglet). */
export function getAuthRealm(): AuthRealm | null {
  const realm = activeAuthRealm();
  return realm === "admin" || realm === "employe" || realm === "agent_retrait" || realm === "agent_reception" || realm === "client" ? realm : null;
}

export function setAuthRealm(realm: AuthRealm) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(AUTH_REALM_KEY, realm);
    // Une nouvelle connexion démarre une nouvelle frontière de navigation.
    // Cela empêche un historique d'une ancienne session de ramener la personne
    // vers le site public ou vers un autre espace métier.
    window.sessionStorage.removeItem(portalHistorySessionKey(realm));
  }
  catch { /* Le navigateur peut bloquer le stockage privé : l'authentification reste fonctionnelle. */ }
}

/** Clé de session utilisée pour isoler l'historique de chaque application. */
export function portalHistorySessionKey(realm: AuthRealm) {
  return `${PORTAL_HISTORY_KEY_PREFIX}${realm}`;
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

/**
 * DISJONCTEUR DE LECTURES (navigateur seulement)
 * ═════════════════════════════════════════════
 * Le 22/11/2026, un seul onglet du tableau de bord a envoyé la même série de
 * lectures 3 à 6 fois par seconde pendant plus d'une heure : Supabase a
 * répondu par des milliers de 503 et tous les écrans se sont mis à clignoter.
 *
 * Règle : si la MÊME lecture (méthode + adresse complète) part plus de 20 fois
 * en 10 s, on cesse de l'envoyer pendant 30 s et on répond localement « 503 ».
 * Les écrans affichent alors leur message d'indisponibilité habituel. Une
 * utilisation normale n'atteint jamais ce seuil ; les écritures (POST, PATCH,
 * DELETE) et la connexion ne sont jamais bloquées.
 */
const READ_LIMIT = 20;
const READ_WINDOW_MS = 10_000;
const READ_COOLDOWN_MS = 30_000;
const readHits = new Map<string, number[]>();
const readBlockedUntil = new Map<string, number>();

const guardedFetch: typeof fetch = (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (typeof window === "undefined" || (method !== "GET" && method !== "HEAD") || href.includes("/auth/v1/")) {
    return fetch(input, init);
  }
  const key = `${method} ${href}`;
  const now = Date.now();
  if ((readBlockedUntil.get(key) ?? 0) > now) {
    return Promise.resolve(new Response(JSON.stringify({ message: "Trop de lectures identiques : pause de sécurité." }),
      { status: 503, headers: { "Content-Type": "application/json" } }));
  }
  const hits = (readHits.get(key) ?? []).filter((t) => now - t < READ_WINDOW_MS);
  hits.push(now);
  readHits.set(key, hits);
  if (hits.length > READ_LIMIT) {
    readBlockedUntil.set(key, now + READ_COOLDOWN_MS);
    readHits.delete(key);
    console.warn("[standa] lecture répétée bloquée 30 s :", method, new URL(href).pathname);
  }
  if (readHits.size > 500) readHits.clear();   // jamais de fuite mémoire
  return fetch(input, init);
};

export const supabase = createClient(
  url,
  publishableKey,
  { auth: { storage: isolatedAuthStorage }, global: { fetch: guardedFetch } }
);
