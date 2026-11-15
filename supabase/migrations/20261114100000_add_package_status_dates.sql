-- Date et heure de chaque étape d'un colis (« Parcours du colis » dans l'espace client).
-- status_dates = { "<statut>": "<timestamp>", ... }, rempli automatiquement
-- à chaque changement de statut. Sans risque à relancer.

alter table public.packages add column if not exists status_dates jsonb not null default '{}'::jsonb;

create or replace function public.packages_track_status_dates()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.status is not null and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    new.status_dates := coalesce(new.status_dates, '{}'::jsonb) || jsonb_build_object(new.status, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_packages_status_dates on public.packages;
create trigger trg_packages_status_dates
  before insert or update of status on public.packages
  for each row execute function public.packages_track_status_dates();

-- Anciens colis : on reprend les dates déjà connues.
update public.packages p
set status_dates = jsonb_strip_nulls(jsonb_build_object(
      'Reçu à Miami', p.created_at,
      'Arrivé en Haïti', p.conduce_linked_at,
      'En route vers agence', br.created_at,
      'Disponible', br.received_at,
      'Facturé', p.invoiced_at,
      'Livré', p.delivered_at
    ))
    || case when p.status is not null and p.status_changed_at is not null
            then jsonb_build_object(p.status, p.status_changed_at) else '{}'::jsonb end
from public.packages p2
left join public.bons_remise br on br.id = p2.bon_remise_id
where p2.id = p.id and p.status_dates = '{}'::jsonb;
