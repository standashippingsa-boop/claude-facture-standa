# Migrations versionnées

Ce dossier contient uniquement les changements **nouveaux** à appliquer à la base Supabase de production.

- Créez chaque fichier avec `npx supabase migration new description_du_changement`.
- Conservez le nom généré : `YYYYMMDDHHMMSS_description_du_changement.sql`.
- Ne déplacez pas `migration.sql`, `security-hardening.sql` ni `20260831_public_reviews.sql` ici : ce sont les scripts de base déjà appliqués au projet, et ils ne doivent pas être rejoués à chaque mise à jour.
- Pour toute nouvelle table, appliquez RLS et les politiques nécessaires sans jamais créer de politique `anon all ... using(true)`. Mettez également à jour `security-hardening.sql`, qui reste la référence de sécurité du projet.

Quand un fichier SQL versionné est envoyé sur la branche `main`, GitHub Actions (`.github/workflows/supabase-production.yml`) applique seulement les migrations qui ne figurent pas encore dans l'historique Supabase.

## ⚠️ NE PAS FAIRE CONFIANCE À CE WORKFLOW LES YEUX FERMÉS

Constat du 2026-09-12 : ce workflow a échoué à **ses 18 premières exécutions**, sans
exception, depuis sa toute première exécution le 2026-09-01 (échec systématique à
l'étape « Lier la base de production », avant même d'exécuter la moindre requête
SQL — probablement un des secrets GitHub `SUPABASE_ACCESS_TOKEN`,
`PRODUCTION_DB_PASSWORD` ou `PRODUCTION_PROJECT_ID` manquant/invalide dans
Settings > Secrets and variables > Actions). Résultat : les 14 migrations créées
entre le 1er et le 12 septembre ne sont jamais parties toutes seules en production
— y compris la toute première (`20260901120000_create_agences.sql`), pendant onze
jours, sans que personne ne le remarque tant que la fonctionnalité correspondante
n'a pas été testée dans l'app.

**Procédure obligatoire tant que ce workflow n'a pas eu au moins UNE exécution
verte confirmée sur GitHub → onglet Actions :**

1. Après avoir ajouté un nouveau fichier ici et poussé sur `main`, allez vérifier
   dans GitHub → Actions → « Déployer les migrations Supabase » que la dernière
   exécution est bien ✅ verte.
2. Si elle est ❌ rouge (ou si vous avez un doute), **collez le contenu du nouveau
   fichier directement dans Supabase → SQL Editor → Run** vous-même — c'est le
   même moteur manuel qui a créé le schéma de base au tout début du projet
   (`migration.sql` + `security-hardening.sql`), et chaque migration de ce dossier
   est écrite pour être rejouable sans danger (`if not exists`, `drop policy if
   exists` puis recréation).
3. `supabase/RATRAPAGE_2026-09-12_a_executer_maintenant.sql` (à la racine de
   `supabase/`) contient déjà les 14 migrations en retard concaténées dans l'ordre
   — à exécuter une fois dans le SQL Editor pour rattraper le retard existant.

## Réparation du 2026-11-26 — cause réelle des échecs de `supabase db push`

Les secrets fonctionnent (l'étape « Lier la base de production » passe). L'échec venait de
**deux historiques désalignés** : 24 migrations appliquées directement en production
(outil Supabase MCP `apply_migration`) n'avaient pas de fichier ici, et 21 fichiers d'ici,
collés à la main dans le SQL Editor, n'étaient pas inscrits dans l'historique Supabase.
`db push` refuse de continuer dans ce cas.

Correction : un fichier (sans effet, `select 1;`) a été créé pour chacune des 24 versions
distantes, et les 21 fichiers déjà appliqués (vérifiés objet par objet) ont été inscrits
dans `supabase_migrations.schema_migrations`. `20260929120000_add_package_delivered_by.sql`
n'avait jamais été appliquée : elle est laissée au workflow.

**Règle pour garder le workflow vert :** toute migration appliquée directement en
production (MCP `apply_migration`, SQL Editor) doit avoir ici un fichier portant **la même
version** que celle inscrite dans l'historique distant (`list_migrations`), sinon le
prochain `db push` échoue de nouveau.

Mise à jour : le run du 2026-11-26 (commit 6b5aac4) a bien appliqué `20260929120000_add_package_delivered_by.sql` (colonne `packages.delivered_by` présente, version inscrite dans l'historique).

## ✅ Workflow vert depuis le 2026-11-26 (commit 906d3e8)

Deux causes supplémentaires corrigées dans `.github/workflows/supabase-production.yml` :
la CLI récente vise la base **locale** par défaut, et GitHub Actions n'a pas d'IPv6 alors
que l'adresse directe de la base est IPv6. Le workflow passe désormais par le **pooler IPv4**
(`postgres.<ref>@aws-1|aws-0-us-east-2.pooler.supabase.com:5432`) avec `--db-url`, et
affiche la fin du message d'erreur en annotation GitHub en cas d'échec.
