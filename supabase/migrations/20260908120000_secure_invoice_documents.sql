-- STANDA COMMERCIAL — PDFs de factures privés
-- À lancer dans Supabase SQL Editor après le déploiement du code associé.
-- Les anciens liens publics sont transformés en chemins internes puis effacés.

begin;

alter table public.invoices add column if not exists pdf_path text;
alter table public.invoices add column if not exists has_pdf boolean not null default false;

-- Récupère le chemin des anciens liens public Supabase sans déplacer les PDF.
update public.invoices
set pdf_path = split_part(pdf_url, '/invoices/', 2)
where coalesce(pdf_path, '') = ''
  and coalesce(pdf_url, '') like '%/invoices/%.pdf';

update public.invoices
set has_pdf = true
where coalesce(pdf_path, '') <> '';

-- L'URL Supabase ne doit plus sortir dans les requêtes client ni dans WhatsApp.
update public.invoices
set pdf_url = null
where coalesce(pdf_path, '') <> '';

insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do update set public = false;

-- Accès direct au bucket: personnel seulement. Les clients et agents passent
-- par l'API serveur qui vérifie l'identité et la propriété de la facture.
drop policy if exists "invoice_files_staff_read" on storage.objects;
drop policy if exists "invoice_files_customer_read" on storage.objects;
drop policy if exists "invoice_files_staff_insert" on storage.objects;
drop policy if exists "invoice_files_staff_update" on storage.objects;
drop policy if exists "invoice_files_admin_delete" on storage.objects;
create policy "invoice_files_staff_read" on storage.objects for select to authenticated
  using (bucket_id = 'invoices' and public.is_staff());
create policy "invoice_files_staff_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'invoices' and public.is_staff());
create policy "invoice_files_staff_update" on storage.objects for update to authenticated
  using (bucket_id = 'invoices' and public.is_staff())
  with check (bucket_id = 'invoices' and public.is_staff());
create policy "invoice_files_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'invoices' and public.is_admin());

commit;
notify pgrst, 'reload schema';
