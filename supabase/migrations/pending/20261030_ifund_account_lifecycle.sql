-- Enforce the original Base44 account lifecycle guard in the independent target.
-- No legacy identity is assigned here: source staging has zero verified owner_auth_uid links.
BEGIN;
DO $preflight$
BEGIN
 IF to_regclass('public.ifund_profiles') IS NULL THEN RAISE EXCEPTION 'public.ifund_profiles is missing.'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ifund_profiles' AND policyname='ifund_profiles_read' AND cmd='SELECT' AND roles @> ARRAY['authenticated']::name[] AND qual ILIKE '%auth.uid%') THEN RAISE EXCEPTION 'Owner-scoped profile SELECT policy is missing.'; END IF;
 IF has_table_privilege('authenticated','public.ifund_profiles','UPDATE') THEN RAISE EXCEPTION 'Authenticated has table-level UPDATE; lifecycle columns cannot be protected safely.'; END IF;
END;
$preflight$;
ALTER TABLE public.ifund_profiles ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active', ADD COLUMN IF NOT EXISTS account_deletion_pending boolean NOT NULL DEFAULT false;
DO $constraints$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.ifund_profiles'::regclass AND conname='ifund_profiles_account_status_nonempty') THEN ALTER TABLE public.ifund_profiles ADD CONSTRAINT ifund_profiles_account_status_nonempty CHECK (length(btrim(account_status)) BETWEEN 1 AND 64); END IF;
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ifund_profiles' AND column_name='account_status' AND (is_nullable <> 'NO' OR column_default NOT LIKE '%active%')) THEN RAISE EXCEPTION 'account_status is not safely defaulted.'; END IF;
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ifund_profiles' AND column_name='account_deletion_pending' AND (is_nullable <> 'NO' OR column_default NOT LIKE '%false%')) THEN RAISE EXCEPTION 'account_deletion_pending is not safely defaulted.'; END IF;
END;
$constraints$;
REVOKE INSERT (account_status,account_deletion_pending), UPDATE (account_status,account_deletion_pending), REFERENCES (account_status,account_deletion_pending) ON TABLE public.ifund_profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT (account_status,account_deletion_pending), UPDATE (account_status,account_deletion_pending) ON TABLE public.ifund_profiles TO service_role;
COMMENT ON COLUMN public.ifund_profiles.account_status IS 'Server-controlled lifecycle state; only active accounts may use authenticated migration APIs.';
COMMENT ON COLUMN public.ifund_profiles.account_deletion_pending IS 'Server-controlled deletion workflow flag; true immediately blocks authenticated migration APIs.';
COMMIT;
