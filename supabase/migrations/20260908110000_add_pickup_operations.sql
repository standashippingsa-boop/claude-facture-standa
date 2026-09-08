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
