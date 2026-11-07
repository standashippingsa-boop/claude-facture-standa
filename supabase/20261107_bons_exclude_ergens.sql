-- STANDA COMMERCIAL · PA GEN BON DE REMISE OTOMATIK POU KLIYAN ERGENS
-- ═══════════════════════════════════════════════════════════════════
-- Kliyan Ergens yo (kont Dokasav, Blic Express ak kliyan Dokasav yo) pa pase
-- nan pwen retrè STANDA yo : sistèm nan pa dwe kreye bon de remise pou koli yo.
-- Rekonèt pa kòd ki nan Paramètres (app_settings.mcpack_ergens_codes : dokasav + blic)
-- oswa pa non de kont prensipal yo (menm règ ak lib/invoice-brand.ts).

create or replace function public.is_ergens_customer(p_code text, p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_codes jsonb;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g'));
begin
  if coalesce(p_name, '') ~* 'doka\s*-?\s*sav' or coalesce(p_name, '') ~* 'blic\s*express' then
    return true;
  end if;
  if v_code = '' then return false; end if;
  select value::jsonb into v_codes from app_settings where key = 'mcpack_ergens_codes';
  if v_codes is null then return false; end if;
  return exists (
    select 1 from jsonb_array_elements_text(coalesce(v_codes->'dokasav', '[]'::jsonb) || coalesce(v_codes->'blic', '[]'::jsonb)) as c(code)
    where upper(c.code) = v_code
  );
exception when others then
  return false;
end;
$$;
revoke all on function public.is_ergens_customer(text, text) from public, anon;
grant execute on function public.is_ergens_customer(text, text) to authenticated, service_role;

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
      and not public.is_ergens_customer(p.customer_code, p.customer_name)
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
      and not public.is_ergens_customer(p.customer_code, p.customer_name)
    group by c.id
    having max(coalesce(p.conduce_linked_at, c.created_at)) < now() - interval '90 seconds'
  loop
    v_created := v_created + jsonb_array_length(public.create_bons_remise_for_conduce_internal(v_conduce));
  end loop;
  return v_created;
end;
$$;
revoke all on function public.create_bons_for_ready_conduces() from public, anon, authenticated;
