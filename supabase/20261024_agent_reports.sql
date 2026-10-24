-- STANDA COMMERCIAL — RAPÒ PDF AJANS RETRÈ YO (24 oct.)
-- ═══════════════════════════════════════════════════════════════════
-- Apre remiz yo, ajan an voye rapò a an PDF (kès, detay pa mwayen peman,
-- peman yo, koli remèt yo, kliyan ki gen balans). Sèvè a (kle sèvis, apre
-- verifikasyon ajan an) sere PDF la nan yon bucket PRIVE epi li avèti chak admin.
-- Admin sèlman ka li rapò yo (RLS + politik storage).

create table if not exists public.agent_reports (
  id uuid primary key default gen_random_uuid(),
  agent_staff_id uuid references public.staff(id) on delete set null,
  agent_name text not null default '',
  zone text not null default '',
  pdf_path text not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.agent_reports enable row level security;
drop policy if exists agent_reports_admin_read on public.agent_reports;
create policy agent_reports_admin_read on public.agent_reports
  for select to authenticated using (coalesce(public.is_admin(), false));

insert into storage.buckets (id, name, public) values ('agent-reports', 'agent-reports', false)
on conflict (id) do nothing;
drop policy if exists agent_reports_admin_files on storage.objects;
create policy agent_reports_admin_files on storage.objects
  for select to authenticated using (bucket_id = 'agent-reports' and coalesce(public.is_admin(), false));

alter table public.staff_notifications add column if not exists source_agent_report_id uuid
  references public.agent_reports(id) on delete cascade;
alter table public.staff_notifications drop constraint if exists staff_notifications_kind_check;
alter table public.staff_notifications add constraint staff_notifications_kind_check
  check (kind = any (array['agency_payment', 'bon_remise_created', 'affiliate_update', 'agent_report']));
alter table public.staff_notifications drop constraint if exists staff_notifications_check;
alter table public.staff_notifications add constraint staff_notifications_check check (
  (kind = 'agency_payment' and source_invoice_payment_id is not null and source_bon_remise_id is null and source_affiliate_id is null and source_agent_report_id is null)
  or (kind = 'bon_remise_created' and source_bon_remise_id is not null and source_invoice_payment_id is null and source_affiliate_id is null and source_agent_report_id is null)
  or (kind = 'affiliate_update' and source_affiliate_id is not null and source_invoice_payment_id is null and source_bon_remise_id is null and source_agent_report_id is null)
  or (kind = 'agent_report' and source_agent_report_id is not null and source_invoice_payment_id is null and source_bon_remise_id is null and source_affiliate_id is null)
);
