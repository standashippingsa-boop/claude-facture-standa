-- STANDA COMMERCIAL — BON DE REMISE OTOMATIK
-- ═══════════════════════════════════════════════════════════════════
-- Règ metye:
--   • Chak fwa yo antre kèk nimewo Conduce, sistèm nan TANN 1 È apre DÈNYE
--     Conduce ki antre a, epi li kreye YON Bon de remise PA VIL pou tout
--     koli Conduce sa yo (vil = vil kliyan an).
--   • KONT SANTRAL la (app_settings.central_account_code) PA janm antre nan
--     bon otomatik yo: bon pa l fèt lè fakti a kreye, sou vil fakti a
--     (gade components/InvoiceDialog.tsx).
--   • Sèlman Conduce ki kreye APRE aktivasyon an konte — okenn ansyen
--     Conduce pa resevwa yon bon pou kont li.
--   • PDF la pa kreye isit la: /api/documents/bon-remise/[id] rekonstwi l
--     depi koli yo lè yon moun ouvri l.
-- Kouri chak 10 minit ak pg_cron (menm mekanis ak advance-package-statuses).

insert into public.app_settings (key, value)
select 'auto_bon_remise_since', now()::text
where not exists (select 1 from public.app_settings where key = 'auto_bon_remise_since');

create or replace function public.auto_create_bons_remise()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz;
  v_central text;
  v_city record;
  v_bon uuid;
  v_created integer := 0;
begin
  -- Yon sèl egzekisyon alafwa: de kouri an menm tan pa ka fè de bon.
  if not pg_try_advisory_xact_lock(hashtext('auto_create_bons_remise')) then
    return 0;
  end if;

  select value::timestamptz into v_since from app_settings where key = 'auto_bon_remise_since';
  if v_since is null then return 0; end if;

  select upper(trim(coalesce(value, ''))) into v_central from app_settings where key = 'central_account_code';
  v_central := coalesce(v_central, '');

  -- Yon Conduce fèk antre (mwens pase 1 è): nou tann, pou tout Conduce ki
  -- antre ansanm yo tonbe sou MENM bon pa vil.
  if exists (select 1 from conduces where created_at > now() - interval '1 hour') then
    return 0;
  end if;

  create temporary table tmp_auto_bon on commit drop as
  select p.id as package_id, p.conduce_id, v.name as ville_name, p.status_changed_at
  from packages p
  join conduces c on c.id = p.conduce_id
  join clients cl on cl.customer_code = p.customer_code
  join villes v on v.id = cl.ville_id
  where c.created_at >= v_since
    and c.created_at > now() - interval '30 days'
    and p.bon_remise_id is null
    and coalesce(p.archived, false) = false
    and p.status <> 'Livré'
    and (v_central = '' or upper(trim(coalesce(p.customer_code, ''))) <> v_central);

  -- Senkronizasyon MCPACK la toujou ap ajoute koli: nou tann li fini.
  if exists (select 1 from tmp_auto_bon where status_changed_at > now() - interval '10 minutes') then
    return 0;
  end if;

  for v_city in
    select ville_name, count(*)::int as package_count, count(distinct conduce_id)::int as conduce_count
    from tmp_auto_bon group by ville_name order by ville_name
  loop
    insert into bons_remise (bon_number, destination, package_count, conduce_count, created_by)
    values (
      'BR-' || right((extract(epoch from clock_timestamp()) * 1000)::bigint::text, 8)
        || '-' || upper(substr(md5(random()::text), 1, 6)),
      v_city.ville_name, v_city.package_count, v_city.conduce_count, 'Système (automatique)'
    )
    returning id into v_bon;

    update packages set bon_remise_id = v_bon
    where id in (select package_id from tmp_auto_bon where ville_name = v_city.ville_name)
      and bon_remise_id is null;

    insert into bon_remise_conduces (bon_remise_id, conduce_id)
    select distinct v_bon, conduce_id from tmp_auto_bon where ville_name = v_city.ville_name;

    v_created := v_created + 1;
  end loop;

  if v_created > 0 then
    insert into journal (user_name, action, details, package_ref, customer_code)
    values ('Système', 'Bon de remise automatique',
      v_created || ' Bon(s) de remise créé(s) automatiquement, un par ville', '', '');
  end if;

  return v_created;
end;
$$;

revoke all on function public.auto_create_bons_remise() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'auto-create-bons-remise';
select cron.schedule('auto-create-bons-remise', '*/10 * * * *', 'select public.auto_create_bons_remise();');
