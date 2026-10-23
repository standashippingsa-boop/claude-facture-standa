-- STANDA COMMERCIAL — BON DE REMISE POU CHAK CONDUCE, SAN EKSEPSYON
-- ═══════════════════════════════════════════════════════════════════
-- Pwoblèm (23 oct.): Conduce 15448 + 15640 antre, men bon yo kreye pou 15448
-- sèlman. Enpòtasyon Excel la fèt nan navigatè a; si paj la kite anvan dènye
-- etap la, koli yo lye ak Conduce a men bon an pa janm kreye, epi ajan an pa
-- resevwa notifikasyon. Ansyen pwogram 10 minit lan te tann 1 è.
--
-- Solisyon (baz done a, pa navigatè a):
--  1) packages.conduce_linked_at: lè yon koli antre nan yon Conduce.
--  2) create_bons_for_ready_conduces(): chak 2 minit, POU CHAK Conduce ki gen
--     koli san bon (enpòtasyon fini depi 90 s), kreye bon yo pa vil — menm règ
--     ak create_bons_remise_for_conduce.
--  3) bons_remise.push_sent_at + /api/bons-push: notifikasyon telefòn pou chak
--     bon ki poko voye (pg_net rele sit la ak yon kle prive).

alter table public.packages add column if not exists conduce_linked_at timestamptz;
alter table public.bons_remise add column if not exists push_sent_at timestamptz;
-- Ansyen bon yo: pa re-voye notifikasyon.
update public.bons_remise set push_sent_at = created_at where push_sent_at is null;

create or replace function public.packages_track_conduce_link()
returns trigger language plpgsql as $$
begin
  if new.conduce_id is not null and (tg_op = 'INSERT' or new.conduce_id is distinct from old.conduce_id) then
    new.conduce_linked_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists trg_packages_conduce_linked_at on public.packages;
create trigger trg_packages_conduce_linked_at before insert or update of conduce_id on public.packages
  for each row execute function public.packages_track_conduce_link();

-- Lojik kreyasyon an, san kontwòl wòl (rele pa fonksyon piblik la oswa pa pg_cron).
create or replace function public.create_bons_remise_for_conduce_internal(p_conduce_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_central text;
  v_city record;
  v_bon uuid;
  v_number text;
  v_out jsonb := '[]'::jsonb;
begin
  if p_conduce_id is null then return v_out; end if;
  perform pg_advisory_xact_lock(hashtext('auto_create_bons_remise'));

  select upper(trim(coalesce(value, ''))) into v_central from app_settings where key = 'central_account_code';
  v_central := coalesce(v_central, '');

  for v_city in
    select v.name as ville_name, array_agg(p.id) as package_ids, count(*)::int as package_count
    from packages p
    join clients cl on cl.customer_code = p.customer_code
    join villes v on v.id = cl.ville_id
    where p.conduce_id = p_conduce_id
      and p.bon_remise_id is null
      and coalesce(p.archived, false) = false
      and p.status <> 'Livré'
      and (v_central = '' or upper(trim(coalesce(p.customer_code, ''))) <> v_central)
    group by v.name
    order by v.name
  loop
    v_number := 'BR-' || right((extract(epoch from clock_timestamp()) * 1000)::bigint::text, 8)
      || '-' || upper(substr(md5(random()::text), 1, 6));
    insert into bons_remise (bon_number, destination, package_count, conduce_count, created_by)
    values (v_number, v_city.ville_name, v_city.package_count, 1, 'Système (import Conduce)')
    returning id into v_bon;

    update packages set bon_remise_id = v_bon
    where id = any(v_city.package_ids) and bon_remise_id is null;

    insert into bon_remise_conduces (bon_remise_id, conduce_id) values (v_bon, p_conduce_id)
    on conflict do nothing;

    v_out := v_out || jsonb_build_object('id', v_bon, 'bon_number', v_number,
      'destination', v_city.ville_name, 'package_count', v_city.package_count);
  end loop;

  if jsonb_array_length(v_out) > 0 then
    insert into journal (user_name, action, details, package_ref, customer_code)
    select 'Système', 'Bon de remise automatique',
      jsonb_array_length(v_out) || ' Bon(s) de remise créé(s) pour la Conduce ' || c.conduce_number || ', un par ville', '', ''
    from conduces c where c.id = p_conduce_id;
  end if;
  return v_out;
end;
$$;
revoke all on function public.create_bons_remise_for_conduce_internal(uuid) from public, anon, authenticated;

-- Fonksyon piblik la (navigatè admin / ekstansyon) : menm kontwòl ak anvan.
create or replace function public.create_bons_remise_for_conduce(p_conduce_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (coalesce(auth.role(), '') = 'service_role' or coalesce(public.is_staff(), false)) then
    raise exception 'Accès refusé';
  end if;
  return public.create_bons_remise_for_conduce_internal(p_conduce_id);
end;
$$;
revoke all on function public.create_bons_remise_for_conduce(uuid) from public, anon;
grant execute on function public.create_bons_remise_for_conduce(uuid) to authenticated, service_role;

-- Filè sekirite: chak Conduce ki gen koli san bon (enpòtasyon fini depi 90 s).
create or replace function public.create_bons_for_ready_conduces()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz;
  v_central text;
  v_conduce uuid;
  v_created integer := 0;
begin
  select value::timestamptz into v_since from app_settings where key = 'auto_bon_remise_since';
  if v_since is null then return 0; end if;
  select upper(trim(coalesce(value, ''))) into v_central from app_settings where key = 'central_account_code';
  v_central := coalesce(v_central, '');

  for v_conduce in
    select c.id
    from conduces c
    join packages p on p.conduce_id = c.id
    join clients cl on cl.customer_code = p.customer_code and cl.ville_id is not null
    where c.created_at >= v_since
      and c.created_at > now() - interval '30 days'
      and p.bon_remise_id is null
      and coalesce(p.archived, false) = false
      and p.status <> 'Livré'
      and (v_central = '' or upper(trim(coalesce(p.customer_code, ''))) <> v_central)
    group by c.id
    having max(coalesce(p.conduce_linked_at, c.created_at)) < now() - interval '90 seconds'
  loop
    v_created := v_created + jsonb_array_length(public.create_bons_remise_for_conduce_internal(v_conduce));
  end loop;
  return v_created;
end;
$$;
revoke all on function public.create_bons_for_ready_conduces() from public, anon, authenticated;

-- Kle prive pou pg_cron -> /api/bons-push (pa gen okenn policy: kle sèvis sèlman).
create table if not exists public.internal_secrets (key text primary key, value text not null);
alter table public.internal_secrets enable row level security;
insert into public.internal_secrets (key, value)
values ('bons_push_secret', md5(random()::text || clock_timestamp()::text) || md5(random()::text))
on conflict (key) do nothing;

create extension if not exists pg_net;

create or replace function public.bons_remise_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_secret text;
begin
  perform public.create_bons_for_ready_conduces();
  if exists (select 1 from bons_remise where push_sent_at is null and created_at > now() - interval '2 days'
             and created_at < now() - interval '60 seconds') then
    select value into v_secret from internal_secrets where key = 'bons_push_secret';
    perform net.http_post(
      url := 'https://www.standacommercialsa.com/api/bons-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-bons-secret', v_secret),
      body := '{}'::jsonb
    );
  end if;
end;
$$;
revoke all on function public.bons_remise_tick() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'bons-remise-per-conduce';
select cron.schedule('bons-remise-per-conduce', '*/2 * * * *', 'select public.bons_remise_tick();');
