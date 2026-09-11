-- STANDA COMMERCIAL — Abonnements notifications push (espace client)
--
-- Yon kliyan ka abòne plizyè aparèy (telefòn, òdinatè) — chak sesyon
-- navigatè kreye yon "endpoint" inik. Nou konsève sèlman sa Web Push mande
-- (endpoint + kle chifreman piblik), JANM okenn done pèsonèl anplis.
--
-- SEKIRITE: chak kliyan jere SÈLMAN pwòp abònman li (RLS pi ba a). Anvwa
-- notifikasyon yo fèt kote sèvè /api/notify (kle sèvis, kontoune RLS pou
-- LI tout abònman yon kòd kliyan bay) — jamè kle prive VAPID nan navigatè a.

begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_code text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_customer_idx
  on public.push_subscriptions (customer_code);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_select_staff" on public.push_subscriptions;

create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert to authenticated with check (
    exists (select 1 from public.clients c where c.auth_user_id = auth.uid()
      and (c.customer_code = push_subscriptions.customer_code or c.username = push_subscriptions.customer_code))
  );
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update to authenticated using (
    exists (select 1 from public.clients c where c.auth_user_id = auth.uid()
      and (c.customer_code = push_subscriptions.customer_code or c.username = push_subscriptions.customer_code))
  ) with check (
    exists (select 1 from public.clients c where c.auth_user_id = auth.uid()
      and (c.customer_code = push_subscriptions.customer_code or c.username = push_subscriptions.customer_code))
  );
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete to authenticated using (
    exists (select 1 from public.clients c where c.auth_user_id = auth.uid()
      and (c.customer_code = push_subscriptions.customer_code or c.username = push_subscriptions.customer_code))
  );
-- Okenn politik SELECT pou kliyan: navigatè a deja konnen si l abòne
-- (pushManager.getSubscription()) — pa gen rezon pou l li tab la. Sèvè a
-- (kle sèvis) kontoune RLS pou anvwa yo; staff ka enspekte pou depanaj.
create policy "push_subscriptions_select_staff" on public.push_subscriptions
  for select to authenticated using (public.is_staff());

commit;
