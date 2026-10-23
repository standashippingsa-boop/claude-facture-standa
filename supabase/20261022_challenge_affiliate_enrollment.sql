-- ═══════════════════════════════════════════════════════════════════════════
-- STANDA — CHALLENGE DE NOËL : participation des affiliés SUR VALIDATION
-- ═══════════════════════════════════════════════════════════════════════════
-- Tous les affiliés ne veulent pas entrer dans le challenge. Désormais :
--  • un affilié DEMANDE à participer (espace client) ou l'admin l'inscrit ;
--  • l'admin VALIDE, REFUSE ou RETIRE (console /challenge) ;
--  • seul un affilié VALIDÉ reçoit des livres comme affilié (les siennes + celles
--    de ses filleuls). Un affilié non validé participe comme un client normal
--    (ses propres livres comptent pour lui) et les livres de ses filleuls restent
--    à chaque filleul.
-- Non destructif : nouvelle table + fonctions remplacées. Le grand livre n'est
-- jamais modifié ; les affiliés qui ont déjà des livres sont inscrits d'office.
-- À exécuter en entier dans Supabase → SQL Editor → Run.

begin;

create table if not exists public.challenge_affiliate_enrollments (
  campaign_id uuid not null references public.challenge_campaigns(id) on delete cascade,
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  requested_by text not null default '',
  decided_at timestamptz,
  decided_by text not null default '',
  primary key (campaign_id, affiliate_id)
);
alter table public.challenge_affiliate_enrollments enable row level security;
drop policy if exists challenge_enrollments_admin_read on public.challenge_affiliate_enrollments;
create policy challenge_enrollments_admin_read on public.challenge_affiliate_enrollments
  for select to authenticated using (coalesce(public.is_admin(), false));

-- Reprise : un affilié qui a déjà des écritures garde sa place (aucune perte de solde).
insert into public.challenge_affiliate_enrollments (campaign_id, affiliate_id, status, requested_by, decided_at, decided_by)
select distinct l.campaign_id, l.participant_affiliate_id, 'approved', 'migration', now(), 'migration'
from public.challenge_ledger l where l.participant_affiliate_id is not null
on conflict (campaign_id, affiliate_id) do nothing;

-- Campagne concernée par les inscriptions : l'active, sinon le brouillon le plus récent.
create or replace function public.challenge_enrollment_campaign() returns uuid
language sql stable security definer set search_path = public as $$
  select id from challenge_campaigns where status <> 'closed' order by (status = 'active') desc, start_at desc limit 1
$$;

create or replace function public.challenge_affiliate_enrolled(p_campaign uuid, p_affiliate uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from challenge_affiliate_enrollments e
                 where e.campaign_id = p_campaign and e.affiliate_id = p_affiliate and e.status = 'approved')
$$;

-- Bénéficiaire d'un colis pour UNE campagne :
-- 1) le client est affilié actif : validé → l'affilié ; non validé → le client lui-même ;
-- 2) rattaché à un parrain actif ET validé → le parrain ; 3) sinon → le client.
create or replace function public.challenge_beneficiary_for(p_client_id uuid, p_at timestamptz, p_campaign uuid)
returns table (client_id uuid, affiliate_id uuid)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_self uuid; v_sponsor uuid;
begin
  select a.id into v_self from affiliates a
   where a.client_id = p_client_id and a.status = 'active' and coalesce(a.activated_at, a.created_at) <= p_at limit 1;
  if v_self is not null then
    if challenge_affiliate_enrolled(p_campaign, v_self) then return query select null::uuid, v_self; return; end if;
    return query select p_client_id, null::uuid; return;
  end if;
  select m.affiliate_id into v_sponsor from referral_memberships m join affiliates a on a.id = m.affiliate_id
   where m.client_id = p_client_id and m.started_at <= p_at and (m.ended_at is null or m.ended_at > p_at) and a.status = 'active' limit 1;
  if v_sponsor is not null and challenge_affiliate_enrolled(p_campaign, v_sponsor) then
    return query select null::uuid, v_sponsor; return;
  end if;
  return query select p_client_id, null::uuid;
end $$;

-- Qualification d'un colis : identique, avec le bénéficiaire par campagne.
create or replace function public.challenge_on_package_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_central text;
  v_client uuid;
  v_at timestamptz;
  v_campaign record;
  v_benef record;
  v_net numeric;
  v_n int;
  v_last record;
begin
  if not ((new.status = 'Livré') is distinct from (old.status = 'Livré')) then return new; end if;
  select upper(trim(coalesce(value, ''))) into v_central from app_settings where key = 'central_account_code';
  if upper(trim(coalesce(new.customer_code, ''))) = coalesce(v_central, '') then return new; end if;
  select id into v_client from clients where customer_code = new.customer_code limit 1;
  if v_client is null then return new; end if;

  if new.status = 'Livré' and old.status is distinct from 'Livré' then
    v_at := coalesce(new.delivered_at, now());
    for v_campaign in select * from challenge_campaigns c
      where c.status = 'active' and c.start_at <= v_at and (c.end_at is null or c.end_at > v_at)
    loop
      perform pg_advisory_xact_lock(hashtext('challenge-pkg:' || new.id::text));
      select coalesce(sum(lbs_delta), 0) into v_net from challenge_ledger
        where campaign_id = v_campaign.id and package_id = new.id and kind in ('credit', 'reversal');
      if v_net > 0 or coalesce(new.weight, 0) <= 0 then continue; end if;
      select * into v_benef from challenge_beneficiary_for(v_client, v_at, v_campaign.id);
      select count(*) into v_n from challenge_ledger where campaign_id = v_campaign.id and package_id = new.id and kind = 'credit';
      insert into challenge_ledger (campaign_id, package_id, participant_client_id, participant_affiliate_id, lbs_delta, kind, source_event_id, rule, reason, occurred_at)
      values (v_campaign.id, new.id, v_benef.client_id, v_benef.affiliate_id, round(new.weight::numeric, 2), 'credit',
              'credit:' || v_campaign.id || ':' || new.id || ':' || v_n,
              case when v_benef.affiliate_id is null then 'propre' else 'affilie' end,
              'Colis ' || coalesce(new.tracking_number, '') || ' livré', v_at)
      on conflict (source_event_id) do nothing;
    end loop;
  end if;

  if old.status = 'Livré' and new.status is distinct from 'Livré' then
    for v_last in
      select l.campaign_id, l.participant_client_id, l.participant_affiliate_id,
             sum(l.lbs_delta) as net, count(*) filter (where l.kind = 'reversal') as reversals
      from challenge_ledger l where l.package_id = new.id and l.kind in ('credit', 'reversal')
      group by l.campaign_id, l.participant_client_id, l.participant_affiliate_id having sum(l.lbs_delta) > 0
    loop
      insert into challenge_ledger (campaign_id, package_id, participant_client_id, participant_affiliate_id, lbs_delta, kind, source_event_id, rule, reason)
      values (v_last.campaign_id, new.id, v_last.participant_client_id, v_last.participant_affiliate_id, -v_last.net, 'reversal',
              'reversal:' || v_last.campaign_id || ':' || new.id || ':' || v_last.reversals, 'correction',
              'Colis ' || coalesce(new.tracking_number, '') || ' : statut « Livré » annulé (' || coalesce(new.status, '') || ')')
      on conflict (source_event_id) do nothing;
    end loop;
  end if;
  return new;
end $$;

-- « Mon challenge » : un affilié non validé voit son solde de client + l'état de sa demande.
create or replace function public.challenge_me()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_client clients%rowtype;
  v_aff affiliates%rowtype;
  v_sponsor affiliates%rowtype;
  v_campaign challenge_campaigns%rowtype;
  v_enrolled boolean;
  v_sponsored boolean;
  v_shipped numeric;
  v_out jsonb;
begin
  select * into v_client from clients where auth_user_id = auth.uid() limit 1;
  if v_client.id is null then raise exception 'Compte client introuvable.'; end if;
  select * into v_campaign from challenge_campaigns where status = 'active' order by start_at desc limit 1;
  if v_campaign.id is null then return jsonb_build_object('campaign', null); end if;
  select * into v_aff from affiliates where client_id = v_client.id and status = 'active';
  v_enrolled := v_aff.id is not null and challenge_affiliate_enrolled(v_campaign.id, v_aff.id);
  select a.* into v_sponsor from referral_memberships m join affiliates a on a.id = m.affiliate_id
    where m.client_id = v_client.id and m.ended_at is null and a.status = 'active' limit 1;
  v_sponsored := v_aff.id is null and v_sponsor.id is not null and challenge_affiliate_enrolled(v_campaign.id, v_sponsor.id);
  select coalesce(sum(weight), 0) into v_shipped from packages
    where customer_code = v_client.customer_code and status = 'Livré'
      and coalesce(delivered_at, created_at) >= v_campaign.start_at and (v_campaign.end_at is null or coalesce(delivered_at, created_at) < v_campaign.end_at);

  v_out := jsonb_build_object(
    'campaign', jsonb_build_object('id', v_campaign.id, 'name', v_campaign.name, 'start_at', v_campaign.start_at, 'end_at', v_campaign.end_at, 'allow_repeat_wins', v_campaign.allow_repeat_wins),
    'rewards', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'model', r.model, 'target_lbs', r.target_lbs, 'condition', r.condition) order by r.sort_order, r.target_lbs)
                         from challenge_rewards r where r.campaign_id = v_campaign.id and r.active), '[]'::jsonb),
    'shipped_lbs', v_shipped,
    'sponsored', v_sponsored,
    'is_affiliate', v_aff.id is not null,
    'enrollment', case when v_aff.id is null then null
                       else coalesce((select e.status from challenge_affiliate_enrollments e where e.campaign_id = v_campaign.id and e.affiliate_id = v_aff.id), 'none') end
  );
  if v_enrolled then
    v_out := v_out || jsonb_build_object(
      'balances', challenge_balances(v_campaign.id, null, v_aff.id),
      'affiliate', jsonb_build_object('code', v_aff.code, 'referral_link', v_aff.referral_link,
        'active_referrals', (select count(*) from referral_memberships where affiliate_id = v_aff.id and ended_at is null),
        'new_referrals', (select count(*) from referral_memberships where affiliate_id = v_aff.id and ended_at is null and started_at >= v_campaign.start_at),
        'referrals', coalesce((select jsonb_agg(jsonb_build_object(
            'code', c.customer_code,
            'name', split_part(coalesce(c.fullname, ''), ' ', 1) || coalesce(' ' || left(nullif(c.surname, ''), 1) || '.', ''),
            'since', m.started_at, 'active', m.ended_at is null,
            'credited_lbs', (select coalesce(sum(l.lbs_delta), 0) from challenge_ledger l join packages p on p.id = l.package_id
                              where l.campaign_id = v_campaign.id and l.participant_affiliate_id = v_aff.id and l.kind in ('credit', 'reversal') and p.customer_code = c.customer_code)
          ) order by m.started_at desc) from referral_memberships m join clients c on c.id = m.client_id where m.affiliate_id = v_aff.id), '[]'::jsonb)),
      'claims', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'reward', reward_snapshot, 'lbs', target_snapshot_lbs, 'status', status, 'created_at', created_at) order by created_at desc)
                          from reward_claims where participant_affiliate_id = v_aff.id and campaign_id = v_campaign.id), '[]'::jsonb));
  elsif not v_sponsored then
    v_out := v_out || jsonb_build_object(
      'balances', challenge_balances(v_campaign.id, v_client.id, null),
      'claims', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'reward', reward_snapshot, 'lbs', target_snapshot_lbs, 'status', status, 'created_at', created_at) order by created_at desc)
                          from reward_claims where participant_client_id = v_client.id and campaign_id = v_campaign.id), '[]'::jsonb));
  end if;
  return v_out;
end $$;

-- Réclamation : un affilié non validé réclame sur son solde de client.
create or replace function public.challenge_claim(p_reward_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_client clients%rowtype;
  v_aff uuid;
  v_is_affiliate boolean;
  v_reward challenge_rewards%rowtype;
  v_campaign challenge_campaigns%rowtype;
  v_available numeric;
  v_claim uuid;
begin
  select * into v_client from clients where auth_user_id = auth.uid() limit 1;
  if v_client.id is null then raise exception 'Compte client introuvable.'; end if;
  select * into v_reward from challenge_rewards where id = p_reward_id and active;
  if v_reward.id is null then raise exception 'Récompense indisponible.'; end if;
  select * into v_campaign from challenge_campaigns where id = v_reward.campaign_id;
  if v_campaign.status <> 'active' or v_campaign.start_at > now() then raise exception 'Le challenge n''est pas actif.'; end if;

  select id into v_aff from affiliates where client_id = v_client.id and status = 'active';
  v_is_affiliate := v_aff is not null;
  if v_aff is not null and not challenge_affiliate_enrolled(v_campaign.id, v_aff) then v_aff := null; end if;
  if not v_is_affiliate and exists (select 1 from referral_memberships m join affiliates a on a.id = m.affiliate_id
                                    where m.client_id = v_client.id and m.ended_at is null and a.status = 'active'
                                      and challenge_affiliate_enrolled(v_campaign.id, a.id)) then
    raise exception 'Vos livres sont attribués à votre parrain : vous ne pouvez pas réclamer de récompense.';
  end if;

  perform pg_advisory_xact_lock(hashtext('challenge-participant:' || coalesce(v_aff::text, v_client.id::text)));
  if not v_campaign.allow_repeat_wins and exists (
      select 1 from reward_claims where campaign_id = v_campaign.id and status <> 'rejected'
        and ((v_aff is not null and participant_affiliate_id = v_aff) or (v_aff is null and participant_client_id = v_client.id))) then
    raise exception 'Vous avez déjà une récompense pour ce challenge.';
  end if;
  select (challenge_balances(v_campaign.id, case when v_aff is null then v_client.id end, v_aff) ->> 'available')::numeric into v_available;
  if v_available < v_reward.target_lbs then
    raise exception 'Solde insuffisant : % lb disponibles, % lb nécessaires.', v_available, v_reward.target_lbs;
  end if;

  insert into reward_claims (campaign_id, reward_id, participant_client_id, participant_affiliate_id, target_snapshot_lbs, reward_snapshot)
  values (v_campaign.id, v_reward.id, case when v_aff is null then v_client.id end, v_aff, v_reward.target_lbs, v_reward.model)
  returning id into v_claim;
  insert into challenge_ledger (campaign_id, claim_id, participant_client_id, participant_affiliate_id, lbs_delta, kind, source_event_id, rule, reason, actor)
  values (v_campaign.id, v_claim, case when v_aff is null then v_client.id end, v_aff, -v_reward.target_lbs, 'reserve',
          'reserve:' || v_claim, 'reclamation', 'Réservation pour ' || v_reward.model, coalesce(v_client.customer_code, 'client'));
  insert into journal (user_name, action, details, package_ref, customer_code)
  values (coalesce(v_client.customer_code, ''), 'Challenge : demande de récompense', v_reward.model || ' · ' || v_reward.target_lbs || ' lb réservées', '', coalesce(v_client.customer_code, ''));
  return jsonb_build_object('claim_id', v_claim, 'reserved', v_reward.target_lbs, 'remaining', v_available - v_reward.target_lbs);
end $$;

-- L'affilié connecté (espace client) demande à participer.
create or replace function public.challenge_request_enrollment()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_client clients%rowtype; v_aff uuid; v_campaign uuid; v_status text;
begin
  select * into v_client from clients where auth_user_id = auth.uid() limit 1;
  if v_client.id is null then raise exception 'Compte client introuvable.'; end if;
  select id into v_aff from affiliates where client_id = v_client.id and status = 'active';
  if v_aff is null then raise exception 'Seuls les affiliés STANDA peuvent faire cette demande.'; end if;
  v_campaign := challenge_enrollment_campaign();
  if v_campaign is null then raise exception 'Aucun challenge ouvert.'; end if;
  insert into challenge_affiliate_enrollments (campaign_id, affiliate_id, status, requested_by)
  values (v_campaign, v_aff, 'pending', coalesce(v_client.customer_code, ''))
  on conflict (campaign_id, affiliate_id) do update
    set status = 'pending', requested_at = now(), requested_by = excluded.requested_by, decided_at = null, decided_by = ''
    where challenge_affiliate_enrollments.status = 'rejected';
  select status into v_status from challenge_affiliate_enrollments where campaign_id = v_campaign and affiliate_id = v_aff;
  insert into journal (user_name, action, details, package_ref, customer_code)
  values (coalesce(v_client.customer_code, ''), 'Challenge : demande de participation affilié', coalesce(v_status, ''), '', coalesce(v_client.customer_code, ''));
  return jsonb_build_object('status', v_status);
end $$;

-- L'admin valide, refuse, ou retire un affilié (retrait impossible s'il a déjà des livres).
create or replace function public.challenge_decide_enrollment(p_affiliate_id uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_campaign uuid; v_admin text; v_code text;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Accès administrateur requis.'; end if;
  v_admin := challenge_admin_name();
  v_campaign := challenge_enrollment_campaign();
  if v_campaign is null then raise exception 'Aucun challenge ouvert.'; end if;
  select code into v_code from affiliates where id = p_affiliate_id;
  if v_code is null then raise exception 'Affilié introuvable.'; end if;
  if p_action in ('approve', 'reject') then
    insert into challenge_affiliate_enrollments (campaign_id, affiliate_id, status, requested_by, decided_at, decided_by)
    values (v_campaign, p_affiliate_id, case when p_action = 'approve' then 'approved' else 'rejected' end, v_admin, now(), v_admin)
    on conflict (campaign_id, affiliate_id) do update
      set status = excluded.status, decided_at = now(), decided_by = v_admin;
    if p_action = 'reject' and exists (select 1 from challenge_ledger where campaign_id = v_campaign and participant_affiliate_id = p_affiliate_id) then
      raise exception 'Cet affilié a déjà des livres dans le challenge : il ne peut plus être refusé.';
    end if;
  elsif p_action = 'remove' then
    if exists (select 1 from challenge_ledger where campaign_id = v_campaign and participant_affiliate_id = p_affiliate_id) then
      raise exception 'Cet affilié a déjà des livres dans le challenge : il ne peut plus être retiré.';
    end if;
    delete from challenge_affiliate_enrollments where campaign_id = v_campaign and affiliate_id = p_affiliate_id;
  else raise exception 'Action inconnue.';
  end if;
  insert into journal (user_name, action, details, package_ref, customer_code)
  values (v_admin, 'Challenge : participation affilié ' || p_action, v_code, '', '');
  return jsonb_build_object('ok', true);
end $$;

-- Console admin : + la liste des affiliés et leur participation.
create or replace function public.challenge_admin_overview(p_campaign uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Accès administrateur requis.'; end if;
  return jsonb_build_object(
    'participants', coalesce((select jsonb_agg(row_to_json(t) order by t.available desc) from (
      select coalesce(c.customer_code, a.code) as code,
             coalesce(trim(coalesce(c.fullname, '') || ' ' || coalesce(c.surname, '')), a.fullname) as name,
             case when l.participant_affiliate_id is not null then 'affilié' else 'client' end as type,
             sum(l.lbs_delta) filter (where l.kind in ('credit', 'reversal', 'adjustment')) as validated,
             sum(l.lbs_delta) as available,
             count(distinct l.package_id) filter (where l.kind = 'credit') as packages
      from challenge_ledger l
      left join clients c on c.id = l.participant_client_id
      left join affiliates a on a.id = l.participant_affiliate_id
      where l.campaign_id = p_campaign
      group by 1, 2, 3) t), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'reward', r.reward_snapshot, 'lbs', r.target_snapshot_lbs, 'status', r.status,
        'participant', coalesce(c.customer_code, a.code), 'name', coalesce(trim(coalesce(c.fullname, '') || ' ' || coalesce(c.surname, '')), a.fullname),
        'price_paid', r.price_paid, 'created_at', r.created_at, 'decided_by', r.decided_by) order by r.created_at desc)
      from reward_claims r left join clients c on c.id = r.participant_client_id left join affiliates a on a.id = r.participant_affiliate_id
      where r.campaign_id = p_campaign), '[]'::jsonb),
    'affiliates', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a.id, 'code', a.code, 'name', a.fullname, 'client_code', c.customer_code,
        'enrollment', coalesce(e.status, 'none'), 'requested_at', e.requested_at, 'decided_by', e.decided_by,
        'referrals', (select count(*) from referral_memberships m where m.affiliate_id = a.id and m.ended_at is null),
        'has_lbs', exists (select 1 from challenge_ledger l where l.campaign_id = p_campaign and l.participant_affiliate_id = a.id))
      order by (e.status = 'pending') desc nulls last, a.fullname)
      from affiliates a
      left join clients c on c.id = a.client_id
      left join challenge_affiliate_enrollments e on e.affiliate_id = a.id and e.campaign_id = p_campaign
      where a.status = 'active'), '[]'::jsonb)
  );
end $$;

revoke all on function public.challenge_enrollment_campaign() from public, anon, authenticated;
revoke all on function public.challenge_affiliate_enrolled(uuid, uuid) from public, anon, authenticated;
revoke all on function public.challenge_beneficiary_for(uuid, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.challenge_request_enrollment() from public, anon;
revoke all on function public.challenge_decide_enrollment(uuid, text) from public, anon;
grant execute on function public.challenge_request_enrollment(), public.challenge_decide_enrollment(uuid, text) to authenticated;

commit;
