-- ---------------------------------------------------------------------------
-- public.ifund_public_blog_entries_read(...) - the public Stories read path
-- ---------------------------------------------------------------------------
-- The client calls this function and nothing else for public stories.
-- apps/web/src/lib/editorial.js calls it twice:
--
--   listPublishedStories({author})  -> rpc('ifund_public_blog_entries_read',
--        { p_author_ref: author, p_blog_id: null, p_entry_id: null, p_limit: n })
--   getPublishedStory(id)           -> rpc('ifund_public_blog_entries_read',
--        { p_author_ref: null, p_blog_id: null, p_entry_id: id, p_limit: 1 })
--
-- Measured against production project ssibsfmtodgximseeqsv, the function does not
-- exist:
--
--   POST /rest/v1/rpc/ifund_public_blog_entries_read
--     -> 404 {"code":"PGRST202", ...}
--
-- so every public Stories request fails and the pages render their error state.
-- A test asserted the call site while the function was missing, which is why this
-- went unnoticed: apps/web/tests/published-stories-parity.test.js only reads
-- editorial.js as text and checks that the rpc() call is spelled correctly. A
-- source-text assertion cannot tell whether the function exists in the database.
--
-- Why a function is needed at all, rather than reading the tables directly
--
-- The tables are readable by anon only in part. Probing the anon grant per column
-- on production gives:
--
--   ifund_blog_entries readable: id, status, title, body, summary, type, featured,
--                                published_at, blog_id, created_at, updated_at
--   ifund_blog_entries NOT readable: owner_auth_user_id, legacy_owner_user_id
--   ifund_blogs        readable: id, status, title, type, slug, description,
--                                created_at, updated_at
--   ifund_blogs        NOT readable: owner_auth_user_id, legacy_owner_user_id
--
-- The author identity columns are deliberately not granted, so a caller cannot
-- filter by author directly, and an unfiltered read cannot be narrowed to one
-- author's stories without them. That is what this function is for: it resolves
-- the author reference inside a SECURITY DEFINER function, where the column is
-- visible, and returns only public fields, so the identity columns stay private.
--
-- Security properties
--
--   * SECURITY DEFINER with search_path pinned to public, pg_temp. Without the pin
--     a caller who can shadow a schema earlier in the path could redirect the
--     unqualified names this body resolves. tests/function-security.test.js
--     enforces the pin.
--   * STABLE and read-only: the body contains no insert, update or delete.
--   * execute revoked from PUBLIC, then granted to anon and authenticated. Anon is
--     intentional: these are public published stories.
--   * The returned columns are the public ones only. owner_auth_user_id and
--     legacy_owner_user_id are never returned, so the function cannot become a
--     way to read identity columns that the table grant withholds.
-- ---------------------------------------------------------------------------

create or replace function public.ifund_public_blog_entries_read(
  p_author_ref text default null,
  p_blog_id    text default null,
  p_entry_id   text default null,
  p_limit      integer default 100
)
returns table (
  id text,
  blog_id text,
  title text,
  summary text,
  body text,
  type text,
  featured boolean,
  status text,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  blog jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with bounds as (
    -- Clamp the limit rather than trusting it. A caller passing 0, a negative
    -- number or a huge number must not be able to return everything or nothing
    -- unexpectedly; the client's own limitEditorialResults() clamps to 1..100 and
    -- this repeats that bound on the server, where it actually constrains.
    select least(100, greatest(1, coalesce(p_limit, 100))) as n
  )
  select
    e.id,
    e.blog_id,
    e.title,
    e.summary,
    e.body,
    e.type,
    e.featured,
    e.status,
    e.published_at,
    e.created_at,
    e.updated_at,
    jsonb_build_object(
      'id', b.id,
      'title', b.title,
      'type', b.type,
      'slug', b.slug,
      'description', b.description,
      'status', b.status
    ) as blog
  from public.ifund_blog_entries e
  join public.ifund_blogs b on b.id = e.blog_id
  cross join bounds
  where e.status = 'published'          -- only published entries are public
    and b.status = 'active'             -- an archived publication publishes nothing
    and (p_entry_id is null or e.id = p_entry_id)
    and (p_blog_id is null or e.blog_id = p_blog_id)
    and (
      p_author_ref is null
      -- The author reference is the original Base44 identifier, which is text.
      -- Match the retained legacy owner id, and also the authenticated owner when
      -- the reference happens to be a uuid, so a caller can pass either form.
      or e.legacy_owner_user_id = p_author_ref
      or (
        p_author_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and e.owner_auth_user_id = p_author_ref::uuid
      )
    )
  order by e.published_at desc nulls last, e.created_at desc nulls last, e.id
  limit (select n from bounds);
$$;

comment on function public.ifund_public_blog_entries_read(text, text, text, integer) is
  'Public read path for published IFund stories. Returns only published entries '
  'whose parent publication is active, with the public blog fields nested. Author '
  'identity columns are resolved inside the function and never returned, so they '
  'stay private even though the author filter needs them.';

-- Execute must be revoked from PUBLIC before being granted to named roles; a
-- default grant would let any role, including anon, call it without the grants
-- below being the thing that decides access.
revoke all on function public.ifund_public_blog_entries_read(text, text, text, integer)
  from public;
grant execute on function public.ifund_public_blog_entries_read(text, text, text, integer)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Restrict what anon may read from the blog tables to the public columns
-- ---------------------------------------------------------------------------
-- The committed blog migration grants anon a table-wide select:
--
--   grant select on public.ifund_blogs to anon, authenticated;
--   grant select on public.ifund_blog_entries to anon, authenticated;
--
-- Production does not behave that way. Probing the anon grant column by column on
-- ssibsfmtodgximseeqsv shows the identity columns are withheld:
--
--   ifund_blog_entries: owner_auth_user_id and legacy_owner_user_id -> 401
--   ifund_blogs:        owner_auth_user_id and legacy_owner_user_id -> 401
--
-- With a table-wide grant, anon can read owner_auth_user_id on every published
-- story, because the row policy permits published rows. That exposes the author's
-- authentication user id to anyone, which is more than the public needs and more
-- than production allows. The committed migration is therefore behind production
-- here, and applying it as written would widen access rather than reproduce it.
--
-- The statements below bring the committed state in line with the measured
-- production state. Only anon is narrowed. authenticated is left untouched, so an
-- owner can still read and manage their own rows, including the identity columns
-- the ownership policies are written against.
revoke select on public.ifund_blogs from anon;
revoke select on public.ifund_blog_entries from anon;

grant select (id, status, title, type, slug, description, created_at, updated_at)
  on public.ifund_blogs to anon;

grant select (id, blog_id, title, summary, body, type, featured, status,
              published_at, created_at, updated_at)
  on public.ifund_blog_entries to anon;

comment on table public.ifund_blogs is
  'Migrated Base44 IFund blog metadata. Original IDs and owner identity retained; '
  'authenticated ownership is explicitly mapped. anon may read only the public '
  'columns; the owner identity columns are withheld and reachable only through '
  'public.ifund_public_blog_entries_read().';
