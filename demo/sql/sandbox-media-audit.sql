-- Independent IFund judge sandbox: read-only media inventory.
-- Source links are stored in image_path; this checks syntax and Wikimedia file-path MD5 convention.
-- It does NOT prove remote image HTTP availability, a successful browser render, suitable crop, or licensing.
WITH images AS (
  SELECT id, title, fictional, status, image_path,
    regexp_match(image_path, '/commons/(?:thumb/)?([0-9a-f])/([0-9a-f]{2})/([^/]+)') AS components
  FROM public.ifund_demo_campaigns
), decoded AS (
  SELECT *,
    replace(replace(replace(replace(replace(components[3], '%2C', ','), '%28', '('), '%29', ')'), '%C3%A7', 'ç'), '%C3%A3', 'ã') AS filename
  FROM images
), classification AS (
  SELECT *,
    CASE
      WHEN image_path IS NULL OR btrim(image_path)='' THEN 'missing'
      WHEN image_path ~ '^/api/media/[a-f0-9-]{36}$' THEN 'sandbox_internal_media'
      WHEN image_path ~ '^https://(upload|thumb)\.wikimedia\.org/' AND components IS NOT NULL AND
        left(md5(filename),1)=components[1] AND left(md5(filename),2)=components[2] THEN 'commons_path_hash_valid'
      ELSE 'unrecognized_or_invalid_path'
    END AS image_state
  FROM decoded
)
SELECT now() AS inspected_at,
  count(*) AS campaigns,
  count(*) FILTER(WHERE fictional IS TRUE AND status='published') AS published_fictional,
  count(*) FILTER(WHERE image_state='missing') AS missing,
  count(*) FILTER(WHERE image_state='commons_path_hash_valid') AS commons_assigned,
  count(*) FILTER(WHERE image_state='sandbox_internal_media') AS internal_media,
  count(*) FILTER(WHERE image_state='unrecognized_or_invalid_path') AS invalid_paths,
  count(DISTINCT image_path) FILTER(WHERE image_path IS NOT NULL AND btrim(image_path)<>'') AS distinct_images,
  coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'status',image_state))
   FILTER(WHERE image_state IN ('missing','unrecognized_or_invalid_path')), '[]'::jsonb) AS unresolved
FROM classification;
