-- ═══════════════════════════════════════════════════════════════════════════
-- TESTS CHALLENGE DE NOËL — scénarios du cahier des charges (§10)
-- À coller dans Supabase → SQL Editor → Run.
-- TOUT est annulé à la fin (ROLLBACK) : aucune donnée de test ne reste.
-- Le résultat s'affiche dans le message d'erreur « RESULTS: … » (c'est voulu).
-- ═══════════════════════════════════════════════════════════════════════════
begin;
do $$
declare
  camp uuid; r17 uuid; admin_uid uuid; pierre uuid; jean uuid; marie uuid; aff_p uuid; aff_j uuid;
  pk_j1 uuid; pk_j2 uuid; pk_m uuid; pk_p uuid; res jsonb; claim1 uuid; msg text := '';
  u_p uuid := gen_random_uuid(); u_j uuid := gen_random_uuid(); u_m uuid := gen_random_uuid();
  bal_p numeric; bal_j numeric; bal_jc numeric; bal_m numeric; n_mem int;
begin
  select auth_user_id into admin_uid from staff where role = 'admin' and auth_user_id is not null limit 1;
  update challenge_campaigns set status = 'active', start_at = now() - interval '1 day', end_at = now() + interval '30 days' returning id into camp;
  select id into r17 from challenge_rewards where campaign_id = camp and model = 'iPhone 17 Pro Max';

  insert into clients (customer_code, fullname, auth_user_id) values ('MC-T0001', 'Pierre Test', u_p) returning id into pierre;
  insert into clients (customer_code, fullname, auth_user_id) values ('MC-T0002', 'Jean Test', u_j) returning id into jean;
  insert into affiliates (fullname, email, code, username, password_hash, referral_link, contract_start, contract_end, client_id, activated_at)
    values ('Pierre Test', 'p@test', 'TPIERRE01', 'tpierre', 'x', 'x', current_date, current_date + 90, pierre, now() - interval '2 hours') returning id into aff_p;
  update clients set referred_by_affiliate_id = aff_p where id = jean;
  select count(*) into n_mem from referral_memberships where client_id = jean and affiliate_id = aff_p and ended_at is null;
  msg := msg || ' | 0) Jean rattaché à Pierre=' || n_mem || ' (attendu 1)';

  -- 1) Jean expédie 300 lb livrées : Pierre +300, Jean +0 ; double traitement = un seul crédit
  insert into packages (tracking_number, customer_code, weight, status) values ('T-J1', 'MC-T0002', 300, 'Disponible') returning id into pk_j1;
  update packages set status = 'Livré', delivered_at = now() where id = pk_j1;
  update packages set status = 'Livré' where id = pk_j1;
  bal_p := (challenge_balances(camp, null, aff_p) ->> 'available')::numeric;
  bal_jc := (challenge_balances(camp, jean, null) ->> 'available')::numeric;
  msg := msg || ' | 1) Pierre=' || bal_p || ' (300) Jean=' || bal_jc || ' (0) crédits=' || (select count(*) from challenge_ledger where package_id = pk_j1) || ' (1)';

  -- 2) Jean devient affilié : 300 restent à Pierre ; 50 nouvelles lb → Jean
  perform set_config('request.jwt.claims', json_build_object('sub', admin_uid, 'role', 'authenticated')::text, true);
  res := challenge_promote_client(jean); aff_j := (res ->> 'affiliate_id')::uuid;
  insert into packages (tracking_number, customer_code, weight, status) values ('T-J2', 'MC-T0002', 50, 'Disponible') returning id into pk_j2;
  update packages set status = 'Livré', delivered_at = now() where id = pk_j2;
  bal_p := (challenge_balances(camp, null, aff_p) ->> 'available')::numeric;
  bal_j := (challenge_balances(camp, null, aff_j) ->> 'available')::numeric;
  select count(*) into n_mem from referral_memberships where client_id = jean and ended_at is null;
  msg := msg || ' | 2) Pierre=' || bal_p || ' (300) Jean=' || bal_j || ' (50) Jean filleul actif=' || n_mem || ' (0)';

  -- 3) Jean invite Marie : 100 lb → Jean, pas Pierre ni Marie
  insert into clients (customer_code, fullname, auth_user_id, referred_by_affiliate_id) values ('MC-T0003', 'Marie Test', u_m, aff_j) returning id into marie;
  insert into packages (tracking_number, customer_code, weight, status) values ('T-M1', 'MC-T0003', 100, 'Disponible') returning id into pk_m;
  update packages set status = 'Livré', delivered_at = now() where id = pk_m;
  bal_p := (challenge_balances(camp, null, aff_p) ->> 'available')::numeric;
  bal_j := (challenge_balances(camp, null, aff_j) ->> 'available')::numeric;
  bal_m := (challenge_balances(camp, marie, null) ->> 'available')::numeric;
  msg := msg || ' | 3) Pierre=' || bal_p || ' (300) Jean=' || bal_j || ' (150) Marie=' || bal_m || ' (0)';

  -- 4) Colis annulé : contre-écriture ; relivré : recrédité une fois
  update packages set status = 'Facturé' where id = pk_m;
  bal_j := (challenge_balances(camp, null, aff_j) ->> 'available')::numeric;
  msg := msg || ' | 4) annulé Jean=' || bal_j || ' (50)';
  update packages set status = 'Livré', delivered_at = now() where id = pk_m;
  bal_j := (challenge_balances(camp, null, aff_j) ->> 'available')::numeric;
  msg := msg || ' relivré Jean=' || bal_j || ' (150)';

  -- 5) Pierre à 3 050 lb demande l'iPhone 17 : réserve 3 000, reste 50 ; 2e demande refusée
  insert into packages (tracking_number, customer_code, weight, status) values ('T-P1', 'MC-T0001', 2750, 'Disponible') returning id into pk_p;
  update packages set status = 'Livré', delivered_at = now() where id = pk_p;
  perform set_config('request.jwt.claims', json_build_object('sub', u_p, 'role', 'authenticated')::text, true);
  res := challenge_claim(r17); claim1 := (res ->> 'claim_id')::uuid;
  msg := msg || ' | 5) reste=' || (res ->> 'remaining') || ' (50)';
  begin res := challenge_claim(r17); msg := msg || ' 2e demande ACCEPTÉE (ÉCHEC)';
  exception when others then msg := msg || ' 2e demande refusée (OK)'; end;

  -- 6) Un client ne peut pas promouvoir
  begin perform challenge_promote_client(marie); msg := msg || ' | 6) promotion par client ACCEPTÉE (ÉCHEC)';
  exception when others then msg := msg || ' | 6) promotion par client refusée (OK)'; end;

  -- 7) Refus admin : livres restitués
  perform set_config('request.jwt.claims', json_build_object('sub', admin_uid, 'role', 'authenticated')::text, true);
  perform challenge_decide_claim(claim1, 'reject');
  bal_p := (challenge_balances(camp, null, aff_p) ->> 'available')::numeric;
  msg := msg || ' | 7) après refus Pierre=' || bal_p || ' (3050)';

  -- 8) Marie (filleule) voit ses livres expédiés, pas de solde
  perform set_config('request.jwt.claims', json_build_object('sub', u_m, 'role', 'authenticated')::text, true);
  res := challenge_me();
  msg := msg || ' | 8) Marie parrainée=' || (res ->> 'sponsored') || ' (true) expédié=' || (res ->> 'shipped_lbs') || ' (100) solde=' || coalesce(res ->> 'balances', 'aucun') || ' (aucun)';

  raise exception 'RESULTS:%', msg;
end $$;
rollback;
