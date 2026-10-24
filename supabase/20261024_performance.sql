-- STANDA COMMERCIAL — VITESSE DE LA BASE (24 oct.)
-- Objectif : rester fluide avec 1000 clients connectés en même temps.
--  1) Règles RLS : auth.uid(), is_staff(), is_admin() étaient recalculés pour
--     CHAQUE ligne lue. Entourés d'un (select …), ils sont calculés UNE fois par
--     requête (recommandation Supabase « auth_rls_initplan »). Même logique,
--     mêmes droits : seule la vitesse change.
--  2) Index manquants sur les colonnes de jointure (dont packages.invoice_id).
--  3) Index en double supprimés (écritures plus rapides).

do $$
declare
  p record;
  q text;
  c text;
  stmt text;
begin
  for p in
    select tablename, policyname, qual, with_check from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ '(auth\.(uid|role|jwt)\(\)|is_staff\(\)|is_admin\(\))'
        or coalesce(with_check, '') ~ '(auth\.(uid|role|jwt)\(\)|is_staff\(\)|is_admin\(\))')
  loop
    q := p.qual; c := p.with_check;
    -- Ne jamais doubler un (select …) déjà présent.
    if q is not null then
      q := regexp_replace(q, '\(\s*select\s+(auth\.(uid|role|jwt)\(\)|(public\.)?is_staff\(\)|(public\.)?is_admin\(\))\s*(as\s+\w+\s*)?\)', '\1', 'gi');
      q := regexp_replace(q, '(auth\.(uid|role|jwt)\(\)|(public\.)?is_staff\(\)|(public\.)?is_admin\(\))', '(select \1)', 'g');
    end if;
    if c is not null then
      c := regexp_replace(c, '\(\s*select\s+(auth\.(uid|role|jwt)\(\)|(public\.)?is_staff\(\)|(public\.)?is_admin\(\))\s*(as\s+\w+\s*)?\)', '\1', 'gi');
      c := regexp_replace(c, '(auth\.(uid|role|jwt)\(\)|(public\.)?is_staff\(\)|(public\.)?is_admin\(\))', '(select \1)', 'g');
    end if;
    stmt := format('alter policy %I on public.%I', p.policyname, p.tablename);
    if q is not null then stmt := stmt || format(' using (%s)', q); end if;
    if c is not null then stmt := stmt || format(' with check (%s)', c); end if;
    execute stmt;
  end loop;
end $$;

-- Index de jointure manquants
create index if not exists packages_invoice_id_idx on public.packages (invoice_id) where invoice_id is not null;
create index if not exists bon_remise_conduces_conduce_idx on public.bon_remise_conduces (conduce_id);
create index if not exists invoice_payments_received_by_idx on public.invoice_payments (received_by_staff_id);
create index if not exists staff_notifications_bon_idx on public.staff_notifications (source_bon_remise_id);
create index if not exists staff_notifications_payment_idx on public.staff_notifications (source_invoice_payment_id);
create index if not exists staff_notifications_recipient_idx on public.staff_notifications (recipient_staff_id, created_at desc);
create index if not exists affiliate_commissions_client_idx on public.affiliate_commissions (client_id);
create index if not exists affiliate_sessions_affiliate_idx on public.affiliate_sessions (affiliate_id);
create index if not exists challenge_ledger_claim_idx on public.challenge_ledger (claim_id);
create index if not exists challenge_ledger_aff_idx on public.challenge_ledger (participant_affiliate_id);
create index if not exists challenge_ledger_client_idx on public.challenge_ledger (participant_client_id);
create index if not exists reward_claims_reward_idx on public.reward_claims (reward_id);
create index if not exists reward_claims_client_idx on public.reward_claims (participant_client_id);
create index if not exists reward_claims_aff_idx on public.reward_claims (participant_affiliate_id);
create index if not exists packages_bon_null_idx on public.packages (conduce_id) where bon_remise_id is null;
create index if not exists journal_action_created_idx on public.journal (action, created_at desc);

-- Index en double
drop index if exists public.packages_conduce_idx;
drop index if exists public.packages_code_idx;
drop index if exists public.packages_status_idx;
drop index if exists public.invoices_number_idx;
