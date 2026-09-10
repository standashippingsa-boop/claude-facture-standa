-- STANDA COMMERCIAL — Le changement de mot de passe est désormais volontaire.
-- Les anciens marqueurs ne doivent plus rediriger les clients après connexion.

begin;

update public.clients
set must_change_password = false
where must_change_password is true;

commit;

notify pgrst, 'reload schema';
