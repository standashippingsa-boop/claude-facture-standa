-- STANDA COMMERCIAL — Klotire rapò lajan ajan retrè yo (bouton admin "Clôturer le rapport")
-- ═══════════════════════════════════════════════════════════════════════════
-- KOURI SA A APRE: migration.sql -> security-hardening.sql -> 20260831_public_reviews.sql
--                   -> 20260913_affiliate_program.sql -> 20260915_reception_agent.sql
--                   -> 20260917_staff_push_notifications.sql
--
-- Fichye REJOUABLE san erè (idempotent). Kole l nan Supabase -> SQL Editor -> Run.
--
-- Lè ajan yo fin remèt lajan kliyan yo bay administrasyon an, admin nan
-- "Rapports financiers" klike "Clôturer le rapport" pou yon vil. Peman ajan
-- yo ki te nan rapò a resevwa yon dat `settled_at`: yo disparèt nan rapò ajan an
-- ak nan rapò admin lan (yo rete aksesib avèk "Inclure les paiements clôturés").
--
-- RANJE PA JANM EFASE: peman an, resi a ak solde kliyan yo rete entak. Se sèlman
-- vizibilite rapò a ki chanje. Kliyan ki gen solde rete nan lis "soldes" la
-- paske solde a kalkile sou faktè yo, pa sou peman yo.
--
-- Pa gen nouvo tab isit la: politik RLS invoice_payments (admin sèlman) nan
-- security-hardening.sql kouvri kolòn sa yo tou.

begin;

alter table public.invoice_payments add column if not exists settled_at timestamptz;
alter table public.invoice_payments add column if not exists settled_by text not null default '';

-- Rapò yo li sèlman peman ki poko klote: endèks patyèl la kenbe sa rapid.
create index if not exists invoice_payments_unsettled_idx
  on public.invoice_payments (created_at desc) where settled_at is null;

commit;
