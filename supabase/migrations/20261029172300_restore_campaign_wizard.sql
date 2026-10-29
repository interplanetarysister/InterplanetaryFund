-- Offline proposal only. Apply with explicit migration authorization before enabling this UI.
-- Adds the original campaign wizard's persisted fields, without touching financial data.
alter table public.ifund_campaigns
  add column if not exists ai_profile jsonb not null default '{}'::jsonb,
  add column if not exists story_versions jsonb not null default '[]'::jsonb,
  add column if not exists draft_step smallint not null default 0,
  add column if not exists end_date date,
  add column if not exists location text not null default '',
  add column if not exists cover_image_is_ai boolean not null default false,
  add column if not exists accept_crypto_donations boolean not null default false;

-- Original UX: summary is optional when a story exists; public summary is derived
-- from the story at save time. A text-only description can be the full account.
alter table public.ifund_campaigns
  drop constraint if exists ifund_publish_complete;
alter table public.ifund_campaigns
  add constraint ifund_publish_complete check (
    status <> 'active' or
    (length(trim(title)) > 0 and length(trim(summary)) > 0 and goal_amount > 0)
  );
alter table public.ifund_campaigns
  add constraint ifund_draft_step_range check (draft_step between 0 and 3);
alter table public.ifund_campaigns
  add constraint ifund_ai_profile_object check (jsonb_typeof(ai_profile) = 'object');
alter table public.ifund_campaigns
  add constraint ifund_story_versions_array check (jsonb_typeof(story_versions) = 'array');

-- Allow private authenticated uploads only under the uploader's auth UUID folder.
-- Public-read cover art is required on public campaign cards, not private drafts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ifund-campaign-covers', 'ifund-campaign-covers', true, 8388608,
        array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do nothing;
create policy ifund_campaign_cover_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ifund-campaign-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
-- Storage is a public media bucket, but users cannot list other people's drafts.
-- Only the creator can remove media in their own UUID folder.
create policy ifund_campaign_cover_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'ifund-campaign-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);


-- User profile pictures are public media, with owner-only uploads.
-- Never use user_metadata fields as authorization claims.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('ifund-profile-images','ifund-profile-images',true,5242880,
        array['image/png','image/jpeg','image/webp']::text[])
on conflict (id) do nothing;
create policy ifund_profile_photo_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ifund-profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy ifund_profile_photo_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'ifund-profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Giving history is read-only and limited to the signed-in donor.
-- Do not alter the original payment ledger or permit browser-side writes.
grant select (
  id, campaign_id, donor_id, gift_cents, optional_support_cents,
  currency, status, created_at, captured_at
) on public.ifund_donations to authenticated;
create policy ifund_donations_donor_read
on public.ifund_donations for select to authenticated
using (donor_id = (select auth.uid()));


-- Independent follower relationships. Private to the member; no fake counts.
create table if not exists public.ifund_campaign_follows (
  campaign_id uuid not null references public.ifund_campaigns(id) on delete cascade,
  follower_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (campaign_id, follower_id)
);
create index if not exists ifund_campaign_follows_member_recent
  on public.ifund_campaign_follows(follower_id, created_at desc);
alter table public.ifund_campaign_follows enable row level security;
create policy ifund_follows_member_read on public.ifund_campaign_follows
  for select to authenticated using (follower_id = (select auth.uid()));
create policy ifund_follows_member_insert on public.ifund_campaign_follows
  for insert to authenticated with check (
    follower_id = (select auth.uid())
    and exists (
      select 1 from public.ifund_campaigns c
      where c.id = campaign_id and c.status = 'active'
    )
  );
create policy ifund_follows_member_delete on public.ifund_campaign_follows
  for delete to authenticated using (follower_id = (select auth.uid()));
grant select, insert, delete on public.ifund_campaign_follows to authenticated;


-- Private notifications and universal-inbox records. External provider messages
-- may only be created by an authenticated trusted backend after provider checks.
create table if not exists public.ifund_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'system' check (type in ('system','campaign','community','connection','agent')),
  title text not null check (char_length(trim(title)) between 1 and 180),
  body text not null default '' check (char_length(body) <= 2000),
  link text not null default '' check (char_length(link) <= 512 and (link = '' or (link like '/%' and link not like '//%'))),
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ifund_notifications_owner_recent
  on public.ifund_notifications(owner_id,created_at desc);
alter table public.ifund_notifications enable row level security;
create policy ifund_notifications_owner_select on public.ifund_notifications
  for select to authenticated using (owner_id = (select auth.uid()));
create policy ifund_notifications_owner_update on public.ifund_notifications
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
-- Grant only fields the user is allowed to mark read. No recipient, link,
-- type or title changes, and no browser INSERT rights.
grant select on public.ifund_notifications to authenticated;
grant update (read) on public.ifund_notifications to authenticated;

create table if not exists public.ifund_inbox_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (char_length(platform) between 1 and 80),
  source_ref text not null check (char_length(source_ref) between 1 and 255),
  subject text not null default '' check (char_length(subject) <= 300),
  body text not null default '' check (char_length(body) <= 8000),
  campaign_id uuid references public.ifund_campaigns(id) on delete set null,
  status text not null default 'open' check (status in ('open','done')),
  created_at timestamptz not null default now(),
  unique(owner_id,platform,source_ref)
);
create index if not exists ifund_inbox_owner_recent
  on public.ifund_inbox_items(owner_id,created_at desc);
alter table public.ifund_inbox_items enable row level security;
create policy ifund_inbox_owner_select on public.ifund_inbox_items
  for select to authenticated using (owner_id = (select auth.uid()));
create policy ifund_inbox_owner_update on public.ifund_inbox_items
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
grant select on public.ifund_inbox_items to authenticated;
grant update (status) on public.ifund_inbox_items to authenticated;
-- Provider webhook/connector service must validate signed claims before writing
-- to either table. No browser INSERT, DELETE, service credentials or fake data.


-- Restored six-stage onboarding preferences, with no delegated consent implied.
alter table public.ifund_profiles
  add column if not exists onboarding jsonb not null default '{}'::jsonb,
  add column if not exists onboarding_completed boolean not null default false;
alter table public.ifund_profiles
  add constraint ifund_onboarding_object check (jsonb_typeof(onboarding) = 'object');
-- Existing owner-only profile UPDATE/INSERT RLS continues to apply.
-- Delegated OAuth consent must be stored in separate server-verified grants;
-- onboarding checkbox preferences are never authorization.
