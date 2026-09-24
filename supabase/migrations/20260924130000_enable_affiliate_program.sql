-- STANDA COMMERCIAL — Réparation complète du programme d'affiliation
--
-- Cette migration est rejouable. Elle place enfin dans le dossier déployé
-- les tables du programme qui existaient jusque-là seulement dans le script
-- manuel 20260913_affiliate_program.sql. Une candidature peut donc être
-- enregistrée, approuvée et suivie sans dépendre d'une table absente.
--
-- Prérequis: migration.sql puis security-hardening.sql (public.is_admin()).

begin;

create table if not exists public.affiliate_applications (
  id uuid primary key default gen_random_uuid(),
  fullname text not null,
  email text not null,
  phone text not null,
  whatsapp text not null default '',
  city text not null default '',
  id_type text not null,
  id_number text not null,
  motivation text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

alter table public.affiliate_applications add column if not exists whatsapp text not null default '';
alter table public.affiliate_applications add column if not exists city text not null default '';
alter table public.affiliate_applications add column if not exists motivation text not null default '';
alter table public.affiliate_applications add column if not exists status text not null default 'pending';
alter table public.affiliate_applications add column if not exists created_at timestamptz not null default now();
alter table public.affiliate_applications
  drop constraint if exists affiliate_applications_id_type_check;
alter table public.affiliate_applications
  add constraint affiliate_applications_id_type_check
  check (id_type in ('Carte d''identité nationale','Passeport','Permis de conduire'));

create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.affiliate_applications(id) on delete set null,
  fullname text not null,
  email text not null,
  phone text not null default '',
  whatsapp text not null default '',
  code text not null unique,
  username text not null unique,
  password_hash text not null,
  referral_link text not null,
  contract_start date not null,
  contract_end date not null,
  status text not null default 'active' check (status in ('active','expired','revoked')),
  commission_amount numeric not null default 10,
  renewed_from_affiliate_id uuid references public.affiliates(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists affiliates_status_idx on public.affiliates (status);

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric not null,
  status text not null default 'due' check (status in ('due','paid')),
  paid_at timestamptz,
  payout_method text,
  paid_by text,
  created_at timestamptz not null default now(),
  unique (invoice_id)
);
create index if not exists affiliate_commissions_affiliate_idx on public.affiliate_commissions (affiliate_id);

create table if not exists public.affiliate_sessions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_sessions_expires_idx on public.affiliate_sessions (expires_at);

alter table public.clients
  add column if not exists referred_by_affiliate_id uuid references public.affiliates(id) on delete set null;
create index if not exists clients_referred_by_affiliate_idx
  on public.clients (referred_by_affiliate_id);

alter table public.affiliate_applications enable row level security;
alter table public.affiliates enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.affiliate_sessions enable row level security;

drop policy if exists "affiliate_applications_admin_all" on public.affiliate_applications;
drop policy if exists "affiliates_admin_all" on public.affiliates;
drop policy if exists "affiliate_commissions_admin_all" on public.affiliate_commissions;

create policy "affiliate_applications_admin_all"
on public.affiliate_applications for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "affiliates_admin_all"
on public.affiliates for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "affiliate_commissions_admin_all"
on public.affiliate_commissions for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Chaque facture créée pour un client référé ajoute une seule commission.
-- Toute erreur de ce programme reste isolée: elle ne bloque jamais une facture.
create or replace function public.affiliate_commission_on_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  client_row public.clients%rowtype;
  affiliate_row public.affiliates%rowtype;
begin
  begin
    select * into client_row
    from public.clients
    where customer_code = new.customer_code
    limit 1;

    if client_row.id is null or client_row.referred_by_affiliate_id is null then
      return new;
    end if;

    select * into affiliate_row
    from public.affiliates
    where id = client_row.referred_by_affiliate_id;

    if affiliate_row.id is not null
       and affiliate_row.status = 'active'
       and current_date between affiliate_row.contract_start and affiliate_row.contract_end then
      insert into public.affiliate_commissions (affiliate_id, client_id, invoice_id, amount)
      values (affiliate_row.id, client_row.id, new.id, affiliate_row.commission_amount)
      on conflict (invoice_id) do nothing;
    end if;
  exception when others then
    raise warning 'Commission affiliation ignorée pour facture %: %', new.invoice_number, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_affiliate_commission on public.invoices;
create trigger trg_affiliate_commission
after insert on public.invoices
for each row execute function public.affiliate_commission_on_invoice();

commit;
