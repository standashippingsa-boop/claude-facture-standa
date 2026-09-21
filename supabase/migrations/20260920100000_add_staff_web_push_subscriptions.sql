-- STANDA COMMERCIAL — Web Push pour les agents de retrait
--
-- Les agents peuvent activer les notifications depuis leur espace dans un
-- navigateur ou une PWA. Les jetons FCM existants restent réservés aux APK
-- Android; cette table conserve uniquement les abonnements Web Push/VAPID.
-- Le fichier est rejouable sans créer de doublons.

begin;

create table if not exists public.staff_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists staff_push_subscriptions_staff_idx
  on public.staff_push_subscriptions (staff_id);

alter table public.staff_push_subscriptions enable row level security;

drop policy if exists "staff_push_subscriptions_insert_own" on public.staff_push_subscriptions;
drop policy if exists "staff_push_subscriptions_update_own" on public.staff_push_subscriptions;
drop policy if exists "staff_push_subscriptions_delete_own" on public.staff_push_subscriptions;
drop policy if exists "staff_push_subscriptions_select_staff" on public.staff_push_subscriptions;
drop policy if exists "staff_push_subscriptions_select_admin" on public.staff_push_subscriptions;

create policy "staff_push_subscriptions_insert_own" on public.staff_push_subscriptions
  for insert to authenticated with check (
    exists (
      select 1 from public.staff s
      where s.auth_user_id = auth.uid() and s.id = staff_push_subscriptions.staff_id
    )
  );

create policy "staff_push_subscriptions_update_own" on public.staff_push_subscriptions
  for update to authenticated using (
    exists (
      select 1 from public.staff s
      where s.auth_user_id = auth.uid() and s.id = staff_push_subscriptions.staff_id
    )
  ) with check (
    exists (
      select 1 from public.staff s
      where s.auth_user_id = auth.uid() and s.id = staff_push_subscriptions.staff_id
    )
  );

create policy "staff_push_subscriptions_delete_own" on public.staff_push_subscriptions
  for delete to authenticated using (
    exists (
      select 1 from public.staff s
      where s.auth_user_id = auth.uid() and s.id = staff_push_subscriptions.staff_id
    )
  );

-- L'envoi est fait côté serveur avec la clé de service. Seul un
-- administrateur peut auditer les abonnements, jamais un autre agent.
create policy "staff_push_subscriptions_select_admin" on public.staff_push_subscriptions
  for select to authenticated using (public.is_admin());

commit;
