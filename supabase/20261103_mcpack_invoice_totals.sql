-- Totaux imprimés sur la facture MCPACK (« Pwa Total », « Total pou Peye »).
-- Servent au contrôle : lecture du PDF complète et comparaison avec les Conduces.
-- Déjà appliqué sur la base de production le 2026-11-03.
alter table public.mcpack_invoices add column if not exists invoice_total_lbs numeric;
alter table public.mcpack_invoices add column if not exists invoice_total_usd numeric;
comment on column public.mcpack_invoices.invoice_total_lbs is 'Pwa Total imprimé sur la facture MCPACK (contrôle)';
comment on column public.mcpack_invoices.invoice_total_usd is 'Total pou Peye imprimé sur la facture MCPACK (contrôle)';
