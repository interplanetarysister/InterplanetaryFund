-- Limit the public community directory to public group fields.
-- Anonymous callers cannot enumerate member or owner UUIDs.
revoke select on public.ifund_member_communities from anon;
grant select (id,name,description,location,status,created_at)
  on public.ifund_member_communities to anon;