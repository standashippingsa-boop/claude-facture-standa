-- STANDA COMMERCIAL — PRODUCTION SECURITY HARDENING
--
-- IMPORTANT:
-- 1) Run this only AFTER the existing schema/migrations are already applied.
-- 2) Test first in a staging/copy of the database if possible.
-- 3) This script removes the old "anon all" policies that exposed business data.
-- 4) It assumes Supabase Auth is the source of truth for authenticated sessions.
-- 5) Staff roles are stored in public.staff.role and linked by auth_user_id.
--
-- PRINCIPLE:
-- Browser -> authenticated Supabase session / protected server routes -> authorized data.
-- Never put a service-role key in the browser.

begin;

-- ============================================================
-- 0. ENABLE RLS
-- ============================================================

alter table if exists public.villes enable row level security;
alter table if exists public.clients enable row level security;
alter table if exists public.packages enable row level security;
alter table if exists public.invoices enable row level security;
alter table if exists public.invoice_items enable row level security;
alter table if exists public.imports enable row level security;
alter table if exists public.app_settings enable row level security;
alter table if exists public.exchange_rate enable row level security;
alter table if exists public.retraits enable row level security;
alter table if exists public.retrait_items enable row level security;
alter table if exists public.staff enable row level security;

-- ============================================================
-- 1. REMOVE DANGEROUS LEGACY POLICIES  (+ idempotence)
-- ============================================================

-- Ce script est REJOUABLE sans erreur : on supprime d'abord TOUTES les
-- politiques déjà présentes sur les tables gérées ici (y compris les
-- anciennes "anon all ... using(true)"), puis on les recrée proprement
-- plus bas. Rejouer le fichier ne casse rien.

do $$
declare r record;
begin
  -- Tables publiques entièrement gérées par ce script
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in (
      'villes','clients','packages','invoices','invoice_items','imports',
      'app_settings','exchange_rate','retraits','retrait_items','staff',
      'agences','conduces','journal','import_batches','api_tokens')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;

  -- storage.objects : uniquement les politiques créées par CE script
  -- (on ne touche pas aux autres buckets, ex. scan-photos).
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in (
        'anon storage invoices','anon storage staff-docs',
        'invoice_files_staff_read','invoice_files_customer_read',
        'invoice_files_staff_insert','invoice_files_staff_update',
        'invoice_files_admin_delete',
        'staff_docs_admin_read','staff_docs_admin_insert',
        'staff_docs_admin_update','staff_docs_admin_delete')
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- ============================================================
-- 2. HELPER FUNCTIONS — ROLE / OWNERSHIP
-- ============================================================

-- SECURITY DEFINER is used only for role lookup to avoid RLS recursion
-- when a policy needs to inspect public.staff.
create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.role
  from public.staff s
  where s.auth_user_id = auth.uid()
    and s.role in ('admin','employe')
  limit 1;
$$;

revoke all on function public.current_staff_role() from public;
grant execute on function public.current_staff_role() to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_staff_role() = 'admin';
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_staff_role() in ('admin','employe');
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

-- ============================================================
-- 3. VILLES / PRICING
-- ============================================================

-- City names/prices are business configuration. Customers should not
-- be able to modify them. Read access is granted to authenticated users
-- only; write access is admin-only.
create policy "villes_select_authenticated"
on public.villes for select to authenticated
using (true);

create policy "villes_insert_admin"
on public.villes for insert to authenticated
with check (public.is_admin());

create policy "villes_update_admin"
on public.villes for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "villes_delete_admin"
on public.villes for delete to authenticated
using (public.is_admin());

-- ============================================================
-- 4. CLIENTS
-- ============================================================

-- Admin/staff can manage customers. A customer can read ONLY their own row.
create policy "clients_select_staff"
on public.clients for select to authenticated
using (public.is_staff());

create policy "clients_select_own"
on public.clients for select to authenticated
using (auth.uid() = auth_user_id);

create policy "clients_insert_staff"
on public.clients for insert to authenticated
with check (public.is_staff());

-- Customer self-registration should be handled through a controlled
-- server/API flow. Do NOT grant anonymous UPDATE/DELETE access.
create policy "clients_update_staff"
on public.clients for update to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "clients_delete_admin"
on public.clients for delete to authenticated
using (public.is_admin());

-- ============================================================
-- 5. STAFF
-- ============================================================

-- Staff records contain identity documents and must never be public.
create policy "staff_select_self_or_admin"
on public.staff for select to authenticated
using (auth.uid() = auth_user_id or public.is_admin());

create policy "staff_insert_admin"
on public.staff for insert to authenticated
with check (public.is_admin());

create policy "staff_update_admin"
on public.staff for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "staff_delete_admin"
on public.staff for delete to authenticated
using (public.is_admin());

-- ============================================================
-- 6. PACKAGES
-- ============================================================

-- Staff can work with all packages. Customers can read only their own.
-- Customers have NO direct INSERT/UPDATE/DELETE rights here.
create policy "packages_select_staff"
on public.packages for select to authenticated
using (public.is_staff());

create policy "packages_select_own"
on public.packages for select to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.auth_user_id = auth.uid()
      and (
        c.customer_code = packages.customer_code
        or c.username = packages.customer_code
      )
  )
);

create policy "packages_insert_staff"
on public.packages for insert to authenticated
with check (public.is_staff());

create policy "packages_update_staff"
on public.packages for update to authenticated
using (public.is_staff())
with check (public.is_staff());

-- Business rule: packages must not be deleted through the client-facing DB API.
-- If deletion is ever required, use an explicit controlled admin/server process.
-- No DELETE policy is intentionally created.

-- ============================================================
-- 7. INVOICES
-- ============================================================

create policy "invoices_select_staff"
on public.invoices for select to authenticated
using (public.is_staff());

create policy "invoices_select_own"
on public.invoices for select to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.auth_user_id = auth.uid()
      and c.customer_code = invoices.customer_code
  )
);

create policy "invoices_insert_staff"
on public.invoices for insert to authenticated
with check (public.is_staff());

create policy "invoices_update_staff"
on public.invoices for update to authenticated
using (public.is_staff())
with check (public.is_staff());

-- No customer DELETE policy.
create policy "invoices_delete_admin"
on public.invoices for delete to authenticated
using (public.is_admin());

-- ============================================================
-- 8. INVOICE ITEMS
-- ============================================================

create policy "invoice_items_select_staff"
on public.invoice_items for select to authenticated
using (public.is_staff());

create policy "invoice_items_select_own"
on public.invoice_items for select to authenticated
using (
  exists (
    select 1
    from public.invoices i
    join public.clients c
      on c.customer_code = i.customer_code
    where i.id = invoice_items.invoice_id
      and c.auth_user_id = auth.uid()
  )
);

create policy "invoice_items_insert_staff"
on public.invoice_items for insert to authenticated
with check (public.is_staff());

create policy "invoice_items_update_staff"
on public.invoice_items for update to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "invoice_items_delete_staff"
on public.invoice_items for delete to authenticated
using (public.is_staff());

-- ============================================================
-- 9. IMPORTS
-- ============================================================

create policy "imports_select_staff"
on public.imports for select to authenticated
using (public.is_staff());

create policy "imports_insert_staff"
on public.imports for insert to authenticated
with check (public.is_staff());

create policy "imports_update_staff"
on public.imports for update to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "imports_delete_admin"
on public.imports for delete to authenticated
using (public.is_admin());

-- ============================================================
-- 10. SETTINGS / EXCHANGE RATE
-- ============================================================

-- Settings and exchange rate are sensitive business configuration.
-- Customers do not need direct table access.
create policy "app_settings_select_staff"
on public.app_settings for select to authenticated
using (public.is_staff());

create policy "app_settings_insert_admin"
on public.app_settings for insert to authenticated
with check (public.is_admin());

create policy "app_settings_update_admin"
on public.app_settings for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "app_settings_delete_admin"
on public.app_settings for delete to authenticated
using (public.is_admin());

create policy "exchange_rate_select_staff"
on public.exchange_rate for select to authenticated
using (public.is_staff());

create policy "exchange_rate_update_admin"
on public.exchange_rate for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "exchange_rate_insert_admin"
on public.exchange_rate for insert to authenticated
with check (public.is_admin());

create policy "exchange_rate_delete_admin"
on public.exchange_rate for delete to authenticated
using (public.is_admin());

-- ============================================================
-- 11. RETRAITS
-- ============================================================

create policy "retraits_select_staff"
on public.retraits for select to authenticated
using (public.is_staff());

create policy "retraits_select_own"
on public.retraits for select to authenticated
using (
  exists (
    select 1
    from public.clients c
    where c.auth_user_id = auth.uid()
      and c.customer_code = retraits.customer_code
  )
);

create policy "retraits_insert_own"
on public.retraits for insert to authenticated
with check (
  exists (
    select 1
    from public.clients c
    where c.auth_user_id = auth.uid()
      and c.customer_code = retraits.customer_code
  )
  or public.is_staff()
);

create policy "retraits_update_staff"
on public.retraits for update to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "retraits_delete_admin"
on public.retraits for delete to authenticated
using (public.is_admin());

create policy "retrait_items_select_staff"
on public.retrait_items for select to authenticated
using (public.is_staff());

create policy "retrait_items_select_own"
on public.retrait_items for select to authenticated
using (
  exists (
    select 1
    from public.retraits r
    join public.clients c
      on c.customer_code = r.customer_code
    where r.id = retrait_items.retrait_id
      and c.auth_user_id = auth.uid()
  )
);

create policy "retrait_items_insert_staff"
on public.retrait_items for insert to authenticated
with check (public.is_staff());

create policy "retrait_items_update_staff"
on public.retrait_items for update to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "retrait_items_delete_staff"
on public.retrait_items for delete to authenticated
using (public.is_staff());

-- ============================================================
-- 12. STORAGE — INVOICES
-- ============================================================

-- ⚠️ NE PAS rendre le bucket "invoices" privé tant que l'application
--    envoie encore un LIEN PUBLIC de la facture par WhatsApp (le client
--    l'ouvre sans se connecter) et affiche le PDF via getPublicUrl().
--    Rendre le bucket privé casserait la livraison des factures.
--
--    Mitigation en place : lib/pdf.ts ajoute un jeton aléatoire de 80 bits
--    au nom du fichier -> le lien reste non devinable / non énumérable.
--
--    Pour passer en bucket réellement privé, il faut d'abord :
--      • une route serveur qui vérifie la session (staff OU client
--        propriétaire) et renvoie une URL signée courte durée ;
--      • remplacer les <a href={pdf_url}> et le message WhatsApp par
--        cette route.
--    Décommentez alors la ligne suivante :
-- update storage.buckets set public = false where id = 'invoices';

create policy "invoice_files_staff_read"
on storage.objects for select to authenticated
using (
  bucket_id = 'invoices'
  and public.is_staff()
);

create policy "invoice_files_customer_read"
on storage.objects for select to authenticated
using (
  bucket_id = 'invoices'
  and exists (
    select 1
    from public.invoices i
    join public.clients c
      on c.customer_code = i.customer_code
    where c.auth_user_id = auth.uid()
      and (
        storage.objects.name = i.id::text
        or storage.objects.name like i.id::text || '/%'
        or storage.objects.name like '%/' || i.id::text || '.pdf'
      )
  )
);

create policy "invoice_files_staff_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'invoices'
  and public.is_staff()
);

create policy "invoice_files_staff_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'invoices'
  and public.is_staff()
)
with check (
  bucket_id = 'invoices'
  and public.is_staff()
);

create policy "invoice_files_admin_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'invoices'
  and public.is_admin()
);

-- ============================================================
-- 13. STORAGE — STAFF DOCUMENTS  (pièces d'identité du personnel)
-- ============================================================

-- ⚠️ Idéalement ce bucket doit être PRIVÉ (il contient des scans de
--    passeport / CIN). Mais app/settings/page.tsx affiche la photo via
--    getPublicUrl() ; le passer privé casse cet affichage.
--    Mitigation en place : lib/upload.ts::storagePath() utilise un jeton
--    aléatoire de 128 bits -> chemin non énumérable.
--    Pour le rendre réellement privé : stocker le CHEMIN (pas l'URL) dans
--    staff.id_photo_url, ajouter une route admin qui renvoie une URL
--    signée, puis décommenter :
-- update storage.buckets set public = false where id = 'staff-docs';

create policy "staff_docs_admin_read"
on storage.objects for select to authenticated
using (
  bucket_id = 'staff-docs'
  and public.is_admin()
);

create policy "staff_docs_admin_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'staff-docs'
  and public.is_admin()
);

create policy "staff_docs_admin_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'staff-docs'
  and public.is_admin()
)
with check (
  bucket_id = 'staff-docs'
  and public.is_admin()
);

create policy "staff_docs_admin_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'staff-docs'
  and public.is_admin()
);

-- ============================================================
-- 13B. AUTRES TABLES (agences · conduces · journal · import_batches ·
--      api_tokens · retrait_items) + RETRAITS CÔTÉ CLIENT
-- ============================================================
-- Ces tables sont utilisées par l'application via la clé anon mais
-- n'étaient couvertes NI par migration.sql NI par les sections ci-dessus.
-- Sans politique explicite : soit elles gardaient un ancien "anon all"
-- (données internes + jetons d'API lisibles/écrivables par tout le monde),
-- soit RLS bloquait l'app connectée. On fixe les deux cas.
--
-- Les blocs `do $$ ... exception when undefined_table` rendent le script
-- sûr même si une table n'existe pas encore dans ce projet.

-- Helper local : (re)crée une politique de façon idempotente, et ne fait
-- rien si la table n'existe pas encore dans ce projet.
create or replace function public._hard_policy(
  p_table text, p_name text, p_cmd text, p_roles text, p_using text, p_check text
) returns void language plpgsql as $fn$
begin
  execute format('alter table public.%I enable row level security', p_table);
  execute format('drop policy if exists %I on public.%I', p_name, p_table);
  execute format('create policy %I on public.%I for %s to %s %s %s',
    p_name, p_table, p_cmd, p_roles,
    case when p_using is null then '' else 'using (' || p_using || ')' end,
    case when p_check is null then '' else 'with check (' || p_check || ')' end);
exception
  -- Table / colonne absente dans ce projet : on ignore cette politique
  -- sans faire échouer toute la transaction.
  when undefined_table then null;
  when undefined_column then null;
end
$fn$;

-- retrait_items : un client doit pouvoir ajouter les lignes de SA demande
-- de retrait (la politique existante n'autorisait que le staff -> demande
-- créée sans ses colis).
select public._hard_policy('retrait_items', 'retrait_items_insert_own', 'insert', 'authenticated',
  null,
  'exists (select 1 from public.retraits r join public.clients c on c.customer_code = r.customer_code '
  || 'where r.id = retrait_items.retrait_id and c.auth_user_id = auth.uid())');

-- AGENCES — annuaire public des points de retrait.
-- Le site public (/agences) lit les lignes actives SANS session.
do $$ begin execute 'drop policy if exists "anon all agences" on public.agences';
exception when undefined_table then null; end $$;
select public._hard_policy('agences', 'agences_select_public_active', 'select', 'anon, authenticated', 'active = true', null);
select public._hard_policy('agences', 'agences_select_staff',  'select', 'authenticated', 'public.is_staff()', null);
select public._hard_policy('agences', 'agences_insert_staff',  'insert', 'authenticated', null, 'public.is_staff()');
select public._hard_policy('agences', 'agences_update_staff',  'update', 'authenticated', 'public.is_staff()', 'public.is_staff()');
select public._hard_policy('agences', 'agences_delete_admin',  'delete', 'authenticated', 'public.is_admin()', null);

-- CONDUCES — logistique interne (staff uniquement).
do $$ begin execute 'drop policy if exists "anon all conduces" on public.conduces';
exception when undefined_table then null; end $$;
select public._hard_policy('conduces', 'conduces_select_staff', 'select', 'authenticated', 'public.is_staff()', null);
select public._hard_policy('conduces', 'conduces_insert_staff', 'insert', 'authenticated', null, 'public.is_staff()');
select public._hard_policy('conduces', 'conduces_update_staff', 'update', 'authenticated', 'public.is_staff()', 'public.is_staff()');
select public._hard_policy('conduces', 'conduces_delete_admin', 'delete', 'authenticated', 'public.is_admin()', null);

-- JOURNAL — piste d'audit. Lecture staff. Écriture : uniquement via la route
-- serveur /api/audit-log (clé service, qui contourne RLS) -> aucune politique
-- INSERT pour anon/authenticated.
do $$ begin execute 'drop policy if exists "anon all journal" on public.journal';
exception when undefined_table then null; end $$;
select public._hard_policy('journal', 'journal_select_staff', 'select', 'authenticated', 'public.is_staff()', null);

-- IMPORT_BATCHES — lots d'import + données d'annulation (staff).
do $$ begin execute 'drop policy if exists "anon all import_batches" on public.import_batches';
exception when undefined_table then null; end $$;
select public._hard_policy('import_batches', 'import_batches_select_staff', 'select', 'authenticated', 'public.is_staff()', null);
select public._hard_policy('import_batches', 'import_batches_insert_staff', 'insert', 'authenticated', null, 'public.is_staff()');
select public._hard_policy('import_batches', 'import_batches_update_staff', 'update', 'authenticated', 'public.is_staff()', 'public.is_staff()');
select public._hard_policy('import_batches', 'import_batches_delete_admin', 'delete', 'authenticated', 'public.is_admin()', null);

-- API_TOKENS — jetons Bearer de l'extension Chrome (/api/ingest*).
-- CRITIQUE : un "anon all" ici laisse n'importe qui LIRE les jetons valides
-- ou en CRÉER. Les routes d'ingestion lisent cette table avec la clé service
-- -> réserver l'accès table aux ADMINS.
do $$ begin execute 'drop policy if exists "anon all api_tokens" on public.api_tokens';
exception when undefined_table then null; end $$;
select public._hard_policy('api_tokens', 'api_tokens_select_admin', 'select', 'authenticated', 'public.is_admin()', null);
select public._hard_policy('api_tokens', 'api_tokens_insert_admin', 'insert', 'authenticated', null, 'public.is_admin()');
select public._hard_policy('api_tokens', 'api_tokens_update_admin', 'update', 'authenticated', 'public.is_admin()', 'public.is_admin()');
select public._hard_policy('api_tokens', 'api_tokens_delete_admin', 'delete', 'authenticated', 'public.is_admin()', null);

drop function public._hard_policy(text, text, text, text, text, text);

-- ============================================================
-- 14. EXPLICITLY BLOCK ANONYMOUS DATA ACCESS
-- ============================================================

-- RLS policies above target authenticated. There are deliberately NO
-- anon policies on private business tables.
-- Public tracking, if needed, should go through a controlled server/API
-- route that returns only the minimum tracking information required.

commit;

-- ============================================================
-- POST-RUN CHECKS
-- ============================================================
-- Run these separately after the transaction succeeds:
--
-- select schemaname, tablename, policyname, roles, cmd
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;
--
-- Verify there are no old policies containing "anon all".
-- Verify service_role is never used in client-side code.
-- Verify customer login creates an authenticated Supabase session.
-- Verify customer auth_user_id is correctly linked to clients.id.
-- Verify staff.auth_user_id is correctly linked to auth.users.id.
--
-- IMPORTANT APPLICATION FOLLOW-UP:
-- If the current frontend directly inserts customer registrations while
-- unauthenticated, move that registration flow to a protected server/API
-- endpoint before removing any remaining anonymous INSERT dependency.
