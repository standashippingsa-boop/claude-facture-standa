-- STANDA COMMERCIAL — KONT VIP
-- Moun ki fè biznis shipping: yon pri pa liv PA KLIYAN, admin fikse l epi chanje l lè l vle.
-- Kalkil: pwa tout koli yo adisyone (tankou Business), san tarif ti koli, san taks fiks.
alter table public.clients add column if not exists vip_price_per_lb numeric(10,2)
  check (vip_price_per_lb is null or vip_price_per_lb > 0);
comment on column public.clients.vip_price_per_lb is 'Prix/LB VIP propre à ce client (account_type = VIP). Poids additionnés comme Business, sans taxe fixe.';
