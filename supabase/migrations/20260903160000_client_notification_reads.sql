-- STANDA COMMERCIAL — accusés de lecture des notifications client
-- Chaque ligne indique qu'un client authentifié a déjà lu une notification.
-- La notification elle-même est calculée à partir de ses colis, factures et
-- demandes de retrait : aucune donnée d'un autre client n'est dupliquée ici.

begin;

create table if not exists public.client_notification_reads (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  notification_key text not null check (char_length(notification_key) between 1 and 500),
  read_at timestamptz not null default now(),
  primary key (auth_user_id, notification_key)
);

create index if not exists client_notification_reads_user_read_at_idx
  on public.client_notification_reads (auth_user_id, read_at desc);

alter table public.client_notification_reads enable row level security;

drop policy if exists "client_notification_reads_select_own" on public.client_notification_reads;
drop policy if exists "client_notification_reads_insert_own" on public.client_notification_reads;

-- Jamais de lecture/écriture anonyme : chaque client ne voit et ne crée que
-- ses propres accusés de lecture. Les lignes déjà présentes ne changent pas.
create policy "client_notification_reads_select_own"
on public.client_notification_reads for select to authenticated
using (auth.uid() = auth_user_id);

create policy "client_notification_reads_insert_own"
on public.client_notification_reads for insert to authenticated
with check (auth.uid() = auth_user_id);

commit;
