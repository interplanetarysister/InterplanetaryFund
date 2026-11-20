-- Keep read, write and removal membership gates identical.
-- A lingering token from a pending/deleted account cannot modify fundraising references.
alter policy ifund_external_groups_owner_update on public.ifund_external_fundraiser_groups
 using (owner_id=auth.uid() and exists (select 1 from public.ifund_profiles p where p.id=auth.uid() and p.account_status='active' and p.account_deletion_pending=false))
 with check (owner_id=auth.uid() and exists (select 1 from public.ifund_profiles p where p.id=auth.uid() and p.account_status='active' and p.account_deletion_pending=false));
alter policy ifund_external_groups_owner_delete on public.ifund_external_fundraiser_groups
 using (owner_id=auth.uid() and exists (select 1 from public.ifund_profiles p where p.id=auth.uid() and p.account_status='active' and p.account_deletion_pending=false));
alter policy ifund_external_sources_owner_update on public.ifund_external_fundraiser_sources
 using (owner_id=auth.uid() and exists (select 1 from public.ifund_profiles p where p.id=auth.uid() and p.account_status='active' and p.account_deletion_pending=false))
 with check (owner_id=auth.uid() and provenance='owner_reported' and exists (select 1 from public.ifund_profiles p where p.id=auth.uid() and p.account_status='active' and p.account_deletion_pending=false));
alter policy ifund_external_sources_owner_delete on public.ifund_external_fundraiser_sources
 using (owner_id=auth.uid() and exists (select 1 from public.ifund_profiles p where p.id=auth.uid() and p.account_status='active' and p.account_deletion_pending=false));
