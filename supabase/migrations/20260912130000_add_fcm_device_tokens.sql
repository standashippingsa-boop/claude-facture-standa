-- STANDA COMMERCIAL — Jetons notifikasyon natif (app Android/Uptodown)
--
-- APK Capacitor la se yon WebView, PA Chrome konplè: Push API (web-push)
-- pa mache ladan l de manyè fyab, sitou lè app la fèmen nèt. Sèl mwayen
-- fyab pou yon notifikasyon parèt SOU TÉLÉFÒN LA menm lè app la fèmen se
-- Firebase Cloud Messaging (FCM) — @capacitor/push-notifications kliyan
-- an bay yon "jeton aparèy" inik, nou konsève l isit la pou sèvè a ka
-- voye yon mesaj FCM ateravè li (lib/push-fcm-server.ts).
--
-- Menm modèl RLS ak push_subscriptions (web-push) — chak kliyan jere
-- SÈLMAN pwòp jeton li; sèvè a (kle sèvis) li tout jeton yon kòd kliyan
-- bay pou voye notifikasyon yo.

begin;

create table if not exists public.fcm_device_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_code text not null,
  token text not null unique,
  platform text not null default 'android',
  created_at timestamptz not null default now()
);

create index if not exists fcm_device_tokens_customer_idx
  on public.fcm_device_tokens (customer_code);

alter table public.fcm_device_tokens enable row level security;

drop policy if exists "fcm_device_tokens_insert_own" on public.fcm_device_tokens;
drop policy if exists "fcm_device_tokens_update_own" on public.fcm_device_tokens;
drop policy if exists "fcm_device_tokens_delete_own" on public.fcm_device_tokens;
drop policy if exists "fcm_device_tokens_select_staff" on public.fcm_device_tokens;

create policy "fcm_device_tokens_insert_own" on public.fcm_device_tokens
  for insert to authenticated with check (
    exists (select 1 from public.clients c where c.auth_user_id = auth.uid()
      and (c.customer_code = fcm_device_tokens.customer_code or c.username = fcm_device_tokens.customer_code))
  );
create policy "fcm_device_tokens_update_own" on public.fcm_device_tokens
  for update to authenticated using (
    exists (select 1 from public.clients c where c.auth_user_id = auth.uid()
      and (c.customer_code = fcm_device_tokens.customer_code or c.username = fcm_device_tokens.customer_code))
  ) with check (
    exists (select 1 from public.clients c where c.auth_user_id = auth.uid()
      and (c.customer_code = fcm_device_tokens.customer_code or c.username = fcm_device_tokens.customer_code))
  );
create policy "fcm_device_tokens_delete_own" on public.fcm_device_tokens
  for delete to authenticated using (
    exists (select 1 from public.clients c where c.auth_user_id = auth.uid()
      and (c.customer_code = fcm_device_tokens.customer_code or c.username = fcm_device_tokens.customer_code))
  );
-- Okenn politik SELECT pou kliyan (menm rezon ak push_subscriptions) —
-- sèvè a (kle sèvis) kontoune RLS pou voye; staff ka enspekte pou depanaj.
create policy "fcm_device_tokens_select_staff" on public.fcm_device_tokens
  for select to authenticated using (public.is_staff());

commit;
