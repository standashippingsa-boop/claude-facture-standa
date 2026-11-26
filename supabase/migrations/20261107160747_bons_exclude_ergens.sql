-- Migration « bons_exclude_ergens » appliquée directement en production (outil Supabase MCP / apply_migration).
-- Ce fichier existe pour que l'historique local corresponde à celui de Supabase :
-- `supabase db push` ne l'exécute jamais (version déjà présente dans l'historique distant).
-- Le SQL exact exécuté est conservé dans supabase_migrations.schema_migrations.statements
-- (version 20261107160747).
select 1;
