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
