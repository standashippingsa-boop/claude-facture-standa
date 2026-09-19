-- STANDA COMMERCIAL — Colonnes PII chiffrées (AES-256-GCM, lib/pii-crypto.ts)
-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 1 (additive, sans risque) : ajoute des colonnes chiffrées à côté des
-- colonnes en clair existantes. Rien n'est cassé — lib/db.ts, l'espace
-- client, les PDF/factures continuent de lire phone/whatsapp/address comme
-- avant. /api/register-client remplit désormais aussi ces nouvelles colonnes
-- pour chaque nouveau client / chaque activation de compte.
--
-- À exécuter manuellement dans Supabase → SQL Editor (idempotent, rejouable
-- sans risque). Ne PAS mettre dans supabase/migrations/ — voir
-- supabase/migrations/README.md (workflow GitHub Actions non fiable).
--
-- PHASE 2 (à faire consciemment plus tard, hors de ce chantier) :
--   1. Backfiller les lignes existantes (script serveur qui lit phone/address
--      en clair, appelle encryptPII(), écrit dans les colonnes _encrypted).
--   2. Convertir CHAQUE lecteur de clients.phone / clients.whatsapp /
--      clients.address pour qu'il lise la colonne _encrypted et déchiffre
--      CÔTÉ SERVEUR (jamais dans un composant "use client" — la clé
--      PII_ENCRYPTION_KEY ne doit jamais atteindre le navigateur). Lecteurs
--      identifiés à ce jour : lib/db.ts, app/espace-client/page.tsx, la
--      génération PDF de factures, les notifications (WhatsApp/e-mail/push),
--      les exports admin.
--   3. Une fois TOUS les lecteurs convertis et vérifiés : supprimer les
--      colonnes en clair (phone, whatsapp, address) et renommer les colonnes
--      _encrypted, ou garder les deux noms selon préférence.

alter table if exists public.clients
  add column if not exists phone_encrypted text,
  add column if not exists whatsapp_encrypted text,
  add column if not exists address_encrypted text;

comment on column public.clients.phone_encrypted is
  'Téléphone chiffré AES-256-GCM (lib/pii-crypto.ts, format "v1:iv:tag:ciphertext"). Colonne phone (clair) conservée le temps de la Phase 2 — voir supabase/pii_encryption_columns.sql.';
comment on column public.clients.whatsapp_encrypted is
  'WhatsApp chiffré AES-256-GCM — même principe que phone_encrypted.';
comment on column public.clients.address_encrypted is
  'Adresse chiffrée AES-256-GCM — même principe que phone_encrypted.';
