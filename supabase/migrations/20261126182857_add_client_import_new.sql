-- Kliyan ki kreye otomatikman pandan enpòtasyon koli (Excel MCPACK oswa ekstansyon Chrome).
-- true = ti boul wouj nan lis kliyan + « Nouveau client » sou paj akèy la;
-- retounen false lè admin louvri dosye kliyan an. Sans risque à relancer.
alter table public.clients add column if not exists import_new boolean not null default false;
create index if not exists clients_import_new_idx on public.clients (import_new) where import_new;
