-- STANDA COMMERCIAL — TICKET DE REMISE : qui a remis les colis au client.
--
-- `delivered_at` (20260909210000) regroupe déjà les colis d'une même remise.
-- `delivered_by` ajoute le nom de l'agent ou de l'administrateur qui a
-- confirmé la remise, imprimé sur le ticket (« Remis par »).
-- Le code fonctionne aussi avant cette migration : la ligne reste alors vide.
-- Aucune nouvelle table ni politique RLS : la colonne suit celles de `packages`.

begin;

alter table public.packages
  add column if not exists delivered_by text;

-- Rattrapage idempotent si la migration de `delivered_at` n'a jamais tourné
-- (workflow GitHub Actions peu fiable, voir README).
alter table public.packages
  add column if not exists delivered_at timestamptz;

create index if not exists packages_delivered_at_idx
  on public.packages (delivered_at desc)
  where status = 'Livré';

commit;

notify pgrst, 'reload schema';
