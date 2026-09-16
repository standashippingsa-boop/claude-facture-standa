-- STANDA COMMERCIAL — Notifications d'opérations internes
--
-- Deux événements sont conservés de façon atomique dans la base :
--   1. un paiement saisi par un point de retrait -> tous les administrateurs;
--   2. un Bon de remise créé -> le ou les agents affectés à cette ville.
--
-- Les triggers, plutôt qu'un appel navigateur, évitent les notifications
-- perdues lors d'un rechargement, d'une coupure réseau ou d'un double-clic.

begin;

create table if not exists public.staff_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_staff_id uuid not null references public.staff(id) on delete cascade,
  source_invoice_payment_id uuid references public.invoice_payments(id) on delete cascade,
  source_bon_remise_id uuid references public.bons_remise(id) on delete cascade,
  kind text not null check (kind in ('agency_payment', 'bon_remise_created')),
  title text not null,
  message text not null default '',
  href text not null default '',
  -- Clé métier unique : une même opération ne peut jamais produire deux fois
  -- la même notification chez le même destinataire.
  event_key text not null unique,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (
    (kind = 'agency_payment' and source_invoice_payment_id is not null and source_bon_remise_id is null)
    or
    (kind = 'bon_remise_created' and source_bon_remise_id is not null and source_invoice_payment_id is null)
  )
);

create index if not exists staff_notifications_recipient_created_idx
  on public.staff_notifications (recipient_staff_id, created_at desc);
create index if not exists staff_notifications_recipient_unread_idx
  on public.staff_notifications (recipient_staff_id, created_at desc)
  where read_at is null;

alter table public.staff_notifications enable row level security;

-- Lecture et marquage « lu » passent seulement par /api/staff-notifications.
-- Aucune politique navigateur n'est créée : un agent ne peut donc jamais
-- demander les notifications d'un autre agent ni insérer de faux événements.

create or replace function public.queue_agency_payment_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_number_value text := '';
  customer_code_value text := '';
  agent_name_value text := '';
begin
  if coalesce(new.recorded_by_role, '') <> 'agent_retrait' then
    return new;
  end if;

  select coalesce(i.invoice_number, ''), coalesce(i.customer_code, '')
    into invoice_number_value, customer_code_value
  from public.invoices i
  where i.id = new.invoice_id;

  agent_name_value := nullif(trim(coalesce(new.received_by_name, '')), '');

  insert into public.staff_notifications (
    recipient_staff_id, source_invoice_payment_id, kind, title, message, href, event_key
  )
  select
    s.id,
    new.id,
    'agency_payment',
    'Paiement reçu en agence',
    concat_ws(' · ',
      nullif(invoice_number_value, ''),
      nullif(customer_code_value, ''),
      concat(coalesce(new.amount, 0), ' ', coalesce(new.currency, '')),
      nullif(coalesce(new.payment_method, ''), ''),
      agent_name_value
    ),
    '/rapports-financiers',
    concat('agency-payment:', new.id::text, ':staff:', s.id::text)
  from public.staff s
  where s.role = 'admin'
  on conflict (event_key) do nothing;

  return new;
end;
$$;

revoke all on function public.queue_agency_payment_notification() from public;

drop trigger if exists staff_notify_agency_payment on public.invoice_payments;
create trigger staff_notify_agency_payment
after insert on public.invoice_payments
for each row execute function public.queue_agency_payment_notification();

create or replace function public.queue_bon_remise_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.staff_notifications (
    recipient_staff_id, source_bon_remise_id, kind, title, message, href, event_key
  )
  select
    s.id,
    new.id,
    'bon_remise_created',
    'Nouveau Bon de remise',
    concat(new.bon_number, ' · ', new.package_count, ' colis à recevoir à ', v.name),
    '/espace-remise',
    concat('bon-remise:', new.id::text, ':staff:', s.id::text)
  from public.staff s
  join public.villes v on v.id = s.pickup_ville_id and v.active = true
  where s.role = 'agent_retrait'
    -- `destination` vient de la liste de villes active de l'administration;
    -- la comparaison insensible à la casse évite les écarts de saisie usuels.
    and lower(trim(v.name)) = lower(trim(new.destination))
  on conflict (event_key) do nothing;

  return new;
end;
$$;

revoke all on function public.queue_bon_remise_notification() from public;

drop trigger if exists staff_notify_bon_remise on public.bons_remise;
create trigger staff_notify_bon_remise
after insert on public.bons_remise
for each row execute function public.queue_bon_remise_notification();

commit;

notify pgrst, 'reload schema';
