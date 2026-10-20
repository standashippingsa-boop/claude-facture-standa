-- ═══════════════════════════════════════════════════════════════════════════
-- STANDA — CHALLENGE DE NOËL & Affiliate Management (cahier des charges v1.0)
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration NON DESTRUCTIVE : nouvelles tables et colonnes uniquement.
--  • affiliates.client_id         : un affilié peut être (ou devenir) un client
--  • referral_memberships         : rattachement client → affilié daté (début/fin)
--  • challenge_campaigns/rewards  : campagne et barème configurables (admin)
--  • challenge_ledger             : grand livre IMMUABLE des livres (crédit,
--                                   contre-écriture, réservation, restitution)
--  • reward_claims                : demandes de récompense
-- Événement de qualification : un colis passe à « Livré » (le système exige le
-- paiement complet avant toute remise, donc Livré = payé + livré).
-- Les clients n'accèdent jamais directement aux tables : uniquement via des
-- fonctions SECURITY DEFINER qui déduisent l'identité de auth.uid().
-- Rollback : désactiver le trigger trg_challenge_package_delivered, réactiver
-- trg_affiliate_commission ; les tables peuvent rester (aucune donnée existante
-- n'est modifiée hormis la création des rattachements depuis referred_by).

-- ── 1. Affilié ↔ client ──────────────────────────────────────────────────
alter table public.affiliates
  add column if not exists client_id uuid unique references public.clients(id) on delete set null,
  add column if not exists activated_at timestamptz,
  add column if not exists approved_by text;

-- ── 2. Rattachements datés ───────────────────────────────────────────────
create table if not exists public.referral_memberships (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  source_code text not null default '',
  created_by text not null default '',
  end_reason text not null default '',
  check (ended_at is null or ended_at >= started_at)
);
create unique index if not exists referral_memberships_one_active on public.referral_memberships(client_id) where ended_at is null;
create index if not exists referral_memberships_affiliate on public.referral_memberships(affiliate_id);
alter table public.referral_memberships enable row level security;
create policy referral_memberships_admin_read on public.referral_memberships for select to authenticated using (coalesce(public.is_admin(), false));

-- Reprise des parrainages existants (clients.referred_by_affiliate_id).
insert into public.referral_memberships (client_id, affiliate_id, started_at, source_code, created_by)
select c.id, c.referred_by_affiliate_id, c.created_at, coalesce(a.code, ''), 'migration'
from public.clients c join public.affiliates a on a.id = c.referred_by_affiliate_id
where c.referred_by_affiliate_id is not null
  and not exists (select 1 from public.referral_memberships m where m.client_id = c.id);

-- Nouvelle inscription via lien ?ref= : le rattachement daté est créé automatiquement.
create or replace function public.challenge_membership_on_client()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.referred_by_affiliate_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.referred_by_affiliate_id is not distinct from old.referred_by_affiliate_id then return new; end if;
  -- Interdits : auto-parrainage, client déjà rattaché (pas de substitution de parrain).
  if exists (select 1 from affiliates a where a.id = new.referred_by_affiliate_id and a.client_id = new.id) then return new; end if;
  if exists (select 1 from referral_memberships m where m.client_id = new.id and m.ended_at is null) then return new; end if;
  insert into referral_memberships (client_id, affiliate_id, source_code, created_by)
  select new.id, a.id, a.code, 'inscription' from affiliates a where a.id = new.referred_by_affiliate_id and a.status = 'active';
  return new;
end $$;
drop trigger if exists trg_challenge_membership on public.clients;
create trigger trg_challenge_membership after insert or update of referred_by_affiliate_id on public.clients
  for each row execute function public.challenge_membership_on_client();

-- ── 3. Campagne et barème ────────────────────────────────────────────────
create table if not exists public.challenge_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  allow_repeat_wins boolean not null default false,
  rules_version text not null default '1.0',
  created_at timestamptz not null default now(),
  check (end_at is null or end_at > start_at)
);
create table if not exists public.challenge_rewards (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.challenge_campaigns(id) on delete cascade,
  model text not null,
  target_lbs numeric(12,2) not null check (target_lbs > 0),
  max_budget_usd numeric(12,2) not null default 0 check (max_budget_usd >= 0),
  condition text not null default '',
  active boolean not null default true,
  sort_order int not null default 0
);
alter table public.challenge_campaigns enable row level security;
alter table public.challenge_rewards enable row level security;
create policy challenge_campaigns_admin_read on public.challenge_campaigns for select to authenticated using (coalesce(public.is_admin(), false));
create policy challenge_rewards_admin_read on public.challenge_rewards for select to authenticated using (coalesce(public.is_admin(), false));

-- ── 4. Grand livre et demandes ───────────────────────────────────────────
create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.challenge_campaigns(id),
  reward_id uuid not null references public.challenge_rewards(id),
  participant_client_id uuid references public.clients(id),
  participant_affiliate_id uuid references public.affiliates(id),
  target_snapshot_lbs numeric(12,2) not null,
  reward_snapshot text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'delivered')),
  price_paid numeric(12,2),
  delivery_proof text not null default '',
  decided_by text not null default '',
  decided_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(participant_client_id, participant_affiliate_id) = 1)
);
create table if not exists public.challenge_ledger (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.challenge_campaigns(id),
  package_id uuid references public.packages(id) on delete set null,
  claim_id uuid references public.reward_claims(id),
  participant_client_id uuid references public.clients(id),
  participant_affiliate_id uuid references public.affiliates(id),
  lbs_delta numeric(12,2) not null,
  kind text not null check (kind in ('credit', 'reversal', 'reserve', 'release', 'adjustment')),
  source_event_id text not null unique,
  rule text not null default '',
  reason text not null default '',
  actor text not null default 'system',
  occurred_at timestamptz not null default now(),
  check (num_nonnulls(participant_client_id, participant_affiliate_id) = 1)
);
create index if not exists challenge_ledger_client on public.challenge_ledger(campaign_id, participant_client_id);
create index if not exists challenge_ledger_affiliate on public.challenge_ledger(campaign_id, participant_affiliate_id);
create index if not exists challenge_ledger_package on public.challenge_ledger(package_id);
alter table public.challenge_ledger enable row level security;
alter table public.reward_claims enable row level security;
create policy challenge_ledger_admin_read on public.challenge_ledger for select to authenticated using (coalesce(public.is_admin(), false));
create policy reward_claims_admin_read on public.reward_claims for select to authenticated using (coalesce(public.is_admin(), false));
-- Immuable : aucune mise à jour ni suppression, même par un admin connecté.
create or replace function public.challenge_ledger_immutable() returns trigger language plpgsql as $$
begin
  -- Seule exception : la suppression définitive d'un colis détache l'écriture (package_id → null), sans toucher au montant.
  if tg_op = 'UPDATE' and old.package_id is not null and new.package_id is null
     and new.lbs_delta = old.lbs_delta and new.kind = old.kind and new.source_event_id = old.source_event_id
     and new.participant_client_id is not distinct from old.participant_client_id
     and new.participant_affiliate_id is not distinct from old.participant_affiliate_id then
    return new;
  end if;
  raise exception 'Le grand livre du challenge est immuable : utilisez une contre-écriture.';
end $$;
drop trigger if exists trg_challenge_ledger_immutable on public.challenge_ledger;
create trigger trg_challenge_ledger_immutable before update or delete on public.challenge_ledger
  for each row execute function public.challenge_ledger_immutable();

-- ── 5. Bénéficiaire d'un colis (au moment de la qualification) ───────────
-- 1) le client est lui-même affilié actif → l'affilié ; 2) rattaché à un
-- affilié actif → le parrain ; 3) sinon → le client. Jamais multiniveau.
create or replace function public.challenge_beneficiary(p_client_id uuid, p_at timestamptz)
returns table (client_id uuid, affiliate_id uuid) language sql stable security definer set search_path = public as $$
  select null::uuid, a.id from affiliates a
   where a.client_id = p_client_id and a.status = 'active' and coalesce(a.activated_at, a.created_at) <= p_at
  union all
  select null::uuid, m.affiliate_id from referral_memberships m join affiliates a on a.id = m.affiliate_id
   where m.client_id = p_client_id and m.started_at <= p_at and (m.ended_at is null or m.ended_at > p_at) and a.status = 'active'
     and not exists (select 1 from affiliates s where s.client_id = p_client_id and s.status = 'active' and coalesce(s.activated_at, s.created_at) <= p_at)
  union all
  select p_client_id, null::uuid
   where not exists (select 1 from affiliates s where s.client_id = p_client_id and s.status = 'active' and coalesce(s.activated_at, s.created_at) <= p_at)
     and not exists (select 1 from referral_memberships m join affiliates a on a.id = m.affiliate_id
                     where m.client_id = p_client_id and m.started_at <= p_at and (m.ended_at is null or m.ended_at > p_at) and a.status = 'active')
  limit 1
$$;

-- ── 6. Qualification d'un colis (trigger) ────────────────────────────────
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
  -- Rien à faire si le colis n'entre ni ne sort du statut « Livré ».
  if not ((new.status = 'Livré') is distinct from (old.status = 'Livré')) then return new; end if;
  select upper(trim(coalesce(value, ''))) into v_central from app_settings where key = 'central_account_code';
  if upper(trim(coalesce(new.customer_code, ''))) = coalesce(v_central, '') then return new; end if;
  select id into v_client from clients where customer_code = new.customer_code limit 1;
  if v_client is null then return new; end if;

  -- Colis qualifié : Livré.
  if new.status = 'Livré' and old.status is distinct from 'Livré' then
    v_at := coalesce(new.delivered_at, now());
    for v_campaign in select * from challenge_campaigns c
      where c.status = 'active' and c.start_at <= v_at and (c.end_at is null or c.end_at > v_at)
    loop
      perform pg_advisory_xact_lock(hashtext('challenge-pkg:' || new.id::text));
      select coalesce(sum(lbs_delta), 0) into v_net from challenge_ledger
        where campaign_id = v_campaign.id and package_id = new.id and kind in ('credit', 'reversal');
      if v_net > 0 or coalesce(new.weight, 0) <= 0 then continue; end if;   -- déjà crédité (idempotence)
      select * into v_benef from challenge_beneficiary(v_client, v_at);
      select count(*) into v_n from challenge_ledger where campaign_id = v_campaign.id and package_id = new.id and kind = 'credit';
      insert into challenge_ledger (campaign_id, package_id, participant_client_id, participant_affiliate_id, lbs_delta, kind, source_event_id, rule, reason, occurred_at)
      values (v_campaign.id, new.id, v_benef.client_id, v_benef.affiliate_id, round(new.weight::numeric, 2), 'credit',
              'credit:' || v_campaign.id || ':' || new.id || ':' || v_n,
              case when v_benef.affiliate_id is null then 'propre' else 'affilie' end,
              'Colis ' || coalesce(new.tracking_number, '') || ' livré', v_at)
      on conflict (source_event_id) do nothing;
    end loop;
  end if;

  -- Correction : un colis livré revient à un autre statut → contre-écriture.
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
drop trigger if exists trg_challenge_package_delivered on public.packages;
create trigger trg_challenge_package_delivered after update of status on public.packages
  for each row execute function public.challenge_on_package_status();

-- ── 7. Soldes ─────────────────────────────────────────────────────────────
-- validé = crédits − contre-écritures ; réservé = demandes en attente/approuvées ;
-- utilisé = demandes remises ; disponible = somme de toutes les écritures.
create or replace function public.challenge_balances(p_campaign uuid, p_client uuid, p_affiliate uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'validated', coalesce(sum(l.lbs_delta) filter (where l.kind in ('credit', 'reversal', 'adjustment')), 0),
    'reserved', coalesce(sum(-l.lbs_delta) filter (where l.kind in ('reserve', 'release') and c.status in ('pending', 'approved')), 0),
    'used', coalesce(sum(-l.lbs_delta) filter (where l.kind in ('reserve', 'release') and c.status = 'delivered'), 0),
    'available', coalesce(sum(l.lbs_delta), 0)
  )
  from challenge_ledger l left join reward_claims c on c.id = l.claim_id
  where l.campaign_id = p_campaign
    and ((p_client is not null and l.participant_client_id = p_client) or (p_affiliate is not null and l.participant_affiliate_id = p_affiliate))
$$;

create or replace function public.challenge_active_campaign() returns uuid language sql stable security definer set search_path = public as $$
  select id from challenge_campaigns where status = 'active' order by start_at desc limit 1
$$;

-- ── 8. Espace client / affilié : « mon challenge » ───────────────────────
create or replace function public.challenge_me()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_client clients%rowtype;
  v_aff affiliates%rowtype;
  v_sponsor affiliates%rowtype;
  v_campaign challenge_campaigns%rowtype;
  v_shipped numeric;
  v_out jsonb;
begin
  select * into v_client from clients where auth_user_id = auth.uid() limit 1;
  if v_client.id is null then raise exception 'Compte client introuvable.'; end if;
  select * into v_campaign from challenge_campaigns where status = 'active' order by start_at desc limit 1;
  if v_campaign.id is null then return jsonb_build_object('campaign', null); end if;
  select * into v_aff from affiliates where client_id = v_client.id and status = 'active';
  select a.* into v_sponsor from referral_memberships m join affiliates a on a.id = m.affiliate_id
    where m.client_id = v_client.id and m.ended_at is null and a.status = 'active' limit 1;
  select coalesce(sum(weight), 0) into v_shipped from packages
    where customer_code = v_client.customer_code and status = 'Livré'
      and coalesce(delivered_at, created_at) >= v_campaign.start_at and (v_campaign.end_at is null or coalesce(delivered_at, created_at) < v_campaign.end_at);

  v_out := jsonb_build_object(
    'campaign', jsonb_build_object('id', v_campaign.id, 'name', v_campaign.name, 'start_at', v_campaign.start_at, 'end_at', v_campaign.end_at, 'allow_repeat_wins', v_campaign.allow_repeat_wins),
    'rewards', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'model', r.model, 'target_lbs', r.target_lbs, 'condition', r.condition) order by r.sort_order, r.target_lbs)
                         from challenge_rewards r where r.campaign_id = v_campaign.id and r.active), '[]'::jsonb),
    'shipped_lbs', v_shipped,
    'sponsored', v_aff.id is null and v_sponsor.id is not null,
    'is_affiliate', v_aff.id is not null
  );
  if v_aff.id is not null then
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
  elsif v_sponsor.id is null then
    v_out := v_out || jsonb_build_object(
      'balances', challenge_balances(v_campaign.id, v_client.id, null),
      'claims', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'reward', reward_snapshot, 'lbs', target_snapshot_lbs, 'status', status, 'created_at', created_at) order by created_at desc)
                          from reward_claims where participant_client_id = v_client.id and campaign_id = v_campaign.id), '[]'::jsonb));
  end if;
  return v_out;
end $$;

-- ── 9. Réclamation atomique ──────────────────────────────────────────────
create or replace function public.challenge_claim(p_reward_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_client clients%rowtype;
  v_aff uuid;
  v_reward challenge_rewards%rowtype;
  v_campaign challenge_campaigns%rowtype;
  v_available numeric;
  v_claim uuid;
begin
  select * into v_client from clients where auth_user_id = auth.uid() limit 1;
  if v_client.id is null then raise exception 'Compte client introuvable.'; end if;
  select id into v_aff from affiliates where client_id = v_client.id and status = 'active';
  if v_aff is null and exists (select 1 from referral_memberships m join affiliates a on a.id = m.affiliate_id
                                where m.client_id = v_client.id and m.ended_at is null and a.status = 'active') then
    raise exception 'Vos livres sont attribués à votre parrain : vous ne pouvez pas réclamer de récompense.';
  end if;
  select * into v_reward from challenge_rewards where id = p_reward_id and active;
  if v_reward.id is null then raise exception 'Récompense indisponible.'; end if;
  select * into v_campaign from challenge_campaigns where id = v_reward.campaign_id;
  if v_campaign.status <> 'active' or v_campaign.start_at > now() then raise exception 'Le challenge n''est pas actif.'; end if;

  -- Verrou par participant : deux demandes simultanées ne lisent jamais le même solde.
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

-- ── 10. Administration ───────────────────────────────────────────────────
create or replace function public.challenge_admin_name() returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(coalesce(prenom, '') || ' ' || coalesce(nom, '')), ''), username, 'admin') from staff where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.challenge_decide_claim(p_claim_id uuid, p_action text, p_price numeric default null, p_proof text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_claim reward_claims%rowtype; v_admin text;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Accès administrateur requis.'; end if;
  v_admin := challenge_admin_name();
  select * into v_claim from reward_claims where id = p_claim_id for update;
  if v_claim.id is null then raise exception 'Demande introuvable.'; end if;
  if p_action = 'approve' then
    if v_claim.status <> 'pending' then raise exception 'Seule une demande en attente peut être approuvée.'; end if;
    update reward_claims set status = 'approved', decided_by = v_admin, decided_at = now() where id = v_claim.id;
  elsif p_action = 'reject' then
    if v_claim.status not in ('pending', 'approved') then raise exception 'Cette demande ne peut plus être refusée.'; end if;
    update reward_claims set status = 'rejected', decided_by = v_admin, decided_at = now() where id = v_claim.id;
    insert into challenge_ledger (campaign_id, claim_id, participant_client_id, participant_affiliate_id, lbs_delta, kind, source_event_id, rule, reason, actor)
    values (v_claim.campaign_id, v_claim.id, v_claim.participant_client_id, v_claim.participant_affiliate_id, v_claim.target_snapshot_lbs, 'release',
            'release:' || v_claim.id, 'refus', 'Demande refusée : livres restitués', v_admin);
  elsif p_action = 'deliver' then
    if v_claim.status <> 'approved' then raise exception 'La demande doit être approuvée avant la remise.'; end if;
    update reward_claims set status = 'delivered', price_paid = p_price, delivery_proof = coalesce(p_proof, ''), delivered_at = now(), decided_by = v_admin where id = v_claim.id;
  else raise exception 'Action inconnue.';
  end if;
  insert into journal (user_name, action, details, package_ref, customer_code)
  values (v_admin, 'Challenge : demande ' || p_action, v_claim.reward_snapshot || ' · ' || v_claim.target_snapshot_lbs || ' lb' || coalesce(' · prix ' || p_price || ' USD', ''), '', '');
  return jsonb_build_object('ok', true);
end $$;

-- Promotion client → affilié (transaction atomique).
create or replace function public.challenge_promote_client(p_client_id uuid, p_site text default 'https://www.standacommercialsa.com')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_client clients%rowtype; v_admin text; v_code text; v_aff uuid; v_now timestamptz := now();
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Accès administrateur requis.'; end if;
  v_admin := challenge_admin_name();
  select * into v_client from clients where id = p_client_id for update;
  if v_client.id is null then raise exception 'Client introuvable.'; end if;
  if coalesce(v_client.customer_code, '') = '' then raise exception 'Le client doit avoir un code MC actif.'; end if;
  if exists (select 1 from affiliates where client_id = v_client.id) then raise exception 'Ce client est déjà affilié.'; end if;
  -- Code unique lisible : 6 lettres du nom + 4 chiffres.
  loop
    v_code := upper(left(regexp_replace(coalesce(v_client.fullname, 'STANDA'), '[^A-Za-z]', '', 'g') || 'STANDA', 6)) || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from affiliates where code = v_code);
  end loop;
  insert into affiliates (fullname, email, phone, whatsapp, code, username, password_hash, referral_link, contract_start, contract_end, status, commission_amount, client_id, activated_at, approved_by)
  values (trim(coalesce(v_client.fullname, '') || ' ' || coalesce(v_client.surname, '')), coalesce(nullif(v_client.email, ''), v_client.customer_code || '@client.standa'),
          coalesce(v_client.phone, ''), coalesce(v_client.whatsapp, ''), v_code, 'client:' || v_client.customer_code, '!connexion-espace-client',
          p_site || '/inscription?ref=' || v_code, v_now::date, (v_now + interval '1 year')::date, 'active', 0, v_client.id, v_now, v_admin)
  returning id into v_aff;
  -- Le client quitte le réseau de son ancien parrain à cet instant précis.
  update referral_memberships set ended_at = v_now, end_reason = 'Promotion en affilié' where client_id = v_client.id and ended_at is null;
  insert into journal (user_name, action, details, package_ref, customer_code)
  values (v_admin, 'Challenge : client promu affilié', v_client.customer_code || ' · code ' || v_code, '', v_client.customer_code);
  return jsonb_build_object('affiliate_id', v_aff, 'code', v_code);
end $$;

-- Associer un affilié existant (portail affilié) à son compte client.
create or replace function public.challenge_link_affiliate_client(p_affiliate_id uuid, p_client_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_client uuid; v_admin text;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Accès administrateur requis.'; end if;
  v_admin := challenge_admin_name();
  select id into v_client from clients where customer_code = upper(trim(p_client_code));
  if v_client is null then raise exception 'Code client introuvable.'; end if;
  if exists (select 1 from affiliates where client_id = v_client and id <> p_affiliate_id) then raise exception 'Ce client est déjà lié à un autre affilié.'; end if;
  update affiliates set client_id = v_client, activated_at = coalesce(activated_at, now()), approved_by = coalesce(approved_by, v_admin) where id = p_affiliate_id;
  update referral_memberships set ended_at = now(), end_reason = 'Devenu affilié' where client_id = v_client and ended_at is null;
  insert into journal (user_name, action, details, package_ref, customer_code) values (v_admin, 'Challenge : affilié lié à un client', upper(trim(p_client_code)), '', upper(trim(p_client_code)));
  return jsonb_build_object('ok', true);
end $$;

-- Tableau admin : participants et soldes.
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
      where r.campaign_id = p_campaign), '[]'::jsonb)
  );
end $$;

revoke all on function public.challenge_beneficiary(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.challenge_balances(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.challenge_on_package_status() from public, anon, authenticated;
revoke all on function public.challenge_membership_on_client() from public, anon, authenticated;
revoke all on function public.challenge_admin_name() from public, anon, authenticated;
revoke all on function public.challenge_me() from public, anon;
revoke all on function public.challenge_claim(uuid) from public, anon;
revoke all on function public.challenge_decide_claim(uuid, text, numeric, text) from public, anon;
revoke all on function public.challenge_promote_client(uuid, text) from public, anon;
revoke all on function public.challenge_link_affiliate_client(uuid, text) from public, anon;
revoke all on function public.challenge_admin_overview(uuid) from public, anon;
grant execute on function public.challenge_me(), public.challenge_claim(uuid), public.challenge_decide_claim(uuid, text, numeric, text),
  public.challenge_promote_client(uuid, text), public.challenge_link_affiliate_client(uuid, text), public.challenge_admin_overview(uuid) to authenticated;

-- ── 11. Commissions en dollars : arrêtées (décision du 20/10/2026) ────────
alter table public.invoices disable trigger trg_affiliate_commission;

-- ── 12. Campagne de départ (BROUILLON : rien n'est public) ────────────────
insert into public.challenge_campaigns (name, start_at, end_at, status)
select 'CHALLENGE DE NOËL', '2026-11-05 00:00:00-05', '2027-01-05 23:59:59-05', 'draft'
where not exists (select 1 from public.challenge_campaigns);
insert into public.challenge_rewards (campaign_id, model, target_lbs, max_budget_usd, sort_order)
select c.id, r.model, r.lbs, r.budget, r.ord from public.challenge_campaigns c
cross join (values ('iPhone 14 Pro Max', 1900, 550, 1), ('iPhone 15 Pro Max', 2000, 650, 2), ('iPhone 16 Pro Max', 2300, 855, 3), ('iPhone 17 Pro Max', 3000, 1349, 4)) as r(model, lbs, budget, ord)
where not exists (select 1 from public.challenge_rewards);

-- ── 13. L'administrateur configure la campagne et le barème depuis /challenge ──
create policy challenge_campaigns_admin_write on public.challenge_campaigns for update to authenticated
  using (coalesce(public.is_admin(), false)) with check (coalesce(public.is_admin(), false));
create policy challenge_rewards_admin_insert on public.challenge_rewards for insert to authenticated
  with check (coalesce(public.is_admin(), false));
create policy challenge_rewards_admin_update on public.challenge_rewards for update to authenticated
  using (coalesce(public.is_admin(), false)) with check (coalesce(public.is_admin(), false));
