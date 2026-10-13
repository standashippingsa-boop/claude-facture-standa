-- STANDA COMMERCIAL — NOTIFIKASYON PUSH: aparèy yo pa t janm anrejistre
-- ═══════════════════════════════════════════════════════════════════
-- Sentòm: bouton "Autoriser les notifications" bay yon echèk, tab yo rete
-- VID (zewo aparèy), donk okenn alèt pa ka pati.
-- Kòz: app la anrejistre aparèy la ak yon UPSERT (INSERT ... ON CONFLICT DO
-- UPDATE). Ak RLS, PostgreSQL egzije yon policy SELECT ki kite moun nan wè
-- pwòp liy li a. Kliyan yo te gen INSERT/UPDATE/DELETE men PA SELECT (sèl
-- pèsonèl la te ka li) -> chak anrejistreman te refize.
-- Solisyon: chak moun ka LI pwòp liy pa l sèlman. Anyen lòt pa chanje.

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated
  using (exists (select 1 from public.clients c
    where c.auth_user_id = auth.uid()
      and (c.customer_code = push_subscriptions.customer_code or c.username = push_subscriptions.customer_code)));

drop policy if exists fcm_device_tokens_select_own on public.fcm_device_tokens;
create policy fcm_device_tokens_select_own on public.fcm_device_tokens
  for select to authenticated
  using (exists (select 1 from public.clients c
    where c.auth_user_id = auth.uid()
      and (c.customer_code = fcm_device_tokens.customer_code or c.username = fcm_device_tokens.customer_code)));

drop policy if exists staff_push_subscriptions_select_own on public.staff_push_subscriptions;
create policy staff_push_subscriptions_select_own on public.staff_push_subscriptions
  for select to authenticated
  using (exists (select 1 from public.staff s
    where s.auth_user_id = auth.uid() and s.id = staff_push_subscriptions.staff_id));

drop policy if exists staff_fcm_tokens_select_own on public.staff_fcm_tokens;
create policy staff_fcm_tokens_select_own on public.staff_fcm_tokens
  for select to authenticated
  using (exists (select 1 from public.staff s
    where s.auth_user_id = auth.uid() and s.id = staff_fcm_tokens.staff_id));
