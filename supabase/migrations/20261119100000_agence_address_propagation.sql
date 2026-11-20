-- ═══════════════════════════════════════════════════════════════════════════
-- ADRESSE D'AGENCE : propagation automatique aux clients
-- ───────────────────────────────────────────────────────────────────────────
-- Les factures reprennent le « lieu de récupération » enregistré sur la fiche
-- du client (clients.pickup_location = « Nom, Adresse » de l'agence). Quand une
-- agence changeait d'adresse, les fiches gardaient l'ancienne : les factures
-- de Cap-Haïtien affichaient encore « Dépôt : Cité du Peuple ».
-- Ce trigger met à jour les fiches des clients dès que le nom ou l'adresse
-- d'une agence change. Sans risque à relancer.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.agences_propagate_pickup_label()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_old text := case when trim(coalesce(old.adresse, '')) = '' then trim(coalesce(old.nom, ''))
                     else trim(coalesce(old.nom, '')) || ', ' || trim(old.adresse) end;
  v_new text := case when trim(coalesce(new.adresse, '')) = '' then trim(coalesce(new.nom, ''))
                     else trim(coalesce(new.nom, '')) || ', ' || trim(new.adresse) end;
begin
  if v_old <> '' and v_old is distinct from v_new then
    update public.clients set pickup_location = v_new where trim(pickup_location) = v_old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_agences_propagate_pickup_label on public.agences;
create trigger trg_agences_propagate_pickup_label
  after update of nom, adresse on public.agences
  for each row execute function public.agences_propagate_pickup_label();

-- Correction immédiate : Cap-Haïtien a déjà changé d'adresse.
update public.clients
   set pickup_location = 'Cap-Haïtien, 68, Rue 15J, Rosafa Multi-services'
 where trim(pickup_location) = 'Cap-Haïtien, Dépôt : Cité du Peuple';

update public.invoices
   set pickup_location = 'Cap-Haïtien, 68, Rue 15J, Rosafa Multi-services'
 where trim(pickup_location) = 'Cap-Haïtien, Dépôt : Cité du Peuple';
