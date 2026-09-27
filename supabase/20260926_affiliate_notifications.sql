-- STANDA COMMERCIAL — Notifikasyon admin pou chanjman afilye yo
-- ═══════════════════════════════════════════════════════════════════════════
-- KOURI SA A APRE: ... -> 20260925_affiliate_contract_payout.sql
-- Fichye REJOUABLE san erè (idempotent). Kole l nan Supabase -> SQL Editor -> Run.
--
-- Lè yon afilye chwazi/chanje nimewo MonCash/NatCash li oswa voye/ranplase
-- kontra siyen li (Espace Affilié -> Paramètres), CHAK admin resevwa yon
-- notifikasyon (kloch "Notifications" + push si li aktive l). Chanje nimewo
-- peman an se egzakteman sa yon moun ki vòlè yon sesyon ta fè: admin nan
-- dwe wè l anvan li peye.
--
-- staff_notifications: nouvo kalite 'affiliate_update' mare ak afilye a.
-- Pa gen nouvo tab: RLS staff_notifications (okenn politik navigatè, lekti
-- sèlman pa /api/staff-notifications) rete menm jan.

begin;

alter table public.affiliates add column if not exists payout_updated_at timestamptz;

alter table public.staff_notifications
  add column if not exists source_affiliate_id uuid references public.affiliates(id) on delete cascade;

alter table public.staff_notifications drop constraint if exists staff_notifications_kind_check;
alter table public.staff_notifications add constraint staff_notifications_kind_check
  check (kind in ('agency_payment', 'bon_remise_created', 'affiliate_update'));

alter table public.staff_notifications drop constraint if exists staff_notifications_check;
alter table public.staff_notifications add constraint staff_notifications_check check (
  (kind = 'agency_payment' and source_invoice_payment_id is not null
    and source_bon_remise_id is null and source_affiliate_id is null)
  or (kind = 'bon_remise_created' and source_bon_remise_id is not null
    and source_invoice_payment_id is null and source_affiliate_id is null)
  or (kind = 'affiliate_update' and source_affiliate_id is not null
    and source_invoice_payment_id is null and source_bon_remise_id is null)
);

create index if not exists staff_notifications_affiliate_idx
  on public.staff_notifications (source_affiliate_id, created_at desc)
  where source_affiliate_id is not null;

commit;
