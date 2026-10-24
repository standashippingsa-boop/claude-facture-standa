-- STANDA COMMERCIAL : fermeture des fonctions internes (24 oct.)
-- 1) advance_package_statuses() change les statuts des colis : seule la tâche
--    planifiée (cron, rôle postgres) doit pouvoir l'appeler. Avant, n'importe qui,
--    même sans connexion, pouvait l'appeler via /rest/v1/rpc.
-- 2) Fonctions de déclencheur : elles ne s'appellent jamais à la main.
--    Les déclencheurs continuent de fonctionner (le droit EXECUTE n'est pas
--    vérifié à l'exécution d'un déclencheur).
-- 3) search_path fixé pour éviter tout détournement de fonction.

revoke execute on function public.advance_package_statuses() from public, anon, authenticated;
revoke execute on function public.affiliate_commission_on_invoice() from public, anon, authenticated;
revoke execute on function public.queue_agency_payment_notification() from public, anon, authenticated;
revoke execute on function public.queue_bon_remise_notification() from public, anon, authenticated;

alter function public.conduces_touch_updated_at() set search_path = public, pg_temp;
alter function public.packages_track_status_change() set search_path = public, pg_temp;
alter function public.challenge_ledger_immutable() set search_path = public, pg_temp;
alter function public.packages_track_conduce_link() set search_path = public, pg_temp;
