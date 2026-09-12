-- ============================================================================
-- STANDA COMMERCIAL — SCRIPT DE RATTRAPAGE (à exécuter UNE FOIS, MAINTENANT)
-- ============================================================================
-- POURQUOI CE FICHIER EXISTE :
-- Le workflow GitHub Actions « Déployer les migrations Supabase » qui devait
-- appliquer automatiquement tous les fichiers de supabase/migrations/ a ÉCHOUÉ
-- SUR SES 18 EXÉCUTIONS, sans exception, depuis sa toute première exécution
-- (2026-09-01, commit 93a967d1 « Automate Supabase migrations and add
-- agencies schema » — le commit qui créait justement la table "agences").
-- Il échoue systématiquement à l'étape « Lier la base de production »
-- (supabase link), avant même de tenter la moindre requête SQL.
-- Cause probable : un des secrets GitHub du dépôt (SUPABASE_ACCESS_TOKEN,
-- PRODUCTION_DB_PASSWORD, PRODUCTION_PROJECT_ID) est absent, expiré ou
-- incorrect. À vérifier dans GitHub → Settings → Secrets and variables →
-- Actions.  Voir supabase/migrations/README.md pour la procédure complète.
--
-- CONSÉQUENCE : les 14 fichiers de supabase/migrations/ créés depuis le
-- 1er septembre n'ont JAMAIS été appliqués à la base de production —
-- ce qui inclut la table "agences" elle-même (d'où l'impossibilité de
-- créer une agence de retrait), mais aussi les agents de remise, les
-- notifications push, le suivi des bons de remise par colis, les modes de
-- paiement des factures, etc. Autrement dit : une bonne partie du travail
-- livré ces deux dernières semaines n'existe peut-être pas encore en base.
--
-- SOLUTION IMMÉDIATE : ce fichier concatène, DANS L'ORDRE CHRONOLOGIQUE,
-- les 14 migrations en attente. Chaque instruction est idempotente
-- (create table if not exists / add column if not exists / drop policy
-- if exists puis recréation) : l'exécuter ne casse rien, même si une
-- partie avait déjà été appliquée manuellement par ailleurs.
--
-- COMMENT L'EXÉCUTER (le même « moteur » que migration.sql et
-- security-hardening.sql à l'origine du projet) :
--   1. Supabase → votre projet → SQL Editor → New query.
--   2. Coller TOUT le contenu de ce fichier.
--   3. Run.
--   4. Vérifier qu'aucune ligne ne finit en erreur rouge.
-- ============================================================================

-- ---------------------------------------------------------------
-- Fichier source : supabase/migrations/20260901120000_create_agences.sql
-- ---------------------------------------------------------------
-- STANDA COMMERCIAL — Annuaire des agences / points de retrait
-- Cette migration complète les scripts de base déjà appliqués.
-- Elle est rejouable sans effacer de données existantes.

begin;

create table if not exists public.agences (
  id uuid primary key default gen_random_uuid(),
  nom text unique not null,
  adresse text not null default '',
  telephone text not null default '',
  whatsapp text not null default '',
  horaire_1 text not null default '',
  horaire_2 text not null default '',
  note text not null default '',
  ordre int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.agences add column if not exists whatsapp text not null default '';
alter table public.agences add column if not exists horaire_1 text not null default '';
alter table public.agences add column if not exists horaire_2 text not null default '';
alter table public.agences add column if not exists note text not null default '';
alter table public.agences add column if not exists ordre int not null default 0;
alter table public.agences add column if not exists active boolean not null default true;
alter table public.agences add column if not exists created_at timestamptz not null default now();
create index if not exists agences_ordre_idx on public.agences (ordre, nom);

alter table public.agences enable row level security;
drop policy if exists "anon all agences" on public.agences;
drop policy if exists "agences_select_public_active" on public.agences;
drop policy if exists "agences_select_staff" on public.agences;
drop policy if exists "agences_insert_staff" on public.agences;
drop policy if exists "agences_update_staff" on public.agences;
drop policy if exists "agences_delete_admin" on public.agences;

create policy "agences_select_public_active"
on public.agences for select to anon, authenticated
using (active = true);

create policy "agences_select_staff"
on public.agences for select to authenticated
using (public.is_staff());

create policy "agences_insert_staff"
on public.agences for insert to authenticated
with check (public.is_staff());

create policy "agences_update_staff"
on public.agences for update to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "agences_delete_admin"
on public.agences for delete to authenticated
using (public.is_admin());

commit;

-- ---------------------------------------------------------------
-- Fichier source : supabase/migrations/20260907143000_add_conduce_payment_tracking.sql
-- ---------------------------------------------------------------
-- STANDA COMMERCIAL — Suivi des paiements MCPACK par Conduce
--
-- Une facture client (packages.invoice_id) ne prouve pas que STANDA a déjà
-- payé MCPACK. Cette migration ajoute donc un état indépendant, visible sur
-- chaque Conduce, avec la date et l'employé qui l'a validé.
-- Elle crée aussi la table Conduces si un projet ancien ne l'avait reçue que
-- manuellement, sans jamais modifier ni supprimer de colis existants.

begin;

create table if not exists public.conduces (
  id uuid primary key default gen_random_uuid(),
  conduce_number text unique not null,
  office text not null default '',
  conduce_date date,
  status text not null default 'En attente',
  imported_by text not null default '',
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conduces add column if not exists conduce_date date;
alter table public.conduces add column if not exists payment_status text not null default 'Non payé';
alter table public.conduces add column if not exists payment_paid_at timestamptz;
alter table public.conduces add column if not exists payment_paid_by text;

-- Les lignes importées avant cette évolution restent explicitement à régler
-- jusqu'à validation manuelle : aucune ancienne Conduce n'est marquée payée
-- par déduction ou par erreur.
update public.conduces
set payment_status = 'Non payé'
where payment_status is null or payment_status not in ('Non payé', 'Payé');

alter table public.conduces alter column payment_status set default 'Non payé';
alter table public.conduces alter column payment_status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'conduces_payment_status_check'
      and conrelid = 'public.conduces'::regclass
  ) then
    alter table public.conduces
      add constraint conduces_payment_status_check
      check (payment_status in ('Non payé', 'Payé'));
  end if;
end $$;

create index if not exists conduces_date_idx on public.conduces (conduce_date desc);
create index if not exists conduces_payment_status_idx on public.conduces (payment_status);

-- Table interne : les politiques staff existantes de security-hardening.sql
-- s'appliquent. On réactive RLS ici sans jamais ajouter d'accès anonyme.
alter table public.conduces enable row level security;

commit;

-- ---------------------------------------------------------------
-- Fichier source : supabase/migrations/20260907170000_add_mcpack_invoice_register.sql
-- ---------------------------------------------------------------
-- STANDA COMMERCIAL — Registre des factures MCPACK
--
-- Yon PDF MCPACK ka gen colis ki soti nan plizyè Conduce. Nou konsève yon
-- dosye entèn sou fakti a ak Conduce li yo, san janm modifye fakti kliyan yo.
-- PDF a li lokalman nan navigatè staff la; nou pa estoke dokiman an nan Storage.

begin;

create table if not exists public.mcpack_invoices (
  id uuid primary key default gen_random_uuid(),
  file_name text not null default '',
  extracted_tracking_count integer not null default 0 check (extracted_tracking_count >= 0),
  matched_package_count integer not null default 0 check (matched_package_count >= 0),
  unmatched_tracking_count integer not null default 0 check (unmatched_tracking_count >= 0),
  unlinked_package_count integer not null default 0 check (unlinked_package_count >= 0),
  status text not null default 'Facturée' check (status in ('Facturée', 'Payée')),
  created_by text not null default '',
  created_at timestamptz not null default now(),
  paid_by text,
  paid_at timestamptz
);

create table if not exists public.mcpack_invoice_conduces (
  invoice_id uuid not null references public.mcpack_invoices(id) on delete cascade,
  conduce_id uuid not null references public.conduces(id) on delete restrict,
  package_count integer not null default 0 check (package_count > 0),
  created_at timestamptz not null default now(),
  primary key (invoice_id, conduce_id),
  -- Yon Conduce ka sou yon sèl fakti MCPACK a la fwa. Sa anpeche yon menm lo
  -- antre de fwa nan lis peman an si yo re-chaje menm PDF la.
  unique (conduce_id)
);

create index if not exists mcpack_invoices_status_created_idx
  on public.mcpack_invoices (status, created_at desc);
create index if not exists mcpack_invoice_conduces_invoice_idx
  on public.mcpack_invoice_conduces (invoice_id);

-- Done sa yo se lojistik entèn. Se staff konekte sèlman ki ka li oswa ekri yo.
alter table public.mcpack_invoices enable row level security;
alter table public.mcpack_invoice_conduces enable row level security;

drop policy if exists "mcpack_invoices_select_staff" on public.mcpack_invoices;
drop policy if exists "mcpack_invoices_insert_staff" on public.mcpack_invoices;
drop policy if exists "mcpack_invoices_update_staff" on public.mcpack_invoices;
drop policy if exists "mcpack_invoices_delete_staff" on public.mcpack_invoices;
create policy "mcpack_invoices_select_staff" on public.mcpack_invoices
  for select to authenticated using (public.is_staff());
create policy "mcpack_invoices_insert_staff" on public.mcpack_invoices
  for insert to authenticated with check (public.is_staff());
create policy "mcpack_invoices_update_staff" on public.mcpack_invoices
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "mcpack_invoices_delete_staff" on public.mcpack_invoices
  for delete to authenticated using (public.is_staff());

drop policy if exists "mcpack_invoice_conduces_select_staff" on public.mcpack_invoice_conduces;
drop policy if exists "mcpack_invoice_conduces_insert_staff" on public.mcpack_invoice_conduces;
drop policy if exists "mcpack_invoice_conduces_update_staff" on public.mcpack_invoice_conduces;
drop policy if exists "mcpack_invoice_conduces_delete_staff" on public.mcpack_invoice_conduces;
create policy "mcpack_invoice_conduces_select_staff" on public.mcpack_invoice_conduces
  for select to authenticated using (public.is_staff());
create policy "mcpack_invoice_conduces_insert_staff" on public.mcpack_invoice_conduces
  for insert to authenticated with check (public.is_staff());
create policy "mcpack_invoice_conduces_update_staff" on public.mcpack_invoice_conduces
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "mcpack_invoice_conduces_delete_staff" on public.mcpack_invoice_conduces
  for delete to authenticated using (public.is_staff());

commit;

-- ---------------------------------------------------------------
-- Fichier source : supabase/migrations/20260907190000_track_bons_remise.sql
-- ---------------------------------------------------------------
-- STANDA COMMERCIAL — Registre des Bons de remise
--
-- Yon Conduce gen dwa antre nan yon sèl Bon de remise. Sa anpeche menm lo a
-- retounen sou yon dezyèm bon, menm si de staff travay sou de aparèy diferan.

begin;

create table if not exists public.bons_remise (
  id uuid primary key default gen_random_uuid(),
  bon_number text not null unique,
  destination text not null default '',
  package_count integer not null default 0 check (package_count >= 0),
  conduce_count integer not null default 0 check (conduce_count > 0),
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.bon_remise_conduces (
  bon_remise_id uuid not null references public.bons_remise(id) on delete cascade,
  conduce_id uuid not null references public.conduces(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (bon_remise_id, conduce_id),
  -- Gad final kont doublon, menm si de navigatè eseye kreye bon an ansanm.
  unique (conduce_id)
);

create index if not exists bons_remise_created_idx
  on public.bons_remise (created_at desc);
create index if not exists bon_remise_conduces_bon_idx
  on public.bon_remise_conduces (bon_remise_id);

alter table public.bons_remise enable row level security;
alter table public.bon_remise_conduces enable row level security;

drop policy if exists "bons_remise_select_staff" on public.bons_remise;
drop policy if exists "bons_remise_insert_staff" on public.bons_remise;
drop policy if exists "bons_remise_update_staff" on public.bons_remise;
drop policy if exists "bons_remise_delete_staff" on public.bons_remise;
create policy "bons_remise_select_staff" on public.bons_remise
  for select to authenticated using (public.is_staff());
create policy "bons_remise_insert_staff" on public.bons_remise
  for insert to authenticated with check (public.is_staff());
create policy "bons_remise_update_staff" on public.bons_remise
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "bons_remise_delete_staff" on public.bons_remise
  for delete to authenticated using (public.is_staff());

drop policy if exists "bon_remise_conduces_select_staff" on public.bon_remise_conduces;
drop policy if exists "bon_remise_conduces_insert_staff" on public.bon_remise_conduces;
drop policy if exists "bon_remise_conduces_update_staff" on public.bon_remise_conduces;
drop policy if exists "bon_remise_conduces_delete_staff" on public.bon_remise_conduces;
create policy "bon_remise_conduces_select_staff" on public.bon_remise_conduces
  for select to authenticated using (public.is_staff());
create policy "bon_remise_conduces_insert_staff" on public.bon_remise_conduces
  for insert to authenticated with check (public.is_staff());
create policy "bon_remise_conduces_update_staff" on public.bon_remise_conduces
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "bon_remise_conduces_delete_staff" on public.bon_remise_conduces
  for delete to authenticated using (public.is_staff());

commit;

-- ---------------------------------------------------------------
-- Fichier source : supabase/migrations/20260908090000_add_pickup_agents.sql
-- ---------------------------------------------------------------
-- STANDA COMMERCIAL — Agents de remise / points de retrait
-- À exécuter dans Supabase SQL Editor sur la base de production.
-- Les agents ne reçoivent AUCUNE politique RLS directe sur les colis ou les
-- clients. La route serveur /api/pickup-agent ne retourne que le minimum
-- nécessaire, limité à leur pickup_ville_id.

begin;

alter table public.staff
  add column if not exists pickup_ville_id uuid references public.villes(id) on delete set null;

create index if not exists staff_pickup_ville_idx on public.staff (pickup_ville_id);

-- Le nom de la contrainte peut différer selon l'ancien déploiement. On retire
-- seulement les CHECK qui portent sur la colonne role, puis on recrée la règle.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.staff'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.staff drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.staff
  add constraint staff_role_check
  check (role in ('admin', 'employe', 'agent_retrait'));

commit;

-- ---------------------------------------------------------------
-- Fichier source : supabase/migrations/20260908110000_add_pickup_operations.sql
-- ---------------------------------------------------------------
-- STANDA COMMERCIAL — Opérations de point de retrait
-- Paiements clients, bons de remise archivés et accès limité des agents.
-- À exécuter dans Supabase SQL Editor AVANT d'utiliser la nouvelle interface.

begin;

-- ── 0. Registre des bons de remise (rattrapage installations existantes) ──
-- Certaines bases de production ont été mises en place avant le registre des
-- Bons. On le crée ici aussi afin que cette migration reste exécutable seule.
create table if not exists public.bons_remise (
  id uuid primary key default gen_random_uuid(),
  bon_number text not null unique,
  destination text not null default '',
  package_count integer not null default 0 check (package_count >= 0),
  conduce_count integer not null default 0 check (conduce_count > 0),
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.bon_remise_conduces (
  bon_remise_id uuid not null references public.bons_remise(id) on delete cascade,
  conduce_id uuid not null references public.conduces(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (bon_remise_id, conduce_id),
  unique (conduce_id)
);

create index if not exists bons_remise_created_idx
  on public.bons_remise (created_at desc);
create index if not exists bon_remise_conduces_bon_idx
  on public.bon_remise_conduces (bon_remise_id);

alter table public.bons_remise enable row level security;
alter table public.bon_remise_conduces enable row level security;

drop policy if exists "bons_remise_select_staff" on public.bons_remise;
drop policy if exists "bons_remise_insert_staff" on public.bons_remise;
drop policy if exists "bons_remise_update_staff" on public.bons_remise;
drop policy if exists "bons_remise_delete_staff" on public.bons_remise;
create policy "bons_remise_select_staff" on public.bons_remise
  for select to authenticated using (public.is_staff());
create policy "bons_remise_insert_staff" on public.bons_remise
  for insert to authenticated with check (public.is_staff());
create policy "bons_remise_update_staff" on public.bons_remise
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "bons_remise_delete_staff" on public.bons_remise
  for delete to authenticated using (public.is_staff());

drop policy if exists "bon_remise_conduces_select_staff" on public.bon_remise_conduces;
drop policy if exists "bon_remise_conduces_insert_staff" on public.bon_remise_conduces;
drop policy if exists "bon_remise_conduces_update_staff" on public.bon_remise_conduces;
drop policy if exists "bon_remise_conduces_delete_staff" on public.bon_remise_conduces;
create policy "bon_remise_conduces_select_staff" on public.bon_remise_conduces
  for select to authenticated using (public.is_staff());
create policy "bon_remise_conduces_insert_staff" on public.bon_remise_conduces
  for insert to authenticated with check (public.is_staff());
create policy "bon_remise_conduces_update_staff" on public.bon_remise_conduces
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "bon_remise_conduces_delete_staff" on public.bon_remise_conduces
  for delete to authenticated using (public.is_staff());

-- ── 1. Paiements de factures clients ────────────────────────────────────
alter table public.invoices add column if not exists payment_status text not null default 'Non payé';
alter table public.invoices add column if not exists payment_paid_usd numeric not null default 0;
alter table public.invoices add column if not exists payment_paid_htg numeric not null default 0;
alter table public.invoices add column if not exists payment_paid_at timestamptz;
alter table public.invoices add column if not exists payment_paid_by text;

update public.invoices
set payment_status = 'Non payé', payment_paid_usd = 0, payment_paid_htg = 0
where payment_status is null or payment_status not in ('Non payé', 'Payé partiel', 'Payé');

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'invoices_payment_status_check') then
    alter table public.invoices drop constraint invoices_payment_status_check;
  end if;
  alter table public.invoices add constraint invoices_payment_status_check
    check (payment_status in ('Non payé', 'Payé partiel', 'Payé'));
exception when duplicate_object then null;
end $$;

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric not null check (amount > 0),
  currency text not null check (currency in ('USD', 'HTG')),
  amount_usd numeric not null default 0 check (amount_usd >= 0),
  amount_htg numeric not null default 0 check (amount_htg >= 0),
  exchange_rate_used numeric not null default 0,
  received_by_staff_id uuid references public.staff(id) on delete set null,
  received_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists invoice_payments_invoice_created_idx
  on public.invoice_payments (invoice_id, created_at desc);
alter table public.invoice_payments enable row level security;

-- Aucun agent ne peut lire/écrire directement dans la table: l'API serveur
-- vérifie sa zone puis utilise la clé service. Seul l'admin lit le registre.
drop policy if exists "invoice_payments_select_admin" on public.invoice_payments;
drop policy if exists "invoice_payments_insert_admin" on public.invoice_payments;
drop policy if exists "invoice_payments_update_admin" on public.invoice_payments;
drop policy if exists "invoice_payments_delete_admin" on public.invoice_payments;
create policy "invoice_payments_select_admin" on public.invoice_payments
  for select to authenticated using (public.is_admin());
create policy "invoice_payments_insert_admin" on public.invoice_payments
  for insert to authenticated with check (public.is_admin());
create policy "invoice_payments_update_admin" on public.invoice_payments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "invoice_payments_delete_admin" on public.invoice_payments
  for delete to authenticated using (public.is_admin());

-- ── 2. Archive privée des Bons de remise ─────────────────────────────────
alter table public.bons_remise add column if not exists pdf_path text;
alter table public.bons_remise add column if not exists pdf_created_at timestamptz;

insert into storage.buckets (id, name, public) values ('bons-remise', 'bons-remise', false)
on conflict (id) do update set public = false;

drop policy if exists "bon_remise_files_staff_read" on storage.objects;
drop policy if exists "bon_remise_files_staff_insert" on storage.objects;
drop policy if exists "bon_remise_files_staff_update" on storage.objects;
drop policy if exists "bon_remise_files_admin_delete" on storage.objects;
create policy "bon_remise_files_staff_read" on storage.objects for select to authenticated
  using (bucket_id = 'bons-remise' and public.is_staff());
create policy "bon_remise_files_staff_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'bons-remise' and public.is_staff());
create policy "bon_remise_files_staff_update" on storage.objects for update to authenticated
  using (bucket_id = 'bons-remise' and public.is_staff())
  with check (bucket_id = 'bons-remise' and public.is_staff());
create policy "bon_remise_files_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'bons-remise' and public.is_admin());

commit;

-- Force PostgREST à relire les nouvelles colonnes tout de suite.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------
-- Fichier source : supabase/migrations/20260908120000_secure_invoice_documents.sql
-- ---------------------------------------------------------------
-- STANDA COMMERCIAL — PDFs de factures privés
-- À lancer dans Supabase SQL Editor après le déploiement du code associé.
-- Les anciens liens publics sont transformés en chemins internes puis effacés.

begin;

alter table public.invoices add column if not exists pdf_path text;
alter table public.invoices add column if not exists has_pdf boolean not null default false;

-- Récupère le chemin des anciens liens public Supabase sans déplacer les PDF.
update public.invoices
set pdf_path = split_part(pdf_url, '/invoices/', 2)
where coalesce(pdf_path, '') = ''
  and coalesce(pdf_url, '') like '%/invoices/%.pdf';

update public.invoices
set has_pdf = true
where coalesce(pdf_path, '') <> '';

-- L'URL Supabase ne doit plus sortir dans les requêtes client ni dans WhatsApp.
update public.invoices
set pdf_url = null
where coalesce(pdf_path, '') <> '';

insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do update set public = false;

-- Accès direct au bucket: personnel seulement. Les clients et agents passent
-- par l'API serveur qui vérifie l'identité et la propriété de la facture.
drop policy if exists "invoice_files_staff_read" on storage.objects;
drop policy if exists "invoice_files_customer_read" on storage.objects;
drop policy if exists "invoice_files_staff_insert" on storage.objects;
drop policy if exists "invoice_files_staff_update" on storage.objects;
drop policy if exists "invoice_files_admin_delete" on storage.objects;
create policy "invoice_files_staff_read" on storage.objects for select to authenticated
  using (bucket_id = 'invoices' and public.is_staff());
create policy "invoice_files_staff_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'invoices' and public.is_staff());
create policy "invoice_files_staff_update" on storage.objects for update to authenticated
  using (bucket_id = 'invoices' and public.is_staff())
  with check (bucket_id = 'invoices' and public.is_staff());
create policy "invoice_files_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'invoices' and public.is_admin());

commit;
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------
-- Fichier source : supabase/migrations/20260908130000_add_payment_methods_and_tolerance.sql
-- ---------------------------------------------------------------
-- STANDA COMMERCIAL — détails de paiement et tolérance d'arrondi
-- À exécuter après 20260908110000_add_pickup_operations.sql.

begin;

alter table public.invoice_payments add column if not exists payment_method text not null default 'Espèces';
alter table public.invoice_payments add column if not exists payment_reference text not null default '';
alter table public.invoice_payments add column if not exists applied_usd numeric not null default 0;
alter table public.invoice_payments add column if not exists applied_htg numeric not null default 0;
alter table public.invoice_payments add column if not exists overpayment_amount numeric not null default 0;
alter table public.invoice_payments add column if not exists recorded_by_role text not null default '';

-- Les anciennes écritures ont déjà été appliquées intégralement à leur facture.
update public.invoice_payments
set applied_usd = amount_usd, applied_htg = amount_htg
where applied_usd = 0 and applied_htg = 0 and (amount_usd > 0 or amount_htg > 0);

update public.invoice_payments
set payment_method = 'Espèces'
where payment_method is null or payment_method not in ('Espèces', 'MonCash', 'NatCash', 'Zelle', 'Virement bancaire');

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'invoice_payments_payment_method_check') then
    alter table public.invoice_payments drop constraint invoice_payments_payment_method_check;
  end if;
  alter table public.invoice_payments add constraint invoice_payments_payment_method_check
    check (payment_method in ('Espèces', 'MonCash', 'NatCash', 'Zelle', 'Virement bancaire'));
exception when duplicate_object then null;
end $$;

commit;
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------
-- Fichier source : supabase/migrations/20260909210000_add_package_delivery_timestamp.sql
-- ---------------------------------------------------------------
-- STANDA COMMERCIAL — Date réelle de remise au client
-- Les remises confirmées à partir de cette migration enregistrent leur date.
-- Les colis historiques ne sont pas modifiés: aucune fausse date n'est créée.

begin;

alter table public.packages
  add column if not exists delivered_at timestamptz;

create index if not exists packages_delivered_at_idx
  on public.packages (delivered_at desc)
  where status = 'Livré';

commit;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------
-- Fichier source : supabase/migrations/20260910010000_disable_forced_client_password_change.sql
-- ---------------------------------------------------------------
-- STANDA COMMERCIAL — Le changement de mot de passe est désormais volontaire.
-- Les anciens marqueurs ne doivent plus rediriger les clients après connexion.

begin;

update public.clients
set must_change_password = false
where must_change_password is true;

commit;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------
-- Fichier source : supabase/migrations/20260911120000_track_bon_remise_by_package.sql
-- ---------------------------------------------------------------
-- STANDA COMMERCIAL — Bon de remise : blocage par COLIS, pas par Conduce
--
-- BUG: une Conduce peut contenir des colis pour PLUSIEURS villes (ex :
-- Gonaïves ET Port-de-Paix). La contrainte `unique(conduce_id)` sur
-- bon_remise_conduces bloquait TOUTE la Conduce dès qu'un premier Bon de
-- remise (ex: Gonaïves) était créé — impossible de créer ensuite le Bon pour
-- les colis Port-de-Paix de la MÊME Conduce, alors qu'ils n'avaient jamais
-- été remis.
--
-- FIX: le blocage anti-doublon se fait maintenant COLIS PAR COLIS
-- (packages.bon_remise_id), pas Conduce par Conduce. Une Conduce reste
-- sélectionnable tant qu'il lui reste des colis pas encore remis ; seul un
-- colis déjà présent sur un Bon ne peut plus entrer dans un second.

begin;

alter table public.packages
  add column if not exists bon_remise_id uuid references public.bons_remise(id) on delete set null;

create index if not exists packages_bon_remise_id_idx
  on public.packages (bon_remise_id) where bon_remise_id is not null;

-- bon_remise_conduces reste une table INFORMATIVE (quelles Conduces ont
-- contribué à quel Bon, pour l'affichage) ; elle ne doit plus bloquer une
-- Conduce entière. Aucune nouvelle politique RLS n'est nécessaire : la mise à
-- jour de packages.bon_remise_id passe par la policy "packages_update_staff"
-- déjà en place dans security-hardening.sql.
alter table public.bon_remise_conduces
  drop constraint if exists bon_remise_conduces_conduce_id_key;

commit;

-- ---------------------------------------------------------------
-- Fichier source : supabase/migrations/20260911150000_add_push_subscriptions.sql
-- ---------------------------------------------------------------
-- STANDA COMMERCIAL — Abonnements notifications push (espace client)
--
-- Yon kliyan ka abòne plizyè aparèy (telefòn, òdinatè) — chak sesyon
-- navigatè kreye yon "endpoint" inik. Nou konsève sèlman sa Web Push mande
-- (endpoint + kle chifreman piblik), JANM okenn done pèsonèl anplis.
--
-- SEKIRITE: chak kliyan jere SÈLMAN pwòp abònman li (RLS pi ba a). Anvwa
-- notifikasyon yo fèt kote sèvè /api/notify (kle sèvis, kontoune RLS pou
-- LI tout abònman yon kòd kliyan bay) — jamè kle prive VAPID nan navigatè a.

begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_code text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_customer_idx
  on public.push_subscriptions (customer_code);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_select_staff" on public.push_subscriptions;

create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert to authenticated with check (
    exists (select 1 from public.clients c where c.auth_user_id = auth.uid()
      and (c.customer_code = push_subscriptions.customer_code or c.username = push_subscriptions.customer_code))
  );
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update to authenticated using (
    exists (select 1 from public.clients c where c.auth_user_id = auth.uid()
      and (c.customer_code = push_subscriptions.customer_code or c.username = push_subscriptions.customer_code))
  ) with check (
    exists (select 1 from public.clients c where c.auth_user_id = auth.uid()
      and (c.customer_code = push_subscriptions.customer_code or c.username = push_subscriptions.customer_code))
  );
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete to authenticated using (
    exists (select 1 from public.clients c where c.auth_user_id = auth.uid()
      and (c.customer_code = push_subscriptions.customer_code or c.username = push_subscriptions.customer_code))
  );
-- Okenn politik SELECT pou kliyan: navigatè a deja konnen si l abòne
-- (pushManager.getSubscription()) — pa gen rezon pou l li tab la. Sèvè a
-- (kle sèvis) kontoune RLS pou anvwa yo; staff ka enspekte pou depanaj.
create policy "push_subscriptions_select_staff" on public.push_subscriptions
  for select to authenticated using (public.is_staff());

commit;

-- ---------------------------------------------------------------
-- Fichier source : supabase/migrations/20260912100000_add_bon_remise_receipt.sql
-- ---------------------------------------------------------------
-- STANDA COMMERCIAL — Confirmation de réception d'un Bon de remise
--
-- Yon ajan pwen de retrait (ex: Rony, Gonaïves) dwe ka konfime li resevwa
-- fizikman koli yo lè li fin resevwa Bon de remise a. Konfimasyon sa a fè
-- TOUT koli ki nan Bon an vin "Disponible" (tarifikasyon aplike an menm
-- tan), otomatikman vizib sou admin, kliyan AK ajan an — yo tout li menm
-- kolòn `packages.status` la.
--
-- Aksyon an fèt kote sèvè (/api/pickup-agent, kle sèvis) : ajan an pa gen
-- dwa RLS dirèk sou `bons_remise` ni `packages` (wè kòmantè an tèt fichye
-- app/api/pickup-agent/route.ts).

begin;

alter table public.bons_remise add column if not exists received_at timestamptz;
alter table public.bons_remise add column if not exists received_by text;

commit;

-- ---------------------------------------------------------------
-- Fichier source : supabase/migrations/20260912120000_repair_invoice_finalization.sql
-- ---------------------------------------------------------------
-- STANDA COMMERCIAL — Réparation finale de facturation
--
-- La colonne est utilisée uniquement pour tracer la date de facturation.
-- Son absence faisait échouer la mise à jour des colis sur les projets
-- Supabase installés avant cette évolution.

begin;

alter table public.packages
  add column if not exists invoiced_at timestamptz;

commit;

notify pgrst, 'reload schema';

