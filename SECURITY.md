# STANDA COMMERCIAL — Sécurité

## 🔴 À faire MAINTENANT (fuite de clés)

Le fichier `.env.local` a été distribué avec le projet et contenait des
clés Supabase réelles (URL, `anon`, `service_role`). Considérez-les
**compromises**. La clé `service_role` contourne toute RLS = accès total
à la base.

1. **Supabase → Project Settings → API → `service_role` → Reset / Roll**.
   Mettez la nouvelle valeur dans **Vercel** (`SUPABASE_SERVICE_ROLE_KEY`)
   et dans votre `.env.local` local. Redeploy.
2. **Supabase → Project Settings → API → JWT Settings → Rotate** (invalide
   l'ancienne `anon` **et** les sessions en cours). Mettez la nouvelle
   `anon` dans Vercel + `.env.local`.
3. Définissez `SETUP_SECRET` (Vercel) — valeur longue et unique :
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
4. Supabase → **Logs** : vérifiez qu'aucune requête inconnue n'a lu
   `clients` / `invoices` / `staff` pendant la période d'exposition.
5. `.env.local` ne doit **jamais** revenir dans une archive / un e-mail /
   un dépôt. Il est déjà dans `.gitignore` ; utilisez `.env.local.example`
   comme modèle.

## Modèle d'accès

```
Navigateur (clé anon)  ──►  session Supabase Auth  ──►  RLS  ──►  données
Navigateur             ──►  app/api/*  (clé service_role)  ──►  données
```

- **RLS obligatoire.** `supabase/security-hardening.sql` définit les
  politiques (staff / client propriétaire / public restreint). Sans lui,
  RLS bloque tout (fail-closed) — c'est voulu.
- **Jamais de politique `anon all ... using(true)`.** Elle rend toutes les
  tables (PII client, pièces d'identité du personnel, montants) lisibles
  et modifiables par quiconque possède la clé `anon` (livrée au
  navigateur).
- **`service_role` + `SETUP_SECRET` = serveur uniquement.** Interdits dans
  tout code client ou page publique. `npm run check:isolation` le vérifie
  à chaque build.

## Ordre d'exécution SQL (Supabase → SQL Editor)

| # | Fichier | Rôle |
|---|---|---|
| 1 | `supabase/migration.sql` | schéma + buckets ; RLS activée, **aucune** politique permissive |
| 2 | `supabase/security-hardening.sql` | politiques RLS (staff / client / public / storage / agences / conduces / journal / api_tokens) |
| 3 | `supabase/20260831_public_reviews.sql` | avis publics (écriture via `/api/reviews` uniquement) |

Ré-exécutables sans risque (idempotents).

## Contrôles en place

- **Rate limiting** par IP sur toutes les routes sensibles
  (`lib/ratelimit.ts`) — en mémoire par instance ; pour une garantie dure,
  passer à Upstash Redis.
- **Tracking public** (`/api/track`) : 6 colonnes seulement, recherche
  exacte, anti-énumération, POST only.
- **Bootstrap admin** (`/api/admin-auth` action `bootstrap`) : exige
  `SETUP_SECRET` + table `staff` vide.
- **Audit log** (`/api/audit-log`) : identité dérivée du jeton côté
  serveur (le champ `user_name` du client est ignoré).
- **PDF factures / photos** : nom de fichier avec jeton aléatoire
  (non énumérable) — bucket public *par lien* car WhatsApp ne peut pas
  joindre de fichier.
- En-têtes de sécurité + host canonique : `next.config.mjs`,
  `middleware.ts`.

## Améliorations recommandées (non bloquantes)

1. **Buckets Storage privés + URLs signées.** Aujourd'hui `invoices` et
   `staff-docs` sont publics-par-lien (jeton aléatoire). Idéal : bucket
   privé + route serveur qui vérifie la session et renvoie une URL signée
   courte durée. Priorité haute pour `staff-docs` (scans de passeport/CIN).
   Voir les blocs commentés dans `security-hardening.sql` §12–13.
2. **Numéro de facture** (`SC-` + 6 chiffres du timestamp) : risque de
   collision et semi-prévisible. Ajouter un suffixe aléatoire.
3. **CSP `script-src`** avec nonce (actuellement seul `frame-ancestors`
   est défini, pour ne pas casser Next.js).
4. **Rate limiting distribué** (Upstash) pour `/api/admin-auth`,
   `/api/register-client`, `/api/reviews`.
5. **`/api/register-client`** distingue « e-mail déjà utilisé » de
   « téléphone déjà utilisé » → énumération de comptes possible (limitée
   à 5/h/IP). Fusionner le message si la confidentialité prime sur l'UX.
