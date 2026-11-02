-- PENDING: NOT APPLIED. Review, then apply to Supabase project ssibsfmtodgximseeqsv.
--
-- Member-schema completion. This migration closes the gap between the objects
-- the client code queries and the objects the committed migration set actually
-- creates. Verified against a real PostgreSQL 16 engine (see
-- supabase/migrations/pending/README.md and tests/migrations/).
--
-- Before this migration the committed set created six tables
-- (ifund_profiles, ifund_campaigns, ifund_posts, ifund_connections,
-- ifund_blogs, ifund_blog_entries) while apps/web and worker/ query eleven.
-- The missing five (ifund_legal_acceptances, ifund_notifications,
-- ifund_inbox_items, ifund_follows, ifund_official_publications), the
-- ifund_profiles account-lifecycle columns, and
-- public.ifund_current_account_is_active() were referenced but defined nowhere
-- in the repository or its history, so every legal-consent gate, inbox,
-- notification, follow and account-status check failed closed at runtime.
--
-- Properties:
--   * Additive only. No existing table is dropped, renamed or retyped; no
--     historical row is imported, promoted or deleted.
--   * No financial object. No donation, ledger, payout, withdrawal or
--     subscription table is created here.
--   * Idempotent: safe to re-run.
--   * Every table gets RLS plus explicit column-level grants, following the
--     least-privilege pattern of 20261025011400_initial.sql. Server-owned
--     columns are never granted to browsers.

begin;

-- ---------------------------------------------------------------------------
-- 1. Account lifecycle columns on public.ifund_profiles
-- ---------------------------------------------------------------------------
-- Client contract: apps/web/src/lib/accountLifecycle.js and
-- apps/web/src/components/auth/MemberAccess.jsx select
-- account_status + account_deletion_pending and refuse access unless
-- account_status is a string and account_deletion_pending is a boolean.
-- A missing column made PostgREST error, so every member gate failed closed.
--
-- Defaults are deliberately 'pending' / false, never 'active': a newly seen
-- account must not silently acquire member access. Reconciliation sets real
-- values from verified source records.
alter table public.ifund_profiles
  add column if not exists account_status text not null default 'pending';
alter table public.ifund_profiles
  add column if not exists account_deletion_pending boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ifund_profiles_account_status_valid'
      and conrelid = 'public.ifund_profiles'::regclass
  ) then
    alter table public.ifund_profiles
      add constraint ifund_profiles_account_status_valid
      check (account_status in ('pending','active','suspended','closed'));
  end if;
end $$;

-- The client may edit only its own display identity. Account lifecycle and
-- deletion flags stay database/server-owned: never granted to authenticated.
grant update(handle,display_name) on public.ifund_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. public.ifund_current_account_is_active()
-- ---------------------------------------------------------------------------
-- Referenced by the pending follows migration and by the corrected write
-- policies below. SECURITY DEFINER because the policy runs for the acting
-- role while the profile row is only readable by its owner; the function body
-- reads one row for auth.uid() and returns a boolean, so it exposes no data.
-- Fixed search_path and a STABLE marker keep it safe to inline in policies.
create or replace function public.ifund_current_account_is_active()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.ifund_profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'active'
      and p.account_deletion_pending = false
  );
$$;

comment on function public.ifund_current_account_is_active() is
  'True only when the acting auth.uid() has an active, non-deletion-pending profile. Returns a boolean and exposes no row data.';

revoke all on function public.ifund_current_account_is_active() from public;
grant execute on function public.ifund_current_account_is_active() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. public.ifund_legal_acceptances
-- ---------------------------------------------------------------------------
-- Client contract: apps/web/src/components/auth/MemberAccess.jsx inserts
-- (owner_id, terms_version, explicit_consent) and reads
-- (owner_id, terms_version, explicit_consent). The source entity
-- LegalAcceptance also carries accepted_at, acceptance_method, terms_path and
-- privacy_path, which the server sets. accepted_at is NOT NULL so the
-- follows policies that require "a.accepted_at is not null" can be satisfied;
-- this migration is the authority for that requirement.
create table if not exists public.ifund_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  explicit_consent boolean not null,
  accepted_at timestamptz not null default now(),
  acceptance_method text not null default 'explicit_checkbox',
  terms_path text not null default '/terms',
  privacy_path text not null default '/privacy',
  created_at timestamptz not null default now(),
  unique (owner_id, terms_version),
  constraint ifund_legal_consent_required check (explicit_consent is true)
);
create index if not exists ifund_legal_acceptances_owner_idx
  on public.ifund_legal_acceptances(owner_id, terms_version);

alter table public.ifund_legal_acceptances enable row level security;

drop policy if exists ifund_legal_acceptances_owner_read on public.ifund_legal_acceptances;
create policy ifund_legal_acceptances_owner_read on public.ifund_legal_acceptances
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists ifund_legal_acceptances_owner_insert on public.ifund_legal_acceptances;
create policy ifund_legal_acceptances_owner_insert on public.ifund_legal_acceptances
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and explicit_consent is true
  );
-- Consent is recorded once per version and is not editable or deletable by the
-- browser; withdrawal is a server-side, auditable operation.

revoke all on table public.ifund_legal_acceptances from public, anon, authenticated;
-- Only the columns a member may supply; accepted_at, id and the document paths
-- are database defaults, not client input.
grant select on public.ifund_legal_acceptances to authenticated;
grant insert(owner_id,terms_version,explicit_consent)
  on public.ifund_legal_acceptances to authenticated;

-- ---------------------------------------------------------------------------
-- 4. public.ifund_notifications
-- ---------------------------------------------------------------------------
-- Client contract: apps/web/src/lib/inbox.js selects
-- id,owner_id,title,body,type,link,read,created_at and updates read.
create table if not exists public.ifund_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  type text not null default 'system',
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ifund_notifications_owner_recent
  on public.ifund_notifications(owner_id, created_at desc);

alter table public.ifund_notifications enable row level security;

drop policy if exists ifund_notifications_owner_read on public.ifund_notifications;
create policy ifund_notifications_owner_read on public.ifund_notifications
  for select to authenticated using (owner_id = (select auth.uid()));
-- A notification is produced by a server-side event, never authored by the
-- browser. The member may only flip `read` on their own row.
drop policy if exists ifund_notifications_owner_update on public.ifund_notifications;
create policy ifund_notifications_owner_update on public.ifund_notifications
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
drop policy if exists ifund_notifications_owner_delete on public.ifund_notifications;
create policy ifund_notifications_owner_delete on public.ifund_notifications
  for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on table public.ifund_notifications from public, anon, authenticated;
grant select,delete on public.ifund_notifications to authenticated;
grant update(read) on public.ifund_notifications to authenticated;

-- ---------------------------------------------------------------------------
-- 5. public.ifund_inbox_items
-- ---------------------------------------------------------------------------
-- Client contract: apps/web/src/lib/inbox.js selects
-- id,owner_id,platform,type,author,content,link,campaign_id,campaign_title,
-- status,ai_draft,recipient_address,mailbox_priority,created_at and updates
-- status. Rows arrive from connected platforms through the server, so the
-- browser has no insert grant.
create table if not exists public.ifund_inbox_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'ifund',
  type text not null default 'message',
  author text,
  content text not null default '',
  link text,
  campaign_id uuid references public.ifund_campaigns(id) on delete set null,
  campaign_title text,
  status text not null default 'open',
  ai_draft text,
  recipient_address text,
  mailbox_priority text not null default 'normal',
  created_at timestamptz not null default now(),
  constraint ifund_inbox_status_valid check (status in ('open','done','archived')),
  constraint ifund_inbox_priority_valid check (mailbox_priority in ('normal','priority'))
);
create index if not exists ifund_inbox_items_owner_recent
  on public.ifund_inbox_items(owner_id, created_at desc);
create index if not exists ifund_inbox_items_campaign_idx
  on public.ifund_inbox_items(campaign_id);

alter table public.ifund_inbox_items enable row level security;

drop policy if exists ifund_inbox_items_owner_read on public.ifund_inbox_items;
create policy ifund_inbox_items_owner_read on public.ifund_inbox_items
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists ifund_inbox_items_owner_update on public.ifund_inbox_items;
create policy ifund_inbox_items_owner_update on public.ifund_inbox_items
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
drop policy if exists ifund_inbox_items_owner_delete on public.ifund_inbox_items;
create policy ifund_inbox_items_owner_delete on public.ifund_inbox_items
  for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on table public.ifund_inbox_items from public, anon, authenticated;
grant select,delete on public.ifund_inbox_items to authenticated;
grant update(status) on public.ifund_inbox_items to authenticated;

-- ---------------------------------------------------------------------------
-- 6. public.ifund_follows
-- ---------------------------------------------------------------------------
-- Client contract: apps/web/src/lib/followedCampaigns.js reads/writes
-- owner_id, campaign_id, pinned, archived, notification_prefs, last_viewed,
-- created_at and upserts on (owner_id, campaign_id).
-- The shape matches the pending 20261101 legal-acceptance-and-follows file, but
-- this version drops that file's dependency on a hard-coded terms_version and
-- on the already-live ifund_notifications, so it applies from the committed
-- baseline. It also reads the lifecycle helper rather than duplicating the
-- account-status check inline.
create table if not exists public.ifund_follows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.ifund_campaigns(id) on delete cascade,
  pinned boolean not null default false,
  archived boolean not null default false,
  notification_prefs jsonb not null default '{"updates":true,"media":true,"milestones":true,"goal_reached":true,"nearing_completion":true,"comments":false,"volunteer":true,"events":true,"emergencies":true,"completed":true}'::jsonb,
  last_viewed timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, campaign_id),
  constraint ifund_follow_prefs_valid check (
    jsonb_typeof(notification_prefs) = 'object'
    and notification_prefs ?& array['updates','media','milestones','goal_reached','nearing_completion','comments','volunteer','events','emergencies','completed']
    and (notification_prefs - 'updates' - 'media' - 'milestones' - 'goal_reached' - 'nearing_completion' - 'comments' - 'volunteer' - 'events' - 'emergencies' - 'completed') = '{}'::jsonb
    and jsonb_typeof(notification_prefs->'updates') = 'boolean' and
      jsonb_typeof(notification_prefs->'media') = 'boolean' and
      jsonb_typeof(notification_prefs->'milestones') = 'boolean' and
      jsonb_typeof(notification_prefs->'goal_reached') = 'boolean' and
      jsonb_typeof(notification_prefs->'nearing_completion') = 'boolean' and
      jsonb_typeof(notification_prefs->'comments') = 'boolean' and
      jsonb_typeof(notification_prefs->'volunteer') = 'boolean' and
      jsonb_typeof(notification_prefs->'events') = 'boolean' and
      jsonb_typeof(notification_prefs->'emergencies') = 'boolean' and
      jsonb_typeof(notification_prefs->'completed') = 'boolean'
  )
);
create index if not exists ifund_follows_owner_created_idx
  on public.ifund_follows(owner_id, created_at desc);
create index if not exists ifund_follows_campaign_idx
  on public.ifund_follows(campaign_id);

alter table public.ifund_follows enable row level security;

-- An active account may follow only a published campaign. A follow is private:
-- the owner sees their own rows and nothing else.
drop policy if exists ifund_follows_owner_select on public.ifund_follows;
create policy ifund_follows_owner_select on public.ifund_follows
  for select to authenticated using (
    owner_id = (select auth.uid())
    and (select public.ifund_current_account_is_active())
  );
drop policy if exists ifund_follows_owner_insert on public.ifund_follows;
create policy ifund_follows_owner_insert on public.ifund_follows
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and (select public.ifund_current_account_is_active())
    and exists (
      select 1 from public.ifund_campaigns c
      where c.id = campaign_id and c.status = 'active'
    )
  );
drop policy if exists ifund_follows_owner_update on public.ifund_follows;
create policy ifund_follows_owner_update on public.ifund_follows
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    and (select public.ifund_current_account_is_active())
  )
  with check (
    owner_id = (select auth.uid())
    and (select public.ifund_current_account_is_active())
  );
drop policy if exists ifund_follows_owner_delete on public.ifund_follows;
create policy ifund_follows_owner_delete on public.ifund_follows
  for delete to authenticated using (
    owner_id = (select auth.uid())
    and (select public.ifund_current_account_is_active())
  );

revoke all on table public.ifund_follows from public, anon, authenticated;
grant select,insert,delete on public.ifund_follows to authenticated;
grant update(pinned,archived,notification_prefs,last_viewed)
  on public.ifund_follows to authenticated;

comment on table public.ifund_follows is
  'Owner-scoped campaign follows. No historical import and no external publishing is activated.';

-- ---------------------------------------------------------------------------
-- 7. public.ifund_official_publications
-- ---------------------------------------------------------------------------
-- Client contract: apps/web/src/lib/editorial.js selects
-- id,kind,title,summary,body,pdf_url,file_label,status,final_approved,
-- published_at and treats a row as public only when status='published' and
-- final_approved is true.
create table if not exists public.ifund_official_publications (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'report',
  title text not null default '',
  summary text,
  body text not null default '',
  pdf_url text,
  file_label text,
  status text not null default 'draft',
  final_approved boolean not null default false,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint ifund_official_publications_status_valid
    check (status in ('draft','published','archived')),
  constraint ifund_official_publications_published_complete check (
    status <> 'published' or (final_approved is true and published_at is not null)
  )
);
create index if not exists ifund_official_publications_public_recent
  on public.ifund_official_publications(published_at desc)
  where status = 'published' and final_approved;

alter table public.ifund_official_publications enable row level security;

-- Public, read-only, and only when actually finalized. Approval and publishing
-- are server-side operations: there is no browser insert/update/delete policy.
drop policy if exists ifund_official_publications_public_read on public.ifund_official_publications;
create policy ifund_official_publications_public_read on public.ifund_official_publications
  for select to anon,authenticated using (status = 'published' and final_approved is true);

revoke all on table public.ifund_official_publications from public, anon, authenticated;
grant select on public.ifund_official_publications to anon,authenticated;

-- ---------------------------------------------------------------------------
-- 8. Close blocker B16: writes must require an active account
-- ---------------------------------------------------------------------------
-- Before this, ifund_posts_insert checked only author_id = auth.uid(), so a
-- suspended or deletion-pending account could still publish. The browser fix
-- in apps/web/src/lib/socialPosts.js is UX only; RLS is authoritative. The same
-- gap existed on campaign creation. Both are corrected here by requiring
-- public.ifund_current_account_is_active().
--
-- Consequence, recorded deliberately: an account that has not yet been
-- reconciled to account_status='active' can no longer publish. That is the
-- intended fail-closed behavior; reconciliation sets active for verified
-- accounts, and drafts remain editable.
drop policy if exists ifund_posts_insert on public.ifund_posts;
drop policy if exists ifund_posts_insert on public.ifund_posts;
create policy ifund_posts_insert on public.ifund_posts
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and (select public.ifund_current_account_is_active())
  );

drop policy if exists ifund_campaigns_insert on public.ifund_campaigns;
drop policy if exists ifund_campaigns_insert on public.ifund_campaigns;
create policy ifund_campaigns_insert on public.ifund_campaigns
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and (select public.ifund_current_account_is_active())
  );

-- ---------------------------------------------------------------------------
-- 9. Timestamp maintenance for the new mutable tables
-- ---------------------------------------------------------------------------
drop trigger if exists ifund_official_publications_touch_updated_at
  on public.ifund_official_publications;
create trigger ifund_official_publications_touch_updated_at
  before update on public.ifund_official_publications
  for each row execute function public.ifund_touch_updated_at();

commit;
