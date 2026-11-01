-- SUPERSEDED: DO NOT APPLY.
-- The canonical database uses public.ifund_blogs and public.ifund_blog_entries
-- with text legacy IDs, owner_auth_user_id, and legacy_owner_user_id.
-- The proposed UUID-based ifund_user_blogs schema conflicts with that model.
-- Canonical replacements are recorded in the live migration history as:
-- 20261030175218_ifund_blog_migration_foundation
-- 20261030175806_ifund_blog_rls_and_index_hardening
-- 20261030233951_ifund_editorial_public_read_and_server_write_hardening_20261030
-- 20261031021327_ifund_my_blog_studio_entitlement_gate_20261030
-- 20261031021430_ifund_blog_public_active_parent_gate_20261030
-- 20261031023940_ifund_blog_parent_visibility_active_owner_20261031
-- This guard intentionally fails if someone manually applies the obsolete draft.
DO $superseded$
BEGIN
  RAISE EXCEPTION 'This editorial migration is superseded by the canonical text-ID schema. Do not apply.';
END;
$superseded$;
