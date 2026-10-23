-- STANDA COMMERCIAL — IMPÒTASYON EXCEL CONDUCE AN YON SÈL KOU
-- ═══════════════════════════════════════════════════════════════════
-- Pwoblèm (23 oct.): Conduce 15640 = 58 koli nan Excel la, men 22 sèlman te
-- antre. Navigatè a te anrejistre koli yo YOUN PA YOUN (2-3 demann pa koli);
-- si koneksyon an koupe oswa paj la chanje, enpòtasyon an rete mwatye.
--
-- Solisyon: navigatè a voye TOUT liy yo nan YON sèl apèl; baz done a trete
-- yo nan YON sèl tranzaksyon: swa tout koli yo antre, swa anyen pa chanje
-- (epi admin nan wè erè a). 1000 koli oswa plis pase menm jan.
-- Menm règ ak lib/db.ts importConduceExcelRows:
--   • koli ki egziste (pa Guía WR) -> lye ak Conduce a, statut -> "Arrivé en Haïti"
--     sèlman si li pa fakti epi li poko pi lwen; tracking, pwa, kontni, drapo spécial;
--   • koli ki pa egziste -> kreye l "Arrivé en Haïti".
-- Bon de remise yo kreye apre (create_bons_remise_for_conduce + filè 2 minit).

create or replace function public.import_conduce_rows(p_conduce_id uuid, p_rows jsonb, p_who text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_guia text;
  v_pkg record;
  v_meta jsonb;
  v_special boolean;
  v_reason text;
  v_manual boolean;
  v_created int := 0;
  v_updated int := 0;
  v_linked int := 0;
  v_special_count int := 0;
  v_weight numeric := 0;
  v_office text := '';
  v_number text;
  v_promote boolean;
  v_now timestamptz := now();
begin
  if not (coalesce(auth.role(), '') = 'service_role' or coalesce(public.is_staff(), false)) then
    raise exception 'Accès refusé';
  end if;
  select conduce_number into v_number from conduces where id = p_conduce_id;
  if v_number is null then raise exception 'Conduce introuvable'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Liste de colis invalide'; end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_guia := upper(regexp_replace(coalesce(v_row->>'guia', ''), '\s+', '', 'g'));
    if v_guia = '' then continue; end if;
    if v_office = '' then v_office := trim(coalesce(v_row->>'office', '')); end if;
    v_special := coalesce((v_row->>'is_special')::boolean, false);
    v_reason := nullif(trim(coalesce(v_row->>'special_reason', '')), '');
    v_weight := v_weight + coalesce(nullif(v_row->>'weight', '')::numeric, 0);
    if v_special then v_special_count := v_special_count + 1; end if;

    select id, conduce_id, tracking_manual, status, invoice_id, mcpack_data
      into v_pkg from packages where tracking_number = v_guia limit 1;

    if found then
      v_meta := coalesce(v_pkg.mcpack_data, '{}'::jsonb);
      v_manual := (v_meta->>'__standa_special_source') = 'manual';
      v_promote := v_pkg.invoice_id is null
        and coalesce(v_pkg.status, '') <> 'Facturé'
        and coalesce(v_pkg.status, '') not in ('Arrivé en Haïti', 'En route vers agence', 'Disponible', 'Livré');
      if v_special and not v_manual then
        v_meta := v_meta || jsonb_build_object('__standa_special', 'true',
          '__standa_special_reason', coalesce(v_reason, 'Note ADIC. signalée dans la ligne Excel.'),
          '__standa_special_source', 'mcpack');
      elsif not v_special and not v_manual and (v_meta->>'__standa_special') = 'true' then
        v_meta := v_meta - '__standa_special' - '__standa_special_reason' - '__standa_special_source';
      end if;
      if v_pkg.conduce_id is distinct from p_conduce_id then v_linked := v_linked + 1; end if;
      update packages set
        conduce_id = p_conduce_id,
        status = case when v_promote then 'Arrivé en Haïti' else status end,
        tracking_manual = case when coalesce(trim(tracking_manual), '') = '' and coalesce(v_row->>'tracking_number', '') <> ''
                               then v_row->>'tracking_number' else tracking_manual end,
        weight = case when coalesce(nullif(v_row->>'weight', '')::numeric, 0) > 0 then (v_row->>'weight')::numeric else weight end,
        content = case when coalesce(v_row->>'content', '') <> '' then v_row->>'content' else content end,
        mcpack_data = v_meta
      where id = v_pkg.id;
      v_updated := v_updated + 1;
    else
      insert into packages (tracking_number, tracking_manual, customer_code, customer_name, weight, content, quantity,
        status, conduce_id, received_at, received_method, src_extension, mcpack_data)
      values (v_guia, coalesce(v_row->>'tracking_number', ''), coalesce(v_row->>'customer_code', ''),
        coalesce(nullif(v_row->>'customer_name', ''), v_row->>'customer_code', ''),
        coalesce(nullif(v_row->>'weight', '')::numeric, 0), coalesce(v_row->>'content', ''),
        greatest(coalesce(nullif(v_row->>'quantity', '')::numeric, 1), 1),
        'Arrivé en Haïti', p_conduce_id, v_now, 'Import Conduce Excel', true,
        case when v_special then jsonb_build_object('__standa_special', 'true',
          '__standa_special_reason', coalesce(v_reason, 'Note ADIC. signalée dans la ligne Excel.'),
          '__standa_special_source', 'mcpack') else '{}'::jsonb end);
      v_created := v_created + 1;
      v_linked := v_linked + 1;
    end if;
  end loop;

  update conduces set updated_at = v_now, office = case when v_office <> '' then v_office else office end
  where id = p_conduce_id;

  insert into journal (user_name, action, details, package_ref, customer_code)
  values (coalesce(nullif(p_who, ''), 'Admin'), 'Import Conduce · Excel',
    format('Conduce %s : %s créés, %s mis à jour/liés, %s colis dont %s spécial(aux), %s lb — par %s',
      v_number, v_created, v_updated, jsonb_array_length(p_rows), v_special_count, round(v_weight, 2), coalesce(nullif(p_who, ''), 'Admin')),
    '', '');

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'linked', v_linked,
    'special', v_special_count, 'total_weight', v_weight, 'rows', jsonb_array_length(p_rows));
end;
$$;

revoke all on function public.import_conduce_rows(uuid, jsonb, text) from public, anon;
grant execute on function public.import_conduce_rows(uuid, jsonb, text) to authenticated, service_role;
