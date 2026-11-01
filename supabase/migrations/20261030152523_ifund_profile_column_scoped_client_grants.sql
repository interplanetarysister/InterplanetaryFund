
begin;

-- Authenticated profile edits are limited to the fields exposed by Profile.jsx.
-- Future server-owned lifecycle/role columns must not inherit table-wide UPDATE.
revoke insert, update on table public.ifund_profiles from authenticated;
grant insert (id, handle, display_name)
  on table public.ifund_profiles to authenticated;
grant update (handle, display_name)
  on table public.ifund_profiles to authenticated;

commit;
