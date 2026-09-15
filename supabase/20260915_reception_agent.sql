-- STANDA COMMERCIAL — Rôle "agent_reception" (arrivée des Conduces)
-- ═══════════════════════════════════════════════════════════════════════════
-- KOURI SA A APRE: migration.sql -> security-hardening.sql -> 20260831_public_reviews.sql
--                   -> 20260913_affiliate_program.sql
--
-- Fichye REJOUABLE san erè (idempotent).
--
-- Sa a se yon NOUVO WÒL sou tab `staff` ki deja egziste — okenn nouvo tab,
-- okenn nouvo politik RLS. Menm prensip ak `agent_retrait`: wòl sa a PA
-- antre nan `is_staff()` (defini nan security-hardening.sql), donk li pa
-- gen okenn lekti/ekri dirèk sou `clients`/`packages`/`conduces` — tout
-- pase pa /api/reception (kle sèvis kote sèvè a), apre verifikasyon wòl la.
--
-- Rezon dèyè wòl sa a: moun ki resevwa machandiz la lè yon Conduce (manifest
-- Caribe Tours) rive an Ayiti bezwen konfime yon kòd kliyan ki "parèt etranj"
-- (non, zòn) epi konbyen lòt koli kliyan sa a gen k ap toujou soti Miami —
-- san yo pa bezwen aksè sou fakti, telefòn/adrès, ni okenn lòt zouti admin.

begin;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.staff'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.staff drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.staff
  add constraint staff_role_check
  check (role in ('admin', 'employe', 'agent_retrait', 'agent_reception'));

commit;
