-- IFund official-publication public read model.
-- Additive and fail-closed: browser roles can read only final-approved
-- published rows. No browser insert/update/delete grants are created.
-- Admin publishing/retraction remains disabled until a server-authorized
-- admin identity and audit path are implemented and independently verified.

BEGIN;

CREATE TABLE public.ifund_official_publications (
  id text PRIMARY KEY
    CHECK (char_length(id) BETWEEN 1 AND 128),
  kind text NOT NULL
    CHECK (kind IN ('report','status_report','presentation','research','announcement')),
  title text NOT NULL
    CHECK (char_length(title) BETWEEN 5 AND 140),
  summary text NOT NULL
    CHECK (char_length(summary) BETWEEN 20 AND 500),
  body text NOT NULL DEFAULT ''
    CHECK (char_length(body) <= 24000),
  pdf_url text
    CHECK (
      pdf_url IS NULL OR (
        char_length(pdf_url) <= 2000
        AND pdf_url LIKE 'https://%'
        AND pdf_url !~ '[[:space:]]'
      )
    ),
  file_label text
    CHECK (file_label IS NULL OR char_length(file_label) <= 140),
  status text NOT NULL DEFAULT 'unpublished'
    CHECK (status IN ('published','unpublished')),
  final_approved boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ifund_publication_final_public CHECK (
    status <> 'published'
    OR (final_approved = true AND published_at IS NOT NULL)
  )
);

CREATE INDEX ifund_publications_public_idx
  ON public.ifund_official_publications (published_at DESC, id DESC)
  WHERE status = 'published' AND final_approved = true;

ALTER TABLE public.ifund_official_publications ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
  ON TABLE public.ifund_official_publications
  FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id, kind, title, summary, body, pdf_url, file_label,
  status, final_approved, published_at
) ON TABLE public.ifund_official_publications TO anon, authenticated;

CREATE POLICY ifund_publications_final_read
  ON public.ifund_official_publications
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND final_approved = true);

COMMENT ON TABLE public.ifund_official_publications IS
  'Public read model for final-approved IFund publications. Browser roles are read-only; publication and retraction require a separately verified admin server action.';

COMMIT;