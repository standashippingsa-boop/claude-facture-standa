-- STANDA COMMERCIAL — PWA FAKTURE PA MCPACK (23 oct.)
-- Fakti MCPACK la: 1289.23 lb; sistèm nan: 1297.68 lb (3 koli peze diferan,
-- 1 koli pa sou fakti a). Kounye a chak fakti MCPACK sere pwa MCPACK pou chak
-- koli; kat « À payer à MCPACK » itilize pwa sa a lè li egziste.
-- NULL = pa gen fakti (pwa STANDA) · 0 = MCPACK pa fakture koli a.
alter table public.packages add column if not exists mcpack_billed_lbs numeric;

create or replace function public.set_mcpack_billed_lbs(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  if not coalesce(public.is_staff(), false) then raise exception 'Accès refusé'; end if;
  update packages p set mcpack_billed_lbs = (x->>'lbs')::numeric
  from jsonb_array_elements(p_items) x
  where p.id = (x->>'id')::uuid;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.set_mcpack_billed_lbs(jsonb) from public, anon;
grant execute on function public.set_mcpack_billed_lbs(jsonb) to authenticated;
