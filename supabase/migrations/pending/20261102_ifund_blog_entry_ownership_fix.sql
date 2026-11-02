-- PENDING: NOT APPLIED. Review, then apply to Supabase project ssibsfmtodgximseeqsv.
--
-- Fixes a content-injection vulnerability in the committed blog policies
-- (recorded as B20). Read section 1 before applying; this one is a security
-- fix, not a feature, and the reasoning matters.
--
-- ---------------------------------------------------------------------------
-- 1. The defect
-- ---------------------------------------------------------------------------
-- 20261030175218_ifund_blog_migration_foundation_20261030.sql creates:
--
--   create policy ifund_blog_entries_owner_insert on public.ifund_blog_entries
--     for insert to authenticated
--     with check (owner_auth_user_id = (select auth.uid()));
--
-- The check is self-referential: it asks whether the row says the actor owns it,
-- not whether the actor owns the blog the row is being filed under. blog_id is
-- never compared against ifund_blogs.owner_auth_user_id. So any authenticated
-- account can insert a row with its own owner_auth_user_id and the official
-- Reporter blog's blog_id.
--
-- Combined with the read policy
--
--   create policy ifund_blog_entries_read_public_or_owner ... using
--     (status = 'published' or owner_auth_user_id = (select auth.uid()))
--
-- a row inserted with status = 'published' is immediately readable by anon.
-- Reproduced on PostgreSQL 16 before writing this file: a non-owner inserted a
-- published entry into the official blog and an anonymous query returned it.
--
-- Impact: arbitrary unauthenticated-read content published to the official
-- blogs surface under the organisation's name. The browser code does not cause
-- this — src/lib/blogs.js checks the blog owner first — but RLS is the boundary
-- and the boundary is missing, so PostgREST can be called directly.
--
-- The update policy has the same shape and a related gap: its WITH CHECK also
-- only inspects owner_auth_user_id, so a member holding any entry could retarget
-- its blog_id onto the official blog. Both are corrected here.
--
-- ---------------------------------------------------------------------------
-- 2. The fix
-- ---------------------------------------------------------------------------
-- Require that the acting user owns the blog the entry is filed under. The check
-- is written as an EXISTS against public.ifund_blogs and depends on nothing
-- except that table, which the committed migration set already creates. It does
-- not reference public.ifund_current_account_is_active() from
-- 20261102_ifund_member_schema_completion.sql, so the two pending migrations are
-- independent and either order works.
--
-- The subquery is evaluated as the acting role, so it relies on the existing
-- `grant select on public.ifund_blogs to authenticated` and on
-- ifund_blogs_read_active_or_owner, which already lets an owner see their own
-- blog. There is no recursion: the ifund_blogs policies do not read
-- ifund_blog_entries.
--
-- Properties: idempotent, additive, and it removes no capability that a
-- legitimate blog owner has. An owner can still create, publish, edit and
-- delete their own entries.

begin;

-- Insert: the entry must be filed under a blog the actor owns.
drop policy if exists ifund_blog_entries_owner_insert on public.ifund_blog_entries;
create policy ifund_blog_entries_owner_insert on public.ifund_blog_entries
  for insert to authenticated with check (
    owner_auth_user_id = (select auth.uid())
    and exists (
      select 1 from public.ifund_blogs b
      where b.id = blog_id
        and b.owner_auth_user_id = (select auth.uid())
    )
  );

-- Update: the actor must own both the existing row and the target blog, so a
-- member cannot move their own entry onto a blog they do not own.
drop policy if exists ifund_blog_entries_owner_update on public.ifund_blog_entries;
create policy ifund_blog_entries_owner_update on public.ifund_blog_entries
  for update to authenticated
  using (
    owner_auth_user_id = (select auth.uid())
    and exists (
      select 1 from public.ifund_blogs b
      where b.id = blog_id
        and b.owner_auth_user_id = (select auth.uid())
    )
  )
  with check (
    owner_auth_user_id = (select auth.uid())
    and exists (
      select 1 from public.ifund_blogs b
      where b.id = blog_id
        and b.owner_auth_user_id = (select auth.uid())
    )
  );

-- Delete: an entry on a blog the actor does not own must not be removable, and
-- a forged entry must remain removable by the blog owner, not by its forger.
drop policy if exists ifund_blog_entries_owner_delete on public.ifund_blog_entries;
create policy ifund_blog_entries_owner_delete on public.ifund_blog_entries
  for delete to authenticated using (
    owner_auth_user_id = (select auth.uid())
    and exists (
      select 1 from public.ifund_blogs b
      where b.id = blog_id
        and b.owner_auth_user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Remediation query (review, do not run automatically)
-- ---------------------------------------------------------------------------
-- Before applying, look for entries already filed under the official blog by
-- someone other than its owner. This is a read-only query; run it manually and
-- decide what to do with any rows it returns. Do not delete history blind.
--
--   select e.id, e.blog_id, e.title, e.status, e.owner_auth_user_id,
--          e.created_at, b.owner_auth_user_id as blog_owner
--   from public.ifund_blog_entries e
--   join public.ifund_blogs b on b.id = e.blog_id
--   where e.owner_auth_user_id is distinct from b.owner_auth_user_id
--   order by e.created_at;
--
-- This migration does not change existing rows: it closes the write path so no
-- new forged rows can be created. Cleaning up any rows the query finds is a
-- separate, reviewed action.

commit;
