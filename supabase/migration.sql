-- ============================================================
-- STANDA COMMERCIAL — Migration v5.1
-- Kouri l nan Supabase > SQL Editor > Run.
-- SAN PÈDI DONE: li sèlman ajoute/rename sa ki nesesè.
-- Ou ka kouri l sou yon baz vid OSWA sou baz v4 ou a.
-- ============================================================

-- ===== VILLES (tarif an USD, Personnel + Business) =====
create table if not exists villes (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  price_personal numeric not null default 0,  -- USD / lb (Compte Personnel)
  price_business numeric not null default 0,  -- USD / lb (Compte Business)
  tax_personal numeric not null default 0,    -- USD / lb
  tax_business numeric not null default 0,    -- USD / lb
  fixed_fee numeric not null default 0,       -- USD (opsyonèl)
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Si w ap soti nan v4 (price_per_lb / tax_per_lb an HTG):
-- nou kopye ansyen valè yo nan kolòn Personnel yo, answit nou retire ansyen kolòn yo.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_name='villes' and column_name='price_per_lb') then
    alter table villes add column if not exists price_personal numeric not null default 0;
    alter table villes add column if not exists price_business numeric not null default 0;
    alter table villes add column if not exists tax_personal numeric not null default 0;
    alter table villes add column if not exists tax_business numeric not null default 0;
    update villes set price_personal = price_per_lb, tax_personal = tax_per_lb
      where price_personal = 0 and tax_personal = 0;
    alter table villes drop column price_per_lb;
    alter table villes drop column tax_per_lb;
  end if;
end $$;

-- ===== CLIENTS =====
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  customer_code text unique not null,
  fullname text not null,
  whatsapp text not null default '',
  pickup_location text not null default '',
  email text,
  created_at timestamptz not null default now()
);
alter table clients add column if not exists ville_id uuid references villes(id) on delete set null;
alter table clients add column if not exists account_type text not null default 'Personnel'; -- Personnel | Business
create index if not exists clients_ville_idx on clients (ville_id);

-- ===== TAUX DE CHANGE =====
create table if not exists exchange_rate (
  id int primary key default 1 check (id = 1),   -- yon sèl liy
  usd_rate numeric not null default 132,          -- 1 USD = X HTG
  updated_at timestamptz not null default now()
);
insert into exchange_rate (id, usd_rate) values (1, 132) on conflict (id) do nothing;

-- ===== PACKAGES (pri an USD + HTG) =====
create table if not exists packages (
  id uuid primary key default gen_random_uuid(),
  tracking_number text unique not null,       -- Tracking ID (Guía)
  customer_code text not null,
  customer_name text not null default '',
  weight numeric not null default 0,
  quantity int not null default 1,
  content text not null default '',
  created_date text not null default '',
  status text not null default 'Disponible',
  price_usd numeric not null default 0,
  tax_usd numeric not null default 0,
  total_usd numeric generated always as (price_usd + tax_usd) stored,
  price_htg numeric not null default 0,
  tax_htg numeric not null default 0,
  total_htg numeric generated always as (price_htg + tax_htg) stored,
  invoice_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists packages_code_idx on packages (customer_code);
create index if not exists packages_status_idx on packages (status);

-- v5.1: Tracking ID (Guía) se sèl idantifyan an — retire doublon package_id
alter table packages drop column if exists package_id;
-- v5.1: TOUT kolòn Excel MCPACK la konsève pou chak koli (Sucursal, Destino, Vol, Balance...)
alter table packages add column if not exists mcpack_data jsonb not null default '{}'::jsonb;

-- Si w ap soti nan v4 (price / tax / total):
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_name='packages' and column_name='price') then
    alter table packages drop column if exists total;      -- generated (price+tax)
    alter table packages rename column price to price_usd;
    alter table packages rename column tax to tax_usd;
    alter table packages add column if not exists total_usd numeric generated always as (price_usd + tax_usd) stored;
    alter table packages add column if not exists price_htg numeric not null default 0;
    alter table packages add column if not exists tax_htg numeric not null default 0;
    alter table packages add column if not exists total_htg numeric generated always as (price_htg + tax_htg) stored;
    -- konvèti ansyen valè HTG v4 yo an USD dapre to aktyèl la, epi kenbe HTG yo
    update packages set
      price_htg = price_usd,
      tax_htg   = tax_usd,
      price_usd = round(price_usd / (select usd_rate from exchange_rate where id=1), 2),
      tax_usd   = round(tax_usd   / (select usd_rate from exchange_rate where id=1), 2)
    where price_htg = 0 and price_usd > 10;  -- valè v4 yo te an HTG (gwo chif)
  end if;
end $$;

-- ===== INVOICES (USD + HTG + taux itilize a) =====
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  customer_code text not null,
  customer_name text not null,
  whatsapp text not null default '',
  pickup_location text not null default '',
  subtotal numeric not null default 0,        -- USD
  tax numeric not null default 0,             -- USD
  grand_total numeric not null default 0,     -- USD
  pdf_url text,
  created_at timestamptz not null default now()
);
alter table invoices add column if not exists exchange_rate_used numeric not null default 0;
alter table invoices add column if not exists ville text not null default '';  -- v5.1: vil kliyan an sou fakti a
alter table invoices add column if not exists total_usd numeric not null default 0;
alter table invoices add column if not exists total_htg numeric not null default 0;
alter table invoices add column if not exists package_count int not null default 0;
alter table invoices add column if not exists total_weight numeric not null default 0;

do $$ begin
  alter table packages add constraint packages_invoice_fk
    foreign key (invoice_id) references invoices(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ===== INVOICE ITEMS =====
create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  tracking_number text not null default '',   -- Tracking ID (Guía)
  weight numeric not null default 0,
  content text not null default '',
  price numeric not null default 0,   -- USD
  tax numeric not null default 0,     -- USD
  total numeric not null default 0    -- USD
);
create index if not exists invoice_items_inv_idx on invoice_items (invoice_id);

-- ===== IMPORTS =====
create table if not exists imports (
  id uuid primary key default gen_random_uuid(),
  filename text not null default '',
  total_rows int not null default 0,
  new_packages int not null default 0,
  existing_packages int not null default 0,
  new_clients int not null default 0,
  errors int not null default 0,
  created_at timestamptz not null default now()
);

-- ===== SETTINGS =====
create table if not exists app_settings (
  key text primary key,
  value text not null default ''
);
-- Règ espesyal ti koli: 0.01–0.99 lb = pri fiks (USD), tout kliyan
insert into app_settings (key, value) values ('small_parcel_price', '3.70')
on conflict (key) do nothing;

-- ===== STORAGE =====
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', true)
on conflict (id) do nothing;

-- ===== RLS =====
alter table villes enable row level security;
alter table clients enable row level security;
alter table packages enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table imports enable row level security;
alter table app_settings enable row level security;
alter table exchange_rate enable row level security;

do $$ begin create policy "anon all villes" on villes for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin create policy "anon all clients" on clients for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin create policy "anon all packages" on packages for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin create policy "anon all invoices" on invoices for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin create policy "anon all invoice_items" on invoice_items for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin create policy "anon all imports" on imports for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin create policy "anon all app_settings" on app_settings for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin create policy "anon all exchange_rate" on exchange_rate for all using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin create policy "anon storage invoices" on storage.objects for all
  using (bucket_id = 'invoices') with check (bucket_id = 'invoices');
exception when duplicate_object then null; end $$;

-- ===== Vil egzanp (fresh install sèlman — tarif USD, modifye yo nan Paramètres) =====
insert into villes (name, price_personal, price_business, tax_personal, tax_business, fixed_fee, active) values
  ('Port-au-Prince', 1.90, 1.60, 0.20, 0.15, 0, true),
  ('Cap-Haïtien',    2.30, 2.00, 0.25, 0.20, 0, true),
  ('Gonaïves',       2.10, 1.80, 0.20, 0.15, 0, true),
  ('Les Cayes',      2.50, 2.20, 0.25, 0.20, 0, true)
on conflict (name) do nothing;

-- ===== v5.1 nettoyage =====
alter table invoice_items drop column if exists package_id;

-- ============================================================
-- v6 — Enskripsyon kliyan + aktivasyon MCPACK
-- ============================================================
alter table clients add column if not exists surname text not null default '';
alter table clients add column if not exists phone text not null default '';
alter table clients add column if not exists country text not null default '';
alter table clients add column if not exists city text not null default '';
alter table clients add column if not exists city2 text not null default '';
alter table clients add column if not exists address text not null default '';
alter table clients add column if not exists id_type text not null default '';      -- 'Kat Idantite Nasyonal' | 'Paspò'
alter table clients add column if not exists id_number text not null default '';
alter table clients add column if not exists account_status text not null default 'Actif'; -- 'En attente d''activation' | 'Actif'
alter table clients add column if not exists auth_user_id uuid unique;

-- Kliyan ki enskri poko gen kòd MCPACK — kòd la vin obligatwa SÈLMAN apre aktivasyon
alter table clients alter column customer_code drop not null;

-- Ansyen kliyan yo rete Actif
update clients set account_status = 'Actif' where account_status is null or account_status = '';
