-- The existing RLS event trigger should run only internally, not via PostgREST roles.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;