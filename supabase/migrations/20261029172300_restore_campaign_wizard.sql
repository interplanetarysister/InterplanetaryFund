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
