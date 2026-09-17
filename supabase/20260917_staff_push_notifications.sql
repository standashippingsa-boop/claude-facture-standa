-- STANDA COMMERCIAL — Notifikasyon push pou pèsonèl (app Agence, etc.)
-- ═══════════════════════════════════════════════════════════════════════════
-- KOURI SA A APRE: migration.sql -> security-hardening.sql -> 20260831_public_reviews.sql
--                   -> 20260913_affiliate_program.sql -> 20260915_reception_agent.sql
--
-- Fichye REJOUABLE san erè (idempotent).
--
-- Menm modèl ak `fcm_device_tokens` (kliyan yo, 20260912130000) men pou
-- PÈSONÈL: yon ajan_retrait ki gen app "Standa Agence" enstale a jwenn yon
-- notifikasyon lè yon nouvo Bon de Remise kreye pou zòn li — pa bezwen
-- louvri app la pou l konnen yon lo koli ap tann konfimasyon.
--
-- `staff_id` idantifye moun nan (pa customer_code, ki se pou kliyan sèlman).
-- Chak moun jere SÈLMAN pwòp jeton pa yo; sèvè a (kle sèvis, /api/notify-agent)
-- li tout jeton yon staff_id bay pou voye notifikasyon an.

begin;

create table if not exists public.staff_fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android',
  created_at timestamptz not null default now()
);

create index if not exists staff_fcm_tokens_staff_idx on public.staff_fcm_tokens (staff_id);

alter table public.staff_fcm_tokens enable row level security;

drop policy if exists "staff_fcm_tokens_insert_own" on public.staff_fcm_tokens;
drop policy if exists "staff_fcm_tokens_update_own" on public.staff_fcm_tokens;
drop policy if exists "staff_fcm_tokens_delete_own" on public.staff_fcm_tokens;
drop policy if exists "staff_fcm_tokens_select_staff" on public.staff_fcm_tokens;

create policy "staff_fcm_tokens_insert_own" on public.staff_fcm_tokens
  for insert to authenticated with check (
    exists (select 1 from public.staff s where s.auth_user_id = auth.uid() and s.id = staff_fcm_tokens.staff_id)
  );
create policy "staff_fcm_tokens_update_own" on public.staff_fcm_tokens
  for update to authenticated using (
    exists (select 1 from public.staff s where s.auth_user_id = auth.uid() and s.id = staff_fcm_tokens.staff_id)
  ) with check (
    exists (select 1 from public.staff s where s.auth_user_id = auth.uid() and s.id = staff_fcm_tokens.staff_id)
  );
create policy "staff_fcm_tokens_delete_own" on public.staff_fcm_tokens
  for delete to authenticated using (
    exists (select 1 from public.staff s where s.auth_user_id = auth.uid() and s.id = staff_fcm_tokens.staff_id)
  );
-- Okenn politik SELECT pou anplwaye/ajan òdinè (menm rezon ak fcm_device_tokens)
-- — sèvè a (kle sèvis) kontoune RLS pou voye; admin/employé ka enspekte pou depanaj.
create policy "staff_fcm_tokens_select_staff" on public.staff_fcm_tokens
  for select to authenticated using (public.is_staff());

commit;
