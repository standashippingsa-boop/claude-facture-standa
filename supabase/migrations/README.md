# Migrations versionnées

Ce dossier contient uniquement les changements **nouveaux** à appliquer à la base Supabase de production.

- Créez chaque fichier avec `npx supabase migration new description_du_changement`.
- Conservez le nom généré : `YYYYMMDDHHMMSS_description_du_changement.sql`.
- Ne déplacez pas `migration.sql`, `security-hardening.sql` ni `20260831_public_reviews.sql` ici : ce sont les scripts de base déjà appliqués au projet, et ils ne doivent pas être rejoués à chaque mise à jour.
- Pour toute nouvelle table, appliquez RLS et les politiques nécessaires sans jamais créer de politique `anon all ... using(true)`. Mettez également à jour `security-hardening.sql`, qui reste la référence de sécurité du projet.

Quand un fichier SQL versionné est envoyé sur la branche `main`, GitHub Actions applique seulement les migrations qui ne figurent pas encore dans l'historique Supabase.
