-- A generic user's provider OAuth session is not proof that an official
-- iFund brand account can publish. Only trusted provider-verified exact
-- connection+owner+subject mapping may count as a brand account grant.
create table if not exists ifund_ops.official_outreach_verified_grants(
 provider text primary key references ifund_ops.official_outreach_account_candidates(provider),
 owner_id uuid not null references auth.users(id) on delete cascade,
 connection_id uuid not null unique references public.ifund_connections(id) on delete cascade,
 provider_subject text not null check(char_length(provider_subject) between 2 and 255),
 verified_at timestamptz not null,
 revoked_at timestamptz,
 updated_at timestamptz not null default now()
);
revoke all on ifund_ops.official_outreach_verified_grants
 from public,anon,authenticated;
alter table ifund_ops.official_outreach_verified_grants enable row level security;
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
   (select count(*)::integer from ifund_ops.official_outreach_verified_grants g
     join public.ifund_connections conn on conn.id=g.connection_id
      and conn.owner_id=g.owner_id and conn.provider=g.provider
      and conn.status='connected' and conn.verified_at is not null
     where g.provider=c.provider and g.revoked_at is null
       and g.verified_at is not null),
   c.verification_notes
 from ifund_ops.official_outreach_account_candidates c
 order by c.provider;
end $$;


