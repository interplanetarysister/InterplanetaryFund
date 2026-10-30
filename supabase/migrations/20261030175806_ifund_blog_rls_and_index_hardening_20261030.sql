-- Tighten blog read policy and index all blog foreign keys.
drop policy if exists ifund_blogs_owner_manage on public.ifund_blogs;
drop policy if exists ifund_blogs_read_active on public.ifund_blogs;
create policy ifund_blogs_read_active_or_owner on public.ifund_blogs
  for select to anon, authenticated
  using (status = 'active' or owner_auth_user_id = (select auth.uid()));
create policy ifund_blogs_owner_update on public.ifund_blogs
  for update to authenticated
  using (owner_auth_user_id = (select auth.uid()))
  with check (owner_auth_user_id = (select auth.uid()));
create policy ifund_blogs_owner_delete on public.ifund_blogs
  for delete to authenticated
  using (owner_auth_user_id = (select auth.uid()));
create index if not exists ifund_blogs_owner_idx on public.ifund_blogs(owner_auth_user_id);
create index if not exists ifund_blog_entries_blog_idx on public.ifund_blog_entries(blog_id);
