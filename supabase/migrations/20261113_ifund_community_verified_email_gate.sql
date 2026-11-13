-- Follow-up for canonical Interplanetary Fund community creation/join.
-- Require server-verified, non-anonymous, confirmed email as well as current terms.
create or replace function public.ifund_eligible_community_member(p_user uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select p_user = auth.uid()
    and ifund_private.verified_email_creator()
    and exists (select 1 from public.ifund_profiles p
                where p.id=p_user and p.account_status='active'
                  and p.account_deletion_pending=false)
    and exists (select 1 from public.ifund_legal_acceptances l
                where l.owner_id=p_user and l.explicit_consent=true
                  and l.terms_version='2026-11-10-v4')
$$;
revoke all on function public.ifund_eligible_community_member(uuid) from public;
grant execute on function public.ifund_eligible_community_member(uuid) to authenticated;