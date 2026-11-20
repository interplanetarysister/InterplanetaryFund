-- Official-account recovery leads are NOT OAuth connections or permission grants.
-- Legacy display statuses can be stale and are never promoted to 'connected'.
create table if not exists ifund_ops.official_outreach_account_candidates(
 provider text primary key,
 display_name text not null,
 historical_handle text not null,
 historical_url text,
 historical_login_email text not null,
 legacy_claim text not null check(legacy_claim in('historical_active','historical_pending')),
 source_repository_path text not null,
 review_status text not null default 'unverified'
    check(review_status in('unverified','needs_login','provider_verification_required','unsupported')),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 verification_notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
revoke all on ifund_ops.official_outreach_account_candidates
 from public,anon,authenticated;
alter table ifund_ops.official_outreach_account_candidates enable row level security;
insert into ifund_ops.official_outreach_account_candidates
(provider,display_name,historical_handle,historical_url,historical_login_email,legacy_claim,source_repository_path)
values
('facebook','Interplanetary Fund','@InterplanetaryFund','https://facebook.com/interplanetaryfund','cuddlemeplatonically@gmail.com','historical_active','interplanetarysister/interplanetaryfund1/src/components/PlatformAccountsSheet.tsx'),
('x','Interplanetary Fund','@InterplanetaryFnd','https://twitter.com/interplanetaryfnd','cuddlemeplatonically@gmail.com','historical_active','interplanetarysister/interplanetaryfund1/src/components/PlatformAccountsSheet.tsx'),
('instagram','Interplanetary Fund','@interplanetaryfund','https://instagram.com/interplanetaryfund','cuddlemeplatonically@gmail.com','historical_pending','interplanetarysister/interplanetaryfund1/src/components/PlatformAccountsSheet.tsx'),
('whatsapp','Interplanetary Fund Group','Interplanetary Fund Group',null,'cuddlemeplatonically@gmail.com','historical_active','interplanetarysister/interplanetaryfund1/src/components/PlatformAccountsSheet.tsx'),
('github','Interplanetary Fund','interplanetarysister','https://github.com/interplanetarysister','cuddlemeplatonically@gmail.com','historical_active','interplanetarysister/interplanetaryfund1/src/components/PlatformAccountsSheet.tsx'),
('gofundme','Interplanetary Fund','Interplanetary Fund','https://gofundme.com','cuddlemeplatonically@gmail.com','historical_active','interplanetarysister/interplanetaryfund1/src/components/PlatformAccountsSheet.tsx'),
('patreon','Interplanetary Fund','interplanetaryfund','https://patreon.com','cuddlemeplatonically@gmail.com','historical_active','interplanetarysister/interplanetaryfund1/src/components/PlatformAccountsSheet.tsx'),
('buymeacoffee','Interplanetary Fund','interplanetaryfund','https://buymeacoffee.com','cuddlemeplatonically@gmail.com','historical_active','interplanetarysister/interplanetaryfund1/src/components/PlatformAccountsSheet.tsx'),
('kofi','Interplanetary Fund','interplanetaryfund','https://ko-fi.com','cuddlemeplatonically@gmail.com','historical_active','interplanetarysister/interplanetaryfund1/src/components/PlatformAccountsSheet.tsx'),
('spotfund','Interplanetary Fund','interplanetaryfund','https://spotfund.com','cuddlemeplatonically@gmail.com','historical_pending','interplanetarysister/interplanetaryfund1/src/components/PlatformAccountsSheet.tsx'),
('fundrazr','Interplanetary Fund','interplanetaryfund','https://fundrazr.com','cuddlemeplatonically@gmail.com','historical_pending','interplanetarysister/interplanetaryfund1/src/components/PlatformAccountsSheet.tsx'),
('givesendgo','Interplanetary Fund','interplanetaryfund','https://givesendgo.com','cuddlemeplatonically@gmail.com','historical_pending','interplanetarysister/interplanetaryfund1/src/components/PlatformAccountsSheet.tsx'),
('indiegogo','Interplanetary Fund','interplanetaryfund','https://indiegogo.com','cuddlemeplatonically@gmail.com','historical_pending','interplanetarysister/interplanetaryfund1/src/components/PlatformAccountsSheet.tsx'),
('kickstarter','Interplanetary Fund','interplanetaryfund','https://kickstarter.com','cuddlemeplatonically@gmail.com','historical_pending','interplanetarysister/interplanetaryfund1/src/components/PlatformAccountsSheet.tsx'),
('bluesky','Interplanetary Fund','interplanetaryfund.bsky.social','https://bsky.app/profile/interplanetaryfund.bsky.social','cuddlemeplatonically@gmail.com','historical_active','interplanetarysister/interplanetaryfund1/src/components/PlatformAccountsSheet.tsx')
on conflict(provider) do nothing;

create or replace function public.ifund_admin_outreach_candidates()
returns table(
 provider text,display_name text,historical_handle text,historical_url text,
 historical_login_email text,legacy_claim text,review_status text,
 source_repository_path text,verified_provider_connections integer,
 verification_notes text
)
language plpgsql stable security definer
set search_path='' set row_security='off'
as $$
begin
 if not coalesce(public.ifund_current_user_is_verified_admin(),false)
 then raise exception 'Verified iFund admin required' using errcode='42501';end if;
 return query select c.provider,c.display_name,c.historical_handle,
   c.historical_url,c.historical_login_email,c.legacy_claim,c.review_status,
   c.source_repository_path,
   (select count(*)::integer from public.ifund_connections conn
     where conn.provider=c.provider and conn.status='connected'
       and conn.verified_at is not null),
   c.verification_notes
 from ifund_ops.official_outreach_account_candidates c
 order by c.provider;
end $$;

create or replace function public.ifund_admin_review_outreach_candidate(
 p_provider text,p_review_status text,p_notes text default null
) returns jsonb
language plpgsql volatile security definer
set search_path='' set row_security='off' set lock_timeout='3s'
as $$
declare v_actor uuid:=auth.uid();
 v_candidate ifund_ops.official_outreach_account_candidates%rowtype;
begin
 if v_actor is null or
    not coalesce(public.ifund_current_user_is_verified_admin(),false)
 then raise exception 'Verified iFund admin required' using errcode='42501';end if;
 if p_review_status not in
   ('unverified','needs_login','provider_verification_required','unsupported')
   or char_length(coalesce(p_notes,''))>700
 then raise exception 'Invalid account review' using errcode='22023';end if;
 update ifund_ops.official_outreach_account_candidates
 set review_status=p_review_status,verification_notes=nullif(btrim(p_notes),''),
     reviewed_at=now(),reviewed_by=v_actor,updated_at=now()
 where provider=p_provider
 returning * into v_candidate;
 if not found then raise exception 'Unknown provider account' using errcode='22023';end if;
 return jsonb_build_object('provider',v_candidate.provider,
   'review_status',v_candidate.review_status,'reviewed_at',v_candidate.reviewed_at,
   'connected',false,'publish_granted',false);
end $$;
revoke all on function public.ifund_admin_outreach_candidates()
 from public,anon,authenticated;
revoke all on function public.ifund_admin_review_outreach_candidate(text,text,text)
 from public,anon,authenticated;
grant execute on function public.ifund_admin_outreach_candidates() to authenticated;
grant execute on function public.ifund_admin_review_outreach_candidate(text,text,text) to authenticated;
