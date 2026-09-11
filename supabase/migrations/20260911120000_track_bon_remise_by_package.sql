-- STANDA COMMERCIAL — Bon de remise : blocage par COLIS, pas par Conduce
--
-- BUG: une Conduce peut contenir des colis pour PLUSIEURS villes (ex :
-- Gonaïves ET Port-de-Paix). La contrainte `unique(conduce_id)` sur
-- bon_remise_conduces bloquait TOUTE la Conduce dès qu'un premier Bon de
-- remise (ex: Gonaïves) était créé — impossible de créer ensuite le Bon pour
-- les colis Port-de-Paix de la MÊME Conduce, alors qu'ils n'avaient jamais
-- été remis.
--
-- FIX: le blocage anti-doublon se fait maintenant COLIS PAR COLIS
-- (packages.bon_remise_id), pas Conduce par Conduce. Une Conduce reste
-- sélectionnable tant qu'il lui reste des colis pas encore remis ; seul un
-- colis déjà présent sur un Bon ne peut plus entrer dans un second.

begin;

alter table public.packages
  add column if not exists bon_remise_id uuid references public.bons_remise(id) on delete set null;

create index if not exists packages_bon_remise_id_idx
  on public.packages (bon_remise_id) where bon_remise_id is not null;

-- bon_remise_conduces reste une table INFORMATIVE (quelles Conduces ont
-- contribué à quel Bon, pour l'affichage) ; elle ne doit plus bloquer une
-- Conduce entière. Aucune nouvelle politique RLS n'est nécessaire : la mise à
-- jour de packages.bon_remise_id passe par la policy "packages_update_staff"
-- déjà en place dans security-hardening.sql.
alter table public.bon_remise_conduces
  drop constraint if exists bon_remise_conduces_conduce_id_key;

commit;
