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
