-- STANDA COMMERCIAL — Kontra siyen afilye + mòd peman (goud, MonCash/NatCash)
-- ═══════════════════════════════════════════════════════════════════════════
-- KOURI SA A APRE: ... -> 20260913_affiliate_program.sql -> 20260920_report_settlement.sql
-- Fichye REJOUABLE san erè (idempotent). Kole l nan Supabase -> SQL Editor -> Run.
--
-- 1) Afilye a enprime kontra a, siyen l, eskane l epi mete l nan Espace Affilié.
--    Fichye a ale nan yon bucket PRIVE (siyati + pyès idantite): se SÈLMAN
--    /api/affiliate-portal (afilye a li menm) ak /api/admin-auth (admin) ki
--    bay yon lyen siyen tanporè. Pa gen okenn politik storage: san politik,
--    ni anon ni authenticated pa ka li l (fail-closed) — service role sèlman.
-- 2) Komisyon yo peye SÈLMAN an goud, a 132,5 HTG pou 1 USD, pa MonCash oswa
--    NatCash (afilye a chwazi). paid_amount_htg kenbe montan goud ki te peye a.
--
-- Pa gen nouvo tab: politik RLS "affiliates_admin_all" / "affiliate_commissions_admin_all"
-- ki deja egziste yo kouvri kolòn sa yo.

begin;

alter table public.affiliates add column if not exists signed_contract_path text;
alter table public.affiliates add column if not exists signed_contract_uploaded_at timestamptz;
alter table public.affiliates add column if not exists payout_method text;
alter table public.affiliates add column if not exists payout_phone text not null default '';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'affiliates_payout_method_check') then
    alter table public.affiliates add constraint affiliates_payout_method_check
      check (payout_method is null or payout_method in ('MonCash', 'NatCash'));
  end if;
end $$;

alter table public.affiliate_commissions add column if not exists paid_amount_htg numeric;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('affiliate-contracts', 'affiliate-contracts', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

commit;
