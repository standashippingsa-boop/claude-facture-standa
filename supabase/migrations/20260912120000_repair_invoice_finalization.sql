-- STANDA COMMERCIAL — Réparation finale de facturation
--
-- La colonne est utilisée uniquement pour tracer la date de facturation.
-- Son absence faisait échouer la mise à jour des colis sur les projets
-- Supabase installés avant cette évolution.

begin;

alter table public.packages
  add column if not exists invoiced_at timestamptz;

commit;

notify pgrst, 'reload schema';
