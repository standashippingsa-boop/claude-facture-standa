-- STANDA COMMERCIAL — Commentaires publics sans compte
-- Exécutez ce fichier dans Supabase > SQL Editor après security-hardening.sql.
-- Les visiteurs publient exclusivement via /api/reviews : aucune écriture SQL
-- directe n'est donnée à anon ou authenticated. La clé service reste côté serveur.

begin;

create table if not exists public.site_reviews (
  id uuid primary key default gen_random_uuid(),
  author_name text not null check (char_length(author_name) between 2 and 80),
  rating smallint not null default 5 check (rating between 1 and 5),
  message text not null check (char_length(btrim(message)) between 8 and 600),
  is_visible boolean not null default true,
  moderated_at timestamptz,
  moderated_by uuid,
  created_at timestamptz not null default now()
);

-- Compatibilité si l'ancienne version Google de la table a déjà été créée.
alter table public.site_reviews add column if not exists rating smallint;
alter table public.site_reviews add column if not exists is_visible boolean not null default true;
alter table public.site_reviews add column if not exists moderated_at timestamptz;
alter table public.site_reviews add column if not exists moderated_by uuid;
update public.site_reviews set rating = 5 where rating is null;
alter table public.site_reviews alter column rating set default 5;
alter table public.site_reviews alter column rating set not null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'site_reviews' and column_name = 'author_id'
  ) then
    alter table public.site_reviews alter column author_id drop not null;
  end if;
end $$;

alter table public.site_reviews drop constraint if exists site_reviews_rating_check;
alter table public.site_reviews add constraint site_reviews_rating_check check (rating between 1 and 5);

create index if not exists site_reviews_visible_created_at_idx
  on public.site_reviews (created_at desc) where is_visible = true;

alter table public.site_reviews enable row level security;

-- Seules les colonnes publiques sont lisibles depuis le navigateur.
revoke all on public.site_reviews from anon, authenticated;
grant select (id, author_name, rating, message, created_at) on public.site_reviews to anon, authenticated;

drop policy if exists "Public can read site reviews" on public.site_reviews;
drop policy if exists "Google users can publish one review" on public.site_reviews;
drop policy if exists "Public can read visible site reviews" on public.site_reviews;

create policy "Public can read visible site reviews"
  on public.site_reviews for select
  using (is_visible = true);

commit;

-- Résultat :
--   • le public lit uniquement les commentaires visibles ;
--   • personne n'écrit directement dans la table ;
--   • /api/reviews écrit côté serveur avec contrôle des champs + anti-spam ;
--   • l'administration peut masquer/restaurer un avis sans le supprimer.
