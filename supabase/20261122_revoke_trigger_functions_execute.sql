-- Déjà appliqué sur le projet (migration revoke_public_execute_trigger_functions).
-- Fonctions de déclencheur : elles tournent toutes seules via leurs triggers,
-- personne n'a besoin de les appeler par l'API.
revoke execute on function public.agences_propagate_pickup_label() from public, anon, authenticated;
revoke execute on function public.packages_enqueue_notification() from public, anon, authenticated;
