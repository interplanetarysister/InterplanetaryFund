-- STAGED ONLY. Original FoundingWaitlist is PRIVATE and must not
-- accept direct browser inserts. Join endpoint requires separately audited
-- rate limiting, consent, bot control, referral integrity and mail handling.
begin;
create table public.ifund_founding_waitlist (
 id uuid primary key default gen_random_uuid(),
 email text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and length(email)<=254),
 screen_name text check (char_length(screen_name)<=50),
 interest text not null check (interest in ('support','fundraise','both')),
 marketing_opt_in boolean not null default false,
 explicit_consent boolean not null check (explicit_consent=true),
 consent_accepted_at timestamptz not null,
 referral_code text not null check (char_length(referral_code) between 6 and 72),
 referred_by text check (char_length(referred_by)<=72),
 status text not null default 'waiting' check (status in ('waiting','invited','approved')),
 joined_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create unique index ifund_waitlist_email_unique on public.ifund_founding_waitlist(lower(email));
create unique index ifund_waitlist_referral_unique on public.ifund_founding_waitlist(referral_code);
create index ifund_waitlist_joined_idx on public.ifund_founding_waitlist(joined_at desc);
alter table public.ifund_founding_waitlist enable row level security;
revoke all on public.ifund_founding_waitlist from public,anon,authenticated;
grant select on public.ifund_founding_waitlist to authenticated;
grant update(status) on public.ifund_founding_waitlist to authenticated;
create policy ifund_waitlist_admin_read on public.ifund_founding_waitlist
 for select to authenticated
 using ((select auth.jwt()->'app_metadata'->>'role') in ('admin','super_admin'));
create policy ifund_waitlist_admin_status on public.ifund_founding_waitlist
 for update to authenticated
 using ((select auth.jwt()->'app_metadata'->>'role') in ('admin','super_admin'))
 with check ((select auth.jwt()->'app_metadata'->>'role') in ('admin','super_admin'));
-- A queue-status change does not send an invitation, confirm an email,
-- create an Auth account, authorize fundraising or enroll subscriptions.
-- No public inserts and no user-side role or referral writes.
commit;
