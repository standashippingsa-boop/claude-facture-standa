-- STANDA COMMERCIAL — PWOGRAM AFFILIATION (v20)
-- ═══════════════════════════════════════════════════════════════════════════
-- KOURI SA A APRE: migration.sql -> security-hardening.sql -> 20260831_public_reviews.sql
-- (li bezwen fonksyon public.is_admin() ki defini nan security-hardening.sql)
--
-- Fichye REJOUABLE san erè (idempotent) — ka kouri plizyè fwa san danje.
--
-- Rezime biznis (konfime ak STANDA — pa chanje san mande):
--   • Yon moun ranpli /affiliation (lyen PRIVE, pa nan menu piblik la).
--   • Admin apwouve -> sistèm jenere: kòd inik (?ref=KÒD), username, modpas,
--     yon kontra 3 mwa (contract_start/contract_end), epi voye yon imèl ak
--     kontra PDF la (fichye STANDA telechaje nan Paramètres) + lyen an.
--   • Chak fwa yon fakti kreye pou yon kliyan ki gen referred_by_affiliate_id,
--     SI dat jodi a tonbe nan [contract_start, contract_end] afilye a, yon
--     komisyon FIKS ($10 pa defo, konfigirab) anrejistre otomatikman —
--     TRIGGER SQL, pa kòd app la (garanti li pa ka janm bliye l).
--   • Apre 3 mwa: pou kontinye ak yon afilye, admin "Renouvle" — sistèm nan
--     kreye yon LIY AFILYE TOUNÈF (nouvo kòd/lyen/username/modpas, nouvo
--     imèl voye), pa yon modifikasyon sou plas. Ansyen liy la pase "expired"
--     epi rete kòm istorik — kliyan ki te enskri anba ANSYEN lyen an kontinye
--     jenere komisyon SÈLMAN pandan fenèt ansyen kontra a (deja ekspire).
--   • Afilye yo PA gen Supabase Auth: yon ti login apa (/api/affiliate-portal),
--     modpas kwape ak scrypt (jamè an clè), sesyon pa cookie httpOnly.
--     Konsekans SEKIRITE: okenn politik RLS pou "authenticated" isit la pa
--     bezwen sèvi afilye yo — se sèlman ADMIN (staff Supabase Auth) ki li/ekri
--     tab sa yo dirèkteman; pòtay afilye a li TOUJOU pa yon wout sèvè (service
--     role), jamè dirèk nan navigatè a.
--
-- SEPARASYON DE SISTÈM YO (kritik — pa touche san reflechi) :
--   Sistèm Affiliation an DWE rete izole de sistèm PRENSIPAL la, nan toude
--   sans — youn pa dwe "monte sou" lòt :
--     1) Yon BUG nan Affiliation PA JANM dwe bloke yon FAKTI (fonksyon
--        prensipal STANDA). Trigger la vlope lojik li nan yon blòk
--        EXCEPTION WHEN OTHERS — nenpòt erè anndan l pyeje san l pa kraze
--        `insert into invoices`.
--     2) Yon AKSYON nan sistèm prensipal la (efase/fusyone yon kliyan) PA
--        JANM dwe efase istorik finansye afilye a an silans — se pou sa
--        `affiliate_commissions.client_id` sèvi ak "on delete set null"
--        (pa "cascade") epi `affiliate_id` sèvi ak "on delete restrict".
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ============================================================
-- 1. TAB YO
-- ============================================================

create table if not exists affiliate_applications (
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
alter table affiliate_applications
  drop constraint if exists affiliate_applications_id_type_check;
alter table affiliate_applications
  add constraint affiliate_applications_id_type_check
  check (id_type in ('Carte d''identité nationale','Passeport','Permis de conduire'));

create table if not exists affiliates (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references affiliate_applications(id) on delete set null,
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
  -- Renouvèlman = NOUVO liy (nouvo kòd/lyen/login), jamè yon modifikasyon sou
  -- plas ansyen an: chak kontra gen pwòp lyen li pou rès la ka trase pwòp
  -- kliyantèl li. Sa a mennen tounen sou kontra ki te ranplase pa sa a.
  renewed_from_affiliate_id uuid references affiliates(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists affiliates_status_idx on affiliates (status);

-- SEPARASYON DE SISTÈM YO: yon aksyon nan sistèm PRENSIPAL la (efase/fusyone
-- yon kliyan, pa egzanp — Clients > Fusionner) PA DWE janm efase istorik
-- finansye pwogram Affiliation an an silans. Se pou sa `client_id` aksepte
-- NULL ak "on delete set null" olye "cascade" — si yon jou kliyan an disparèt,
-- liy komisyon an rete (kòm prèv $ afilye a te touche), sèlman lyen kliyan
-- an vin vid. `affiliate_id` itilize "restrict": pa gen okenn bouton pou
-- efase yon afilye nèt (sèlman revoke/expire), donk sa a se yon defans si
-- yon jou yon moun eseye fè l dirèkteman nan SQL — pito yon erè klè pase yon
-- pèt done kòmès san moun pa wè l.
create table if not exists affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete restrict,
  client_id uuid references clients(id) on delete set null,
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric not null,
  status text not null default 'due' check (status in ('due','paid')),
  paid_at timestamptz,
  payout_method text,
  paid_by text,  -- username anplwaye ki make peman an (piste odit, menm prensip ak invoices.payment_paid_by)
  created_at timestamptz not null default now(),
  unique (invoice_id)  -- yon fakti pa ka peye 2 fwa (idempotence)
);
create index if not exists affiliate_commissions_affiliate_idx on affiliate_commissions (affiliate_id);

-- Sesyon pòtay afilye a (PA Supabase Auth — jere pa /api/affiliate-portal sèlman).
create table if not exists affiliate_sessions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_sessions_expires_idx on affiliate_sessions (expires_at);

-- Attribution: ki afilye ki mennen kliyan sa a (fè istorik, jamè chanje apre).
alter table clients add column if not exists referred_by_affiliate_id uuid references affiliates(id) on delete set null;
create index if not exists clients_referred_by_affiliate_idx on clients (referred_by_affiliate_id);

-- ============================================================
-- 2. RLS — ADMIN SÈLMAN (dashboard). Pòtay afilye a pase pa service role.
-- ============================================================

alter table affiliate_applications enable row level security;
alter table affiliates enable row level security;
alter table affiliate_commissions enable row level security;
alter table affiliate_sessions enable row level security;

do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('affiliate_applications','affiliates','affiliate_commissions','affiliate_sessions')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "affiliate_applications_admin_all"
on public.affiliate_applications for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "affiliates_admin_all"
on public.affiliates for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "affiliate_commissions_admin_all"
on public.affiliate_commissions for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- affiliate_sessions: OKENN politik pou "authenticated"/"anon" — sèl service
-- role (ki kontoune RLS) touche tab sa a, nan /api/affiliate-portal.

-- ============================================================
-- 3. TRIGGER — KOMISYON OTOMATIK LÈ YON FAKTI KREYE
-- ============================================================
-- `invoices` idantifye kliyan an pa customer_code (tèks), pa yon FK uuid —
-- se konvansyon MCPACK ki deja sèvi nan tout rès sistèm nan.

create or replace function public.affiliate_commission_on_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c clients%rowtype;
  aff affiliates%rowtype;
begin
  -- ═══════════════════════════════════════════════════════════════════
  -- SEPARASYON DE SISTÈM YO — REGLE ABSOLI :
  -- Sistèm Affiliation an PA JANM DWE anpeche kreyasyon yon fakti, kèlkeswa
  -- ki erè ki rive nan blòk sa a (tab ki manke, kolòn ki chanje, kontrent
  -- vyole, elatriye). `EXCEPTION WHEN OTHERS` anba a pyeje TOUT erè epi
  -- senpleman pa fè komisyon an — men fakti a (fonksyon PRENSIPAL biznis
  -- la) toujou kreye nòmalman. San blòk sa a, yon senp bug isit la ta ka
  -- bloke TOUT fakti STANDA fè — sa pa akseptab.
  -- ═══════════════════════════════════════════════════════════════════
  begin
    select * into c from public.clients where customer_code = new.customer_code limit 1;
    if c.id is null or c.referred_by_affiliate_id is null then
      return new;
    end if;

    select * into aff from public.affiliates where id = c.referred_by_affiliate_id;
    if aff.id is null then
      return new;
    end if;

    -- Komisyon SÈLMAN si kontra a aktif EPI dat jodi a nan fenèt li.
    if aff.status = 'active'
       and current_date between aff.contract_start and aff.contract_end then
      insert into public.affiliate_commissions (affiliate_id, client_id, invoice_id, amount)
      values (aff.id, c.id, new.id, aff.commission_amount)
      on conflict (invoice_id) do nothing;
    end if;
  exception when others then
    raise warning 'affiliate_commission_on_invoice a echwe pou fakti % (% ) — fakti a kreye kanmenm, komisyon an senpleman pa anrejistre.',
      new.invoice_number, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_affiliate_commission on public.invoices;
create trigger trg_affiliate_commission
after insert on public.invoices
for each row execute function public.affiliate_commission_on_invoice();

commit;
