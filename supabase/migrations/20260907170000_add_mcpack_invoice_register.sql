-- STANDA COMMERCIAL — Registre des factures MCPACK
--
-- Yon PDF MCPACK ka gen colis ki soti nan plizyè Conduce. Nou konsève yon
-- dosye entèn sou fakti a ak Conduce li yo, san janm modifye fakti kliyan yo.
-- PDF a li lokalman nan navigatè staff la; nou pa estoke dokiman an nan Storage.

begin;

create table if not exists public.mcpack_invoices (
  id uuid primary key default gen_random_uuid(),
  file_name text not null default '',
  extracted_tracking_count integer not null default 0 check (extracted_tracking_count >= 0),
  matched_package_count integer not null default 0 check (matched_package_count >= 0),
  unmatched_tracking_count integer not null default 0 check (unmatched_tracking_count >= 0),
  unlinked_package_count integer not null default 0 check (unlinked_package_count >= 0),
  status text not null default 'Facturée' check (status in ('Facturée', 'Payée')),
  created_by text not null default '',
  created_at timestamptz not null default now(),
  paid_by text,
  paid_at timestamptz
);

create table if not exists public.mcpack_invoice_conduces (
  invoice_id uuid not null references public.mcpack_invoices(id) on delete cascade,
  conduce_id uuid not null references public.conduces(id) on delete restrict,
  package_count integer not null default 0 check (package_count > 0),
  created_at timestamptz not null default now(),
  primary key (invoice_id, conduce_id),
  -- Yon Conduce ka sou yon sèl fakti MCPACK a la fwa. Sa anpeche yon menm lo
  -- antre de fwa nan lis peman an si yo re-chaje menm PDF la.
  unique (conduce_id)
);

create index if not exists mcpack_invoices_status_created_idx
  on public.mcpack_invoices (status, created_at desc);
create index if not exists mcpack_invoice_conduces_invoice_idx
  on public.mcpack_invoice_conduces (invoice_id);

-- Done sa yo se lojistik entèn. Se staff konekte sèlman ki ka li oswa ekri yo.
alter table public.mcpack_invoices enable row level security;
alter table public.mcpack_invoice_conduces enable row level security;

drop policy if exists "mcpack_invoices_select_staff" on public.mcpack_invoices;
drop policy if exists "mcpack_invoices_insert_staff" on public.mcpack_invoices;
drop policy if exists "mcpack_invoices_update_staff" on public.mcpack_invoices;
drop policy if exists "mcpack_invoices_delete_staff" on public.mcpack_invoices;
create policy "mcpack_invoices_select_staff" on public.mcpack_invoices
  for select to authenticated using (public.is_staff());
create policy "mcpack_invoices_insert_staff" on public.mcpack_invoices
  for insert to authenticated with check (public.is_staff());
create policy "mcpack_invoices_update_staff" on public.mcpack_invoices
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "mcpack_invoices_delete_staff" on public.mcpack_invoices
  for delete to authenticated using (public.is_staff());

drop policy if exists "mcpack_invoice_conduces_select_staff" on public.mcpack_invoice_conduces;
drop policy if exists "mcpack_invoice_conduces_insert_staff" on public.mcpack_invoice_conduces;
drop policy if exists "mcpack_invoice_conduces_update_staff" on public.mcpack_invoice_conduces;
drop policy if exists "mcpack_invoice_conduces_delete_staff" on public.mcpack_invoice_conduces;
create policy "mcpack_invoice_conduces_select_staff" on public.mcpack_invoice_conduces
  for select to authenticated using (public.is_staff());
create policy "mcpack_invoice_conduces_insert_staff" on public.mcpack_invoice_conduces
  for insert to authenticated with check (public.is_staff());
create policy "mcpack_invoice_conduces_update_staff" on public.mcpack_invoice_conduces
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "mcpack_invoice_conduces_delete_staff" on public.mcpack_invoice_conduces
  for delete to authenticated using (public.is_staff());

commit;
