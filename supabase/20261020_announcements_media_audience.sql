-- STANDA COMMERCIAL — ANNONS: plizyè foto/videyo + PIBLIK SIBLE
-- ═══════════════════════════════════════════════════════════════════
-- media           : [{ "path": "...", "kind": "image" | "video" }] — diaporama akèy kliyan an
-- audience_type   : 'all' | 'villes' | 'account_types' | 'clients'
-- audience_values : id vil yo, tip kont yo (Personnel/Business/VIP) oswa kòd kliyan yo
-- Yon kliyan wè SÈLMAN annons ki vize l (RLS) — pa gen fwit pou lòt piblik.
-- Fichye yo monte DIRÈK depi navigatè admin nan (lyen siyen), donk videyo
-- yo pa bloke pa limit 4,5 Mo Vercel la.

alter table public.announcements
  add column if not exists media jsonb not null default '[]'::jsonb,
  add column if not exists audience_type text not null default 'all',
  add column if not exists audience_values text[] not null default '{}';

alter table public.announcements drop constraint if exists announcements_audience_type_check;
alter table public.announcements add constraint announcements_audience_type_check
  check (audience_type in ('all', 'villes', 'account_types', 'clients'));

alter policy announcements_read_active on public.announcements
  using (
    coalesce(public.is_admin(), false)
    or (active and (
      audience_type = 'all'
      or exists (
        select 1 from public.clients c
        where c.auth_user_id = auth.uid()
          and (
            (audience_type = 'villes' and c.ville_id::text = any(audience_values))
            or (audience_type = 'account_types' and coalesce(c.account_type, 'Personnel') = any(audience_values))
            or (audience_type = 'clients' and c.customer_code = any(audience_values))
          )
      )
    ))
  );

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
where id = 'announcements';
