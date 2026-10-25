-- STANDA COMMERCIAL : sécurité des fichiers (25 oct.)
-- 1) Les factures PDF n'étaient lisibles que « si connecté » : n'importe quel
--    client pouvait donc lister et télécharger les factures des autres.
--    Les clients passent par /api/documents (vérifie que la facture est la leur).
drop policy if exists "auth read invoices files" on storage.objects;

-- 2) Pièces d'identité du personnel : compartiment privé (liens temporaires).
update storage.buckets set public = false where id = 'staff-docs';

-- 3) Types et tailles autorisés : impossible de déposer un .exe, .html ou .js
--    qui serait ensuite servi depuis notre domaine de stockage.
update storage.buckets set file_size_limit = 26214400,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
  where id = 'staff-docs';
update storage.buckets set file_size_limit = 20971520,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif']
  where id = 'scan-photos';
update storage.buckets set file_size_limit = 20971520,
  allowed_mime_types = array['application/pdf']
  where id in ('invoices', 'bons-remise');
