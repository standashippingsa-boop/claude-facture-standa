-- STANDA COMMERCIAL — détails de paiement et tolérance d'arrondi
-- À exécuter après 20260908110000_add_pickup_operations.sql.

begin;

alter table public.invoice_payments add column if not exists payment_method text not null default 'Espèces';
alter table public.invoice_payments add column if not exists payment_reference text not null default '';
alter table public.invoice_payments add column if not exists applied_usd numeric not null default 0;
alter table public.invoice_payments add column if not exists applied_htg numeric not null default 0;
alter table public.invoice_payments add column if not exists overpayment_amount numeric not null default 0;
alter table public.invoice_payments add column if not exists recorded_by_role text not null default '';

-- Les anciennes écritures ont déjà été appliquées intégralement à leur facture.
update public.invoice_payments
set applied_usd = amount_usd, applied_htg = amount_htg
where applied_usd = 0 and applied_htg = 0 and (amount_usd > 0 or amount_htg > 0);

update public.invoice_payments
set payment_method = 'Espèces'
where payment_method is null or payment_method not in ('Espèces', 'MonCash', 'NatCash', 'Zelle', 'Virement bancaire');

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'invoice_payments_payment_method_check') then
    alter table public.invoice_payments drop constraint invoice_payments_payment_method_check;
  end if;
  alter table public.invoice_payments add constraint invoice_payments_payment_method_check
    check (payment_method in ('Espèces', 'MonCash', 'NatCash', 'Zelle', 'Virement bancaire'));
exception when duplicate_object then null;
end $$;

commit;
notify pgrst, 'reload schema';
