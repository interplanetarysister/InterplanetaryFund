-- Public campaign covers are intentionally publicly readable when someone
-- knows the URL. Writes are restricted to verified authenticated user folders.
-- Private documents, draft metadata and payment records remain in private storage.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ifund-campaign-covers',
  'ifund-campaign-covers',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/avif']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "ifund_owner_campaign_cover_upload_v1" ON storage.objects;
CREATE POLICY "ifund_owner_campaign_cover_upload_v1"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ifund-campaign-covers'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.](jpg|png|webp|avif)$'
);
