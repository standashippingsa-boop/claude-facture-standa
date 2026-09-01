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
- Ordre d'exécution SQL sur Supabase : `migration.sql` → `security-hardening.sql` → `20260831_public_reviews.sql`.
- Chemins de fichiers Storage (`lib/upload.ts`, `lib/pdf.ts`) : garder un jeton aléatoire cryptographique — les buckets sont publics par lien.

## Commandes utiles

- `npm run dev` : développement local.
- `npm run typecheck` : vérification TypeScript.
- `npm run check:isolation` : contrôle de sécurité des pages publiques.
- `npm run build` : build de production.
- `npm run verify` : contrôle complet avant livraison.
