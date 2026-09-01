import { createClient } from "@supabase/supabase-js";

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
  publishableKey
);
