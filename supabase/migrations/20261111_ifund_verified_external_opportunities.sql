-- Existing canonical Supabase opportunity table; public read is scoped to externally verified records.
-- Never includes donor/user contacts, payments or applications. No synthetic awards or claimed partner affiliation.
ALTER TABLE public.ifund_opportunity
  ADD COLUMN IF NOT EXISTS official_url text,
  ADD COLUMN IF NOT EXISTS official_provider text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS cause_tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS geography text,
  ADD COLUMN IF NOT EXISTS deadline_date date,
  ADD COLUMN IF NOT EXISTS source_note text;
ALTER TABLE public.ifund_opportunity DROP CONSTRAINT IF EXISTS ifund_opportunity_type_enum;
ALTER TABLE public.ifund_opportunity ADD CONSTRAINT ifund_opportunity_type_enum
 CHECK (type IS NULL OR type=ANY(ARRAY['grant','matching_gift','corporate_giving','foundation','business','community','media','event','other','volunteer']));
ALTER TABLE public.ifund_opportunity DROP CONSTRAINT IF EXISTS ifund_opportunity_status_enum;
ALTER TABLE public.ifund_opportunity ADD CONSTRAINT ifund_opportunity_status_enum
 CHECK (status IS NULL OR status=ANY(ARRAY['open','saved','dismissed','program']));
ALTER TABLE public.ifund_opportunity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ifund_opportunity FROM anon, authenticated;
GRANT SELECT (id,title,type,description,estimated_value,eligibility,required_actions,
 confidence,source,status,official_url,official_provider,verified_at,cause_tags,
 geography,deadline_date,source_note,source_system) ON public.ifund_opportunity TO anon,authenticated;
DROP POLICY IF EXISTS ifund_external_verified_opportunity_public ON public.ifund_opportunity;
CREATE POLICY ifund_external_verified_opportunity_public ON public.ifund_opportunity
 FOR SELECT TO anon,authenticated USING (source_system='ifund_external_verified_v1'
 AND verified_at IS NOT NULL AND official_url LIKE 'https://%'
 AND status IN ('open','program'));
CREATE INDEX IF NOT EXISTS ifund_opportunity_external_status_idx
 ON public.ifund_opportunity(source_system,status,deadline_date)
 WHERE source_system='ifund_external_verified_v1';

INSERT INTO public.ifund_opportunity
 (id,title,type,description,estimated_value,eligibility,required_actions,status,official_url,
  official_provider,geography,deadline_date,source_note,cause_tags,source,confidence,verified_at,source_system)
 VALUES
 ('external:tpp-daily-grant-2026','The Pollination Project — Daily Grants','grant',
  'Official $500 grants for volunteer-led charitable projects. The 2026 portal closes November 30.',
  'Up to $500 USD','Volunteer-led community work worldwide; project under $10,000, organization under $50,000; restrictions apply.',
  'Review official criteria, prepare budget and referee, apply directly to provider.','open',
  'https://thepollinationproject.smapply.us/prog/daily_grants_program/','The Pollination Project',
  'Worldwide; provider criteria apply','2026-11-30',
  'Deadline date confirmed on official application portal; check time zone directly.',
  ARRAY['community','environment','education','animals','creative','emergency'],
  'https://thepollinationproject.smapply.us/prog/daily_grants_program/','high',now(),'ifund_external_verified_v1'),
 ('external:awesome-monthly-grants','Awesome Foundation — Monthly Chapter Grants','grant',
  'Official $1,000 monthly grants through locally managed chapters; individual application windows vary.',
  '$1,000 USD','Community-impact projects; chapter eligibility varies.',
  'Select suitable chapter and check its current application rules.','program',
  'https://www.awesomefoundation.org/en','The Awesome Foundation',
  'International; chapter dependent',NULL,
  'Chapter-specific current application windows not individually verified.',
  ARRAY['community','creative','education','environment','science'],
  'https://www.awesomefoundation.org/en','high',now(),'ifund_external_verified_v1'),
 ('external:unv-online-volunteer','UN Volunteers — Online and International Programs','volunteer',
  'UNV recruitment entry point for national, international and online volunteer assignments, not an individual vacancy.',
  'Varies by assignment','Create UNV Global Talent Pool profile; assignment rules differ.',
  'Search currently published assignments and apply with official provider.','program',
  'https://www.unv.org/become-volunteer/','United Nations Volunteers',
  'Worldwide; remote where offered',NULL,
  'Specific open vacancy status and deadline not independently established.',
  ARRAY['community','education','environment','disaster_relief','medical','science'],
  'https://www.unv.org/become-volunteer/','high',now(),'ifund_external_verified_v1'),
 ('external:sam-procurement','SAM.gov — Federal Procurement Search','business',
  'Official U.S. federal procurement portal, not a specific verified open contract.',
  'Varies by solicitation','Entity registration and solicitation eligibility may apply.',
  'Review real open solicitations, contracting agency, registration and eligibility.','program',
  'https://sam.gov/opportunities','U.S. General Services Administration',
  'United States; solicitation dependent',NULL,
  'Research directory only; crowdfunding campaigns may be ineligible to bid.',
  ARRAY['community','science','environment','education','technology'],
  'https://sam.gov/opportunities','high',now(),'ifund_external_verified_v1')
ON CONFLICT (id) DO NOTHING;
