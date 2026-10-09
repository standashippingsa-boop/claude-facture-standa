-- Note de facture (compte central : nom + téléphone de la personne qui vient
-- prendre les colis). Déjà appliqué sur la base de production le 2026-10-09 ;
-- idempotent, rejouable sans risque (Supabase → SQL Editor).
alter table public.invoices add column if not exists note text;
comment on column public.invoices.note is 'Note de facture (compte central : nom + téléphone de la personne qui vient prendre les colis).';
