-- STANDA COMMERCIAL — 2 règ metye
-- ═══════════════════════════════════════════════════════════════════
-- 1) BON DE REMISE TOUSWIT APRE IMPÒTASYON KOLI YON CONDUCE
--    Depi koli yo antre nan yon Conduce (fichye Excel oswa ekstansyon), sistèm
--    nan kreye YON Bon de remise PA VIL pou koli Conduce sa a ki poko sou yon
--    bon. Menm règ ak bon otomatik la (20261013_auto_bons_remise.sql):
--      • kont santral la pa janm antre (bon pa l fèt lè fakti a kreye);
--      • yon koli Livré, achive, oswa ki deja sou yon bon pa touche;
--      • yon kliyan san vil pa antre (bon alamen).
--    Pwogram otomatik ki kouri chak 10 minit la rete kòm filè sekirite.
-- 2) "Arrivé en Haïti" -> "En route vers agence" apre 24 è.

create or replace function public.create_bons_remise_for_conduce(p_conduce_id uuid)
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
  -- Pèsonèl STANDA oswa sèvè a (kle sèvis) sèlman.
  if not (coalesce(auth.role(), '') = 'service_role' or coalesce(public.is_staff(), false)) then
    raise exception 'Accès refusé';
  end if;
  if p_conduce_id is null then return v_out; end if;
  -- Menm verou ak bon otomatik la: de kreyasyon pa ka pran menm koli yo.
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

revoke all on function public.create_bons_remise_for_conduce(uuid) from public, anon;
grant execute on function public.create_bons_remise_for_conduce(uuid) to authenticated, service_role;

create or replace function public.advance_package_statuses()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n1 int;
  n2 int;
  n3 int;
begin
  update public.packages
  set status = 'En préparation'
  where status = 'Reçu à Miami'
    and archived = false
    and invoice_id is null
    and status_changed_at <= now() - interval '24 hours';
  get diagnostics n1 = row_count;

  update public.packages
  set status = 'En transit'
  where status = 'En préparation'
    and archived = false
    and invoice_id is null
    and status_changed_at <= now() - interval '24 hours';
  get diagnostics n2 = row_count;

  -- "En transit" -> "Arrivé en Haïti" : PAS ICI, rôle du Conduce uniquement.

  -- "Arrivé en Haïti" -> "En route vers agence" : 24 h après l'arrivée.
  update public.packages
  set status = 'En route vers agence'
  where status = 'Arrivé en Haïti'
    and archived = false
    and invoice_id is null
    and status_changed_at <= now() - interval '24 hours';
  get diagnostics n3 = row_count;

  if n1 > 0 or n2 > 0 or n3 > 0 then
    insert into public.journal (user_name, action, details, package_ref, customer_code)
    values (
      'Système (auto)',
      'Progression automatique statut',
      format('%s colis "Reçu à Miami" -> "En préparation" | %s colis "En préparation" -> "En transit" | %s colis "Arrivé en Haïti" -> "En route vers agence" (24h écoulées)', n1, n2, n3),
      '', ''
    );
  end if;
end;
$function$;
