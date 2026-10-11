-- ============================================================
-- STANDA COMMERCIAL — Progression automatique des statuts colis
-- Déjà appliqué en production le 2026-09-30 via Supabase MCP.
-- Ce fichier est gardé ici pour la documentation / traçabilité,
-- et pour pouvoir le rejouer sur un autre environnement si besoin.
-- ============================================================
--
-- RÈGLE MÉTIER (demandée par l'utilisateur) :
--   • "Reçu à Miami"   -> "En préparation" après 24h
--   • "En préparation" -> "En transit"     après 24h
--   • "En transit"     -> "Arrivé en Haïti" : JAMAIS automatique —
--     cette transition reste RÉSERVÉE à l'entrée d'un Conduce
--     (voir shouldPromoteOnConduce dans lib/types.ts, et
--     app/api/ingest-conduce, lib/db.ts::linkPackagesToConduce).
--   • Tout colis plus avancé (Disponible, Livré, Facturé, archivé) :
--     jamais touché par ce mécanisme.
--
-- Exécuté chaque heure (cron.schedule), donc la marge d'erreur sur les
-- « 24h » est d'au plus 1 heure.

-- 1) Colonne qui mémorise depuis quand le colis est sur son statut actuel.
alter table public.packages
  add column if not exists status_changed_at timestamptz not null default now();

-- Backfill : pour les colis déjà "Reçu à Miami" / "En préparation", on part
-- de la vraie date de réception (pas de "maintenant") pour que le calcul
-- des 24h soit correct dès la première exécution.
update public.packages
set status_changed_at = coalesce(received_at, created_at)
where status in ('Reçu à Miami', 'En préparation');

-- 2) Trigger : chaque fois que `status` change — peu importe qui/quoi le
--    change (admin, scanner, Conduce, ou ce cron) — on réinitialise
--    l'horloge. Une seule source de vérité.
create or replace function public.packages_track_status_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_packages_status_changed_at on public.packages;
create trigger trg_packages_status_changed_at
before update on public.packages
for each row
execute function public.packages_track_status_change();

-- 3) Fonction appelée par le cron.
create or replace function public.advance_package_statuses()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n1 int;
  n2 int;
begin
  update public.packages
  set status = 'En préparation'
  where status = 'Reçu à Miami'
    and archived = false
    and invoice_id is null
    and status_changed_at <= now() - interval '24 hours';
  get diagnostics n1 = row_count;

  update public.packages
  set status = 'En transit'
  where status = 'En préparation'
    and archived = false
    and invoice_id is null
    and status_changed_at <= now() - interval '24 hours';
  get diagnostics n2 = row_count;

  -- "En transit" -> "Arrivé en Haïti" : PAS ICI. Rôle du Conduce uniquement.

  if n1 > 0 or n2 > 0 then
    insert into public.journal (user_name, action, details, package_ref, customer_code)
    values (
      'Système (auto)',
      'Progression automatique statut',
      format('%s colis "Reçu à Miami" -> "En préparation" | %s colis "En préparation" -> "En transit" (24h écoulées)', n1, n2),
      '', ''
    );
  end if;
end;
$$;

revoke all on function public.advance_package_statuses() from public;

-- 4) Programmation : exécution chaque heure.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'advance-package-statuses') then
    perform cron.unschedule('advance-package-statuses');
  end if;
end $$;

select cron.schedule(
  'advance-package-statuses',
  '0 * * * *',
  $cron$select public.advance_package_statuses();$cron$
);

-- ============================================================
-- VÉRIFICATION (à exécuter séparément, en tout temps)
-- ============================================================
-- select jobid, jobname, schedule, active from cron.job
--   where jobname = 'advance-package-statuses';
--
-- select action, details, created_at from journal
--   where action = 'Progression automatique statut'
--   order by created_at desc limit 20;
--
-- Pour déclencher une exécution manuelle immédiate (test) :
-- select public.advance_package_statuses();
