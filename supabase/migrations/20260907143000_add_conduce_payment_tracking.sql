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
