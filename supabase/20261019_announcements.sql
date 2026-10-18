-- STANDA COMMERCIAL — ANNONS POU TOUT KLIYAN (flyer + mesaj)
-- ═══════════════════════════════════════════════════════════════════
-- Admin pibliye yon annons (tit, mesaj, foto flyer). Tout kliyan konekte wè l
-- nan app yo (fenèt + sant notifikasyon), epi yo resevwa yon notifikasyon
-- push sou telefòn yo. Ekriti yo fèt SÈLMAN pa sèvè a (/api/announcements,
-- kle sèvis, apre verifikasyon admin) — pa gen policy INSERT/UPDATE.
-- Foto yo nan yon bucket PIBLIK: se yon flyer piblisite, pa yon done prive.

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 2000),
  image_path text,
  active boolean not null default true,
  created_by text not null default '',
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

create policy announcements_read_active on public.announcements
  for select to authenticated
  using (active or coalesce(public.is_admin(), false));

insert into storage.buckets (id, name, public)
values ('announcements', 'announcements', true)
on conflict (id) do nothing;
