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

-- ===== RLS — DENY BY DEFAULT (refi tout pa defo) =====
-- ══════════════════════════════════════════════════════════════════════
-- ⚠️ CHANJMAN SEKIRITE (2026)
-- Ansyen vèsyon fichye sa a te kreye politik « anon all ... using(true) »
-- sou CHAK tab biznis. Sa vle di: nenpòt moun ak kle anon lan (kle a
-- livre nan chak paj nan navigatè a) te ka LI epi EKRI tout done yo —
-- non kliyan, adrès, pyès idantite, telefòn, montan fakti, kont staff.
--
-- Kounye a: RLS limenn, epi PA GEN okenn politik pèmisif isit la.
-- Aksè reyèl la (staff / kliyan / piblik) konfigire nan :
--
--        👉  supabase/security-hardening.sql   (OBLIGATWA)
--        👉  supabase/20260831_public_reviews.sql
--
-- Kouri de fichye sa yo TOUSWIT APRE fichye sa a. San yo, app la p ap
-- ka li anyen (li pi bon pou l bloke pase pou l louvri tout bagay).
-- ══════════════════════════════════════════════════════════════════════
alter table villes enable row level security;
alter table clients enable row level security;
alter table packages enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table imports enable row level security;
alter table app_settings enable row level security;
alter table exchange_rate enable row level security;

-- Retire ansyen politik danjere yo si yo egziste (baz ki te deja deplwaye)
drop policy if exists "anon all villes" on villes;
drop policy if exists "anon all clients" on clients;
drop policy if exists "anon all packages" on packages;
drop policy if exists "anon all invoices" on invoices;
drop policy if exists "anon all invoice_items" on invoice_items;
drop policy if exists "anon all imports" on imports;
drop policy if exists "anon all app_settings" on app_settings;
drop policy if exists "anon all exchange_rate" on exchange_rate;
drop policy if exists "anon storage invoices" on storage.objects;

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

-- ============================================================
-- v8 — Retraits, statuts entèn, FOB, Tracking Number manyèl
-- ============================================================
alter table packages add column if not exists fob numeric not null default 0;
alter table packages add column if not exists status_mcpack text not null default '';
alter table packages add column if not exists tracking_manual text not null default '';
alter table invoice_items add column if not exists tracking_manual text not null default '';

-- Demandes de retrait de colis
create table if not exists retraits (
  id uuid primary key default gen_random_uuid(),
  customer_code text not null,
  customer_name text not null default '',
  ville text not null default '',
  package_count int not null default 0,
  total_weight numeric not null default 0,
  status text not null default 'En attente',   -- 'En attente' | 'Préparé' | 'Remis'
  created_at timestamptz not null default now()
);
create table if not exists retrait_items (
  id uuid primary key default gen_random_uuid(),
  retrait_id uuid not null references retraits(id) on delete cascade,
  tracking_number text not null default '',
  tracking_manual text not null default '',
  content text not null default '',
  weight numeric not null default 0
);
create index if not exists retraits_status_idx on retraits (status);
create index if not exists retrait_items_rid_idx on retrait_items (retrait_id);

-- RLS deny-by-default (wè nòt sekirite anwo a — politik yo nan security-hardening.sql)
alter table retraits enable row level security;
alter table retrait_items enable row level security;
drop policy if exists "anon all retraits" on retraits;
drop policy if exists "anon all retrait_items" on retrait_items;

-- ============================================================
-- v9 — Authentication: Admin / Employé / Client
-- ============================================================
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  role text not null check (role in ('admin','employe')),
  username text unique not null,
  nom text not null default '',
  prenom text not null default '',
  email text not null default '',
  phone text not null default '',
  id_number text not null default '',      -- Paspò oswa CIN
  id_photo_url text not null default '',
  created_at timestamptz not null default now()
);
alter table staff enable row level security;
drop policy if exists "anon all staff" on staff;

alter table clients add column if not exists username text unique;             -- = kòd MC (MC-XXXXX)
alter table clients add column if not exists must_change_password boolean not null default false;

insert into storage.buckets (id, name, public) values ('staff-docs','staff-docs', true)
on conflict (id) do nothing;
-- Politik storage yo nan security-hardening.sql (staff/admin sèlman).
drop policy if exists "anon storage staff-docs" on storage.objects;

-- ============================================================
-- v10 (V7.2) — Customer Code inik fòma MC-XXXXX toupatou
-- ============================================================
-- Korije ansyen kòd yo ("25487" -> "MC-25487") sou TOUT tab yo
-- san pèdi okenn done. Sync MCPACK ap kontinye mache paske
-- parser Excel la nòmalize menm jan an kounye a.
update packages set customer_code = 'MC-' || customer_code
  where customer_code <> '' and upper(customer_code) not like 'MC-%';
update invoices set customer_code = 'MC-' || customer_code
  where customer_code <> '' and upper(customer_code) not like 'MC-%';
update retraits set customer_code = 'MC-' || customer_code
  where customer_code <> '' and upper(customer_code) not like 'MC-%';
-- Kliyan: rebatize sèlman si vèsyon "MC-..." la PA deja egziste.
-- (Si li egziste = 2 kont pou menm moun -> se bouton "Fusionner les comptes"
--  nan paj Clients la k ap konbine yo, san pèdi done.)
update clients c set customer_code = 'MC-' || c.customer_code,
                     username = case when c.username is not null and c.username <> ''
                                     then 'MC-' || c.customer_code else c.username end
  where c.customer_code is not null and c.customer_code <> ''
    and upper(c.customer_code) not like 'MC-%'
    and not exists (select 1 from clients c2
                    where c2.customer_code = 'MC-' || c.customer_code);

-- ============================================================
-- v11 — Ajans / Pwen retrait (annuaire public /agences)
-- ============================================================
-- Tab sa a te manke nan ansyen migrasyon yo: aplikasyon an (lib/agences.ts,
-- /agences piblik la ak /settings/agences admin lan) atann li, men okenn
-- fichye SQL pa t kreye l -> paj Ajans yo te toujou "endisponib".
-- Politik RLS yo nan security-hardening.sql (section 13B) :
--   • anon + authenticated ka LI ajans ki "active = true"
--   • staff ka li tout, admin ka efase.
create table if not exists agences (
  id uuid primary key default gen_random_uuid(),
  nom text unique not null,                 -- Ex: "Ouanaminthe" (inik -> pa 2 fwa menm vil)
  adresse text not null default '',
  telephone text not null default '',       -- fòma afichaj, Ex: "+509 4673 8117"
  whatsapp text not null default '',        -- chif sèlman pou wa.me, Ex: "50946738117"
  horaire_1 text not null default '',
  horaire_2 text not null default '',
  note text not null default '',
  ordre int not null default 0,             -- lòd afichaj (pi piti a anvan)
  active boolean not null default true,     -- false = kache sou /agences san efase
  created_at timestamptz not null default now()
);
-- Baz ki te gen yon ansyen vèsyon tab la: konplete kolòn ki manke yo.
alter table agences add column if not exists whatsapp text not null default '';
alter table agences add column if not exists horaire_1 text not null default '';
alter table agences add column if not exists horaire_2 text not null default '';
alter table agences add column if not exists note text not null default '';
alter table agences add column if not exists ordre int not null default 0;
alter table agences add column if not exists active boolean not null default true;
alter table agences add column if not exists created_at timestamptz not null default now();
create index if not exists agences_ordre_idx on agences (ordre, nom);

-- RLS deny-by-default (politik reyèl yo nan security-hardening.sql section 13B)
alter table agences enable row level security;
drop policy if exists "anon all agences" on agences;

-- ════════════════════════════════════════════════════════════════════
-- ✅ SCHÉMA OK.  ÉTAPE SUIVANTE OBLIGATOIRE — SÉCURITÉ :
--
--   1)  supabase/security-hardening.sql        (RLS staff / client / public)
--   2)  supabase/20260831_public_reviews.sql   (commentaires publics)
--
-- Tant que (1) n'est pas exécuté, RLS bloque toute lecture : c'est
-- volontaire (fail-closed). NE PAS recréer de politique « anon all ».
-- ════════════════════════════════════════════════════════════════════
do $$ begin
  raise notice '  ⚠️  STANDA COMMERCIAL : exécutez maintenant supabase/security-hardening.sql';
end $$;
