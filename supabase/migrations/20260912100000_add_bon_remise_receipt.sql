-- STANDA COMMERCIAL — Confirmation de réception d'un Bon de remise
--
-- Yon ajan pwen de retrait (ex: Rony, Gonaïves) dwe ka konfime li resevwa
-- fizikman koli yo lè li fin resevwa Bon de remise a. Konfimasyon sa a fè
-- TOUT koli ki nan Bon an vin "Disponible" (tarifikasyon aplike an menm
-- tan), otomatikman vizib sou admin, kliyan AK ajan an — yo tout li menm
-- kolòn `packages.status` la.
--
-- Aksyon an fèt kote sèvè (/api/pickup-agent, kle sèvis) : ajan an pa gen
-- dwa RLS dirèk sou `bons_remise` ni `packages` (wè kòmantè an tèt fichye
-- app/api/pickup-agent/route.ts).

begin;

alter table public.bons_remise add column if not exists received_at timestamptz;
alter table public.bons_remise add column if not exists received_by text;

commit;
