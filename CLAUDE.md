# STANDA COMMERCIAL — Instructions projet

## Vérification avant livraison

Exécuter `npm run verify`. Cette commande vérifie, dans cet ordre :

1. le typage TypeScript sans écrire de cache ;
2. l'isolation des pages publiques et des données ;
3. le build de production Next.js.

## Règles importantes

- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` ni `SETUP_SECRET` dans du code client ou une page publique (serveur / `app/api/*` uniquement).
- Les pages publiques ne peuvent accéder aux données qu'au travers des modules serveur explicitement autorisés par `scripts/check-public-isolation.mjs`.
- Conserver les protections et en-têtes de sécurité définis dans `next.config.mjs`.
- Ne pas versionner les fichiers `.env*` ni les clés Supabase. Si une clé fuit : la régénérer dans Supabase (voir `SECURITY.md`).
- **RLS** : ne JAMAIS créer de politique `anon all ... using(true)`. L'accès aux données passe par une session Supabase authentifiée (`security-hardening.sql`) ou par une route serveur avec la clé service. Toute nouvelle table doit recevoir ses politiques dans `security-hardening.sql`.
- Ordre d'exécution SQL sur Supabase : `migration.sql` → `security-hardening.sql` → `20260831_public_reviews.sql` → `20260913_affiliate_program.sql` → `20260915_reception_agent.sql` → `20260920_report_settlement.sql` → `20260925_affiliate_contract_payout.sql` → `20260926_affiliate_notifications.sql`.
- Chemins de fichiers Storage (`lib/upload.ts`, `lib/pdf.ts`) : garder un jeton aléatoire cryptographique — les buckets sont publics par lien.
- **Sentry** (`lib/sentry-options.ts`, `instrumentation*.ts`, `app/global-error.tsx`) : opt-in via `NEXT_PUBLIC_SENTRY_DSN` (vide = aucun octet dans les bundles). Ne JAMAIS activer `sendDefaultPii`, Session Replay, `tracesSampleRate` ni les breadcrumbs `console` : l'app manipule des PII clients (téléphone, adresse, pièces d'identité) et des jetons (corps `/api/*`, `#access_token=` des liens mot de passe). Toute donnée envoyée passe par `scrubEvent`/`scrubBreadcrumb`. Garder la forme `if (process.env.NEXT_PUBLIC_SENTRY_DSN) { import(...) }` (pas `if (!DSN) return`) et `@sentry/browser` via `lib/sentry-client.ts` côté client (SDK Next.js ≈ 145 kB gzip vs ≈ 31 kB).
- **`supabase/migrations/*.sql` n'est PAS fiable tant que le workflow GitHub Actions correspondant n'a pas au moins une exécution ✅ verte confirmée** (constat 2026-09-12 : 18/18 échecs depuis sa création — voir `supabase/migrations/README.md`). Après avoir ajouté un fichier là, vérifier l'onglet Actions ; si rouge ou en doute, coller le fichier soi-même dans Supabase → SQL Editor → Run.

## Commandes utiles

- `npm run dev` : développement local.
- `npm run typecheck` : vérification TypeScript.
- `npm run check:isolation` : contrôle de sécurité des pages publiques.
- `npm run build` : build de production.
- `npm run verify` : contrôle complet avant livraison.
