-- ═══════════════════════════════════════════════════════════════════════════
-- FILE D'ATTENTE DES NOTIFICATIONS CLIENT (courriel + push)
-- ───────────────────────────────────────────────────────────────────────────
-- Avant : l'envoi partait du navigateur de l'employé, seulement depuis certains
-- boutons. « Rendre disponible par Bon de remise », la réception des Bons par
-- l'agence ou un onglet fermé trop tôt = aucun message, et aucune trace.
--
-- Maintenant : chaque changement de statut d'un colis vers « Reçu à Miami » ou
-- « Disponible » crée une ligne ici (trigger, quel que soit l'écran ou l'API).
-- Toutes les minutes, pg_cron appelle /api/notify-dispatch qui envoie le
-- courriel et le push, note le résultat et réessaie les échecs.
-- Une seule notification par colis et par étape (unique), jamais de doublon.
-- Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  customer_code text not null,
  event text not null check (event in ('recu_miami', 'disponible')),
  created_at timestamptz not null default now(),
  -- 90 s d'attente : les colis d'une même opération partent dans UN courriel.
  next_attempt_at timestamptz not null default now() + interval '90 seconds',
  state text not null default 'pending' check (state in ('pending', 'processing', 'sent', 'skipped', 'failed')),
  attempts int not null default 0,
  locked_at timestamptz,
  email_state text,
  email_id text,
  push_count int not null default 0,
  last_error text,
  sent_at timestamptz,
  unique (package_id, event)
);
create index if not exists notification_outbox_due_idx on public.notification_outbox (state, next_attempt_at);
create index if not exists notification_outbox_created_idx on public.notification_outbox (created_at desc);

alter table public.notification_outbox enable row level security;
drop policy if exists "staff read notification outbox" on public.notification_outbox;
create policy "staff read notification outbox" on public.notification_outbox
  for select to authenticated using (public.is_staff());

-- Secret partagé entre pg_cron et /api/notify-dispatch. RLS sans politique :
-- ni anon ni authenticated ne peuvent le lire (seule la clé service le lit).
create table if not exists public.app_secrets (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
insert into public.app_secrets (key, value)
values ('notify_dispatch_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- ── Trigger : un colis qui arrive à une étape annoncée au client ──
create or replace function public.packages_enqueue_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_event text;
  v_code text := trim(coalesce(new.customer_code, ''));
  v_central text;
begin
  if new.status = 'Reçu à Miami' then v_event := 'recu_miami';
  elsif new.status = 'Disponible' then v_event := 'disponible';
  else return new;
  end if;
  if v_code = '' then return new; end if;
  -- Nouveau statut, ou colis qui reçoit enfin son code client.
  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and trim(coalesce(old.customer_code, '')) <> '' then
    return new;
  end if;
  select upper(trim(coalesce(value, ''))) into v_central from public.app_settings where key = 'central_account_code';
  if upper(v_code) = coalesce(v_central, '') then return new; end if;

  insert into public.notification_outbox (package_id, customer_code, event)
  values (new.id, v_code, v_event)
  on conflict (package_id, event) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_packages_enqueue_notification on public.packages;
create trigger trg_packages_enqueue_notification
  after insert or update of status, customer_code on public.packages
  for each row execute function public.packages_enqueue_notification();

-- ── Réservation des envois (appelée par le serveur avec la clé service) ──
-- Prend jusqu'à p_groups couples (client, étape) arrivés à échéance, avec TOUS
-- leurs colis en attente, pour qu'un client reçoive un seul courriel groupé.
create or replace function public.claim_notification_outbox(p_groups int default 25)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- Un envoi interrompu (fonction coupée) repart après 10 minutes.
  update public.notification_outbox
     set state = 'pending', locked_at = null
   where state = 'processing' and locked_at < now() - interval '10 minutes';

  return query
  with groups as (
    select o.customer_code, o.event
      from public.notification_outbox o
     where o.state = 'pending' and o.next_attempt_at <= now()
     group by o.customer_code, o.event
     order by min(o.created_at)
     limit greatest(1, p_groups)
  ), picked as (
    select o.id
      from public.notification_outbox o
      join groups g on g.customer_code = o.customer_code and g.event = o.event
     where o.state = 'pending'
     for update of o skip locked
  )
  update public.notification_outbox o
     set state = 'processing', locked_at = now(), attempts = o.attempts + 1
    from picked
   where o.id = picked.id
  returning o.*;
end;
$$;
revoke all on function public.claim_notification_outbox(int) from public, anon, authenticated;

-- ── Toutes les minutes : pg_cron appelle le serveur ──
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'standa-notify-dispatch') then
    perform cron.unschedule('standa-notify-dispatch');
  end if;
end $$;

select cron.schedule(
  'standa-notify-dispatch',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://www.standacommercialsa.com/api/notify-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', (select value from public.app_secrets where key = 'notify_dispatch_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists (select 1 from public.notification_outbox where state in ('pending', 'processing') and next_attempt_at <= now() + interval '1 minute');
  $cron$
);
