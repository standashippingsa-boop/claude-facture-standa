-- STANDA COMMERCIAL — Date réelle de remise au client
-- Les remises confirmées à partir de cette migration enregistrent leur date.
-- Les colis historiques ne sont pas modifiés: aucune fausse date n'est créée.

begin;

alter table public.packages
  add column if not exists delivered_at timestamptz;

create index if not exists packages_delivered_at_idx
  on public.packages (delivered_at desc)
  where status = 'Livré';

commit;

notify pgrst, 'reload schema';
