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
