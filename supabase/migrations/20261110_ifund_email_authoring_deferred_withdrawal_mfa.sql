-- IFund account model: anonymous sessions for visitors; verified email for authoring;
-- step-up MFA (aal2) for first and subsequent withdrawal requests.
-- Protect at the database boundary, never only from React.
create schema if not exists ifund_private;
revoke all on schema ifund_private from public, anon;
grant usage on schema ifund_private to authenticated;

create or replace function ifund_private.verified_email_creator()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users as u
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
      and u.is_anonymous is false
  );
$$;
revoke all on function ifund_private.verified_email_creator() from public, anon;
grant execute on function ifund_private.verified_email_creator() to authenticated;

create or replace function ifund_private.withdrawal_mfa_ready()
returns boolean language sql stable security definer set search_path = ''
as $$
  select ifund_private.verified_email_creator()
    and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;
revoke all on function ifund_private.withdrawal_mfa_ready() from public, anon;
grant execute on function ifund_private.withdrawal_mfa_ready() to authenticated;

-- RESTRICTIVE policies cannot open access and compose safely with existing
-- owner, lifecycle, and current-terms policies. They also cover other clients
-- using a direct Supabase API rather than this frontend.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'ifund_campaigns', 'ifund_posts', 'ifund_campaign_creation_state',
    'ifund_campaign_translation', 'ifund_campaign_update', 'ifund_profiles'
  ]
  loop
    execute format('drop policy if exists ifund_email_content_insert on public.%I', tbl);
    execute format(
      'create policy ifund_email_content_insert on public.%I as restrictive for insert to authenticated with check (ifund_private.verified_email_creator())',
      tbl
    );
    execute format('drop policy if exists ifund_email_content_update on public.%I', tbl);
    execute format(
      'create policy ifund_email_content_update on public.%I as restrictive for update to authenticated using (ifund_private.verified_email_creator()) with check (ifund_private.verified_email_creator())',
      tbl
    );
    execute format('drop policy if exists ifund_email_content_delete on public.%I', tbl);
    execute format(
      'create policy ifund_email_content_delete on public.%I as restrictive for delete to authenticated using (ifund_private.verified_email_creator())',
      tbl
    );
  end loop;
end $$;

comment on function ifund_private.verified_email_creator() is
  'Signed-in verified email account required for campaign/post/profile authorship; anonymous accounts cannot write content.';
comment on function ifund_private.withdrawal_mfa_ready() is
  'Requires verified email plus JWT aal2. Financial payout processors must additionally verify identity, ownership and balance server-side.';
