-- Keep first live card checkout behind a private, explicit test-account allowlist.
-- Never give service_role broad SELECT on auth.users.
create table if not exists ifund_subscription_runtime.premium_checkout_trial_members (
 member_id uuid primary key references auth.users(id) on delete cascade,
 approved_at timestamptz not null default now()
);
alter table ifund_subscription_runtime.premium_checkout_trial_members enable row level security;
revoke all on ifund_subscription_runtime.premium_checkout_trial_members from public,anon,authenticated;
grant select on ifund_subscription_runtime.premium_checkout_trial_members to service_role;
create or replace function public.ifund_premium_one_time_test_eligible(p_member_id uuid)
returns boolean language sql stable security invoker set search_path=''
as $$
 select exists(select 1 from ifund_subscription_runtime.premium_checkout_trial_members t
 where t.member_id=p_member_id);
$$;
revoke all on function public.ifund_premium_one_time_test_eligible(uuid)
 from public,anon,authenticated;
grant execute on function public.ifund_premium_one_time_test_eligible(uuid) to service_role;
