-- ---------------------------------------------------------------------------
-- 1. public.ifund_my_post_ids() - which community posts belong to the caller
-- ---------------------------------------------------------------------------
-- src/pages/Community.jsx loads the 50 most recent posts, then asks which of them
-- the signed-in member may delete:
--
--   const { data: owned } = await db.rpc("ifund_my_post_ids");
--   setOwnPostIds(new Set((owned || []).map((item) => item.post_id)));
--
-- so the return shape is a set of rows each carrying a `post_id`. Against
-- production the function exists but is not executable by a browser:
--
--   POST /rest/v1/rpc/ifund_my_post_ids -> 401
--     {"code":"42501","message":"permission denied for function ifund_my_post_ids"}
--
-- The page degrades to "ownership controls are temporarily unavailable" and no
-- delete control appears. No migration in this repository defines the function,
-- so a database built from these migrations would not have it at all, and the
-- page would fail the same way. This defines it and grants execute to the roles
-- that need it.
--
-- Why the client cannot answer this itself
--
-- ifund_posts holds author_id, and a member could compare author_id to their own
-- id. But author_id must not be readable by anon: a post body is public, the
-- identity of the account that wrote it is not, and a uuid leaks that. Production
-- withholds it (selecting author_id as anon returns 401). This function resolves
-- the comparison inside a SECURITY DEFINER body, where author_id is visible, and
-- returns only post ids, so the column stays private while the client still learns
-- which controls to show.
--
-- This is the same shape as the Stories read path in
-- 20261102_ifund_public_blog_entries_read.sql, and for the same reason: the client
-- needs a decision that depends on a column it is not allowed to read.

create or replace function public.ifund_my_post_ids()
returns table (post_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id as post_id
  from public.ifund_posts p
  where p.author_id = (select auth.uid());
$$;

comment on function public.ifund_my_post_ids() is
  'Returns the ids of community posts authored by the caller. Exists so the '
  'client can decide which posts to offer a delete control for without being '
  'granted author_id, which identifies the account and is withheld from anon.';

-- Revoke before granting, so the grants below are what decides access rather than
-- a default PUBLIC execute.
revoke all on function public.ifund_my_post_ids() from public;
grant execute on function public.ifund_my_post_ids() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Withhold the identity columns on ifund_posts and ifund_campaigns from anon
-- ---------------------------------------------------------------------------
-- The committed initial migration grants anon a table-wide select:
--
--   grant select on public.ifund_campaigns,public.ifund_posts to anon;
--
-- Production does not behave that way. Probing the anon grant column by column on
-- ssibsfmtodgximseeqsv gives:
--
--   ifund_posts      readable: id, body, created_at
--   ifund_posts      NOT readable: author_id
--   ifund_campaigns  readable: id, title, summary, story, category, goal_amount,
--                              cover_image_url, status, created_at, updated_at
--   ifund_campaigns  NOT readable: owner_id
--
-- Both row policies permit public rows, so with a table-wide grant anon can read
-- author_id on every community post and owner_id on every active campaign. The
-- owner id is the account uuid: it links a campaign or post to a specific user
-- account, which is more than publishing the content requires and more than
-- production allows. The committed migration is behind production here, so
-- applying it as written would widen access.
--
-- Narrowing anon is safe for every reader in this repository. The public pages and
-- the worker select explicit public column lists that already exclude the identity
-- columns:
--
--   src/pages/{Discover,Feed,CampaignDetail}.jsx  id,title,summary,story,category,
--                                                 goal_amount,cover_image_url,
--                                                 status,created_at
--   src/pages/{Community,Feed}.jsx                id,body,created_at
--   worker/reads.js                               same lists, plus updated_at
--
-- authenticated keeps its table-wide grant, because the ownership policies and the
-- owner-scoped reads are written against owner_id and author_id, and a member may
-- read their own rows.
revoke select on public.ifund_campaigns from anon;
grant select (id, title, summary, story, category, goal_amount, cover_image_url,
              status, created_at, updated_at)
  on public.ifund_campaigns to anon;

revoke select on public.ifund_posts from anon;
grant select (id, body, created_at) on public.ifund_posts to anon;

comment on table public.ifund_campaigns is
  'Crowdfunding campaigns. anon may read only the public columns; owner_id is '
  'withheld so a campaign is not linked to an account uuid for anonymous readers.';
comment on table public.ifund_posts is
  'Public community posts. anon may read only id, body and created_at; author_id '
  'is withheld and reachable only through public.ifund_my_post_ids() for the '
  'author''s own posts.';
