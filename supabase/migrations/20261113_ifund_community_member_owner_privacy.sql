-- Public community identity privacy also applies to signed-in members.
-- Creation relies on owner_id write RLS, not returning identity columns.
revoke select on public.ifund_member_communities from authenticated;
grant select (id,name,description,location,status,created_at,updated_at)
  on public.ifund_member_communities to authenticated;
