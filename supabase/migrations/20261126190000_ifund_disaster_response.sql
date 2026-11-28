-- Disaster-response workflow, Phase 1 (DB slice): alert + check-in storage,
-- the disaster_relief priority flag on campaigns, and the SECURITY DEFINER
-- RPCs the edge function and the client use. No money moves here and nothing
-- publishes externally; the owner's "yes" only flags the campaign and queues
-- a promotion draft in the existing editorial review table.
--
-- Every extension-dependent part is guarded so this migration also applies
-- in PGlite (which has no vault / pg_cron / pg_net): the vault secret is
-- created only when the vault extension exists, and the authorize function
-- resolves the vault lookup through dynamic SQL so the migration can be
-- created where vault is absent (it then fails closed, returning false).

create table if not exists public.ifund_disaster_alerts (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_event_id text not null,
  disaster_type text not null,
  severity text not null,
  title text not null,
  area_description text not null default '',
  geometry jsonb,
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique(source, source_event_id)
);

create table if not exists public.ifund_disaster_checkins (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.ifund_disaster_alerts(id) on delete cascade,
  campaign_id uuid not null references public.ifund_campaigns(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  notification_id uuid,
  status text not null default 'pending' check (status in ('pending', 'yes', 'no')),
  dedupe_key text,
  asked_at timestamptz not null default now(),
  answered_at timestamptz,
  unique(alert_id, campaign_id)
);

-- The dedupe key (campaign + normalized type + 1-degree area bucket) may
-- legitimately recur after the 72h window, so this index is deliberately
-- NOT unique; the per-event idempotency is the unique(alert_id, campaign_id)
-- constraint above.
create index if not exists ifund_disaster_checkins_dedupe_key_idx
  on public.ifund_disaster_checkins(dedupe_key);

alter table public.ifund_campaigns
  add column if not exists disaster_relief boolean not null default false,
  add column if not exists disaster_relief_since timestamptz;

-- Server-side only, following the ECHO pattern: no direct client access.
-- Reads/writes go through the service role and the SECURITY DEFINER RPCs
-- below (or the edge function via the service role).
alter table public.ifund_disaster_alerts enable row level security;
alter table public.ifund_disaster_checkins enable row level security;
revoke all on public.ifund_disaster_alerts from public, anon, authenticated;
revoke all on public.ifund_disaster_checkins from public, anon, authenticated;

-- Cron token secret, created only where the vault extension exists.
do $$
begin
  if exists(select 1 from pg_extension where extname = 'vault') then
    if not exists(select 1 from vault.secrets where name = 'ifund_disaster_cron_token') then
      perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'ifund_disaster_cron_token', 'Internal authenticated iFund disaster-watch cron');
    end if;
  end if;
end $$;

-- Token authorization for the disaster-watch edge function, service_role
-- only. Same mechanism as ifund_training_authorize: SHA-256 of the presented
-- token compared against the vault secret. It is plpgsql with a dynamic
-- vault lookup (rather than a literal language-sql copy of the training
-- function) because the literal form cannot even be CREATED where the vault
-- extension is absent — PGlite rejects it with
-- `relation "vault.decrypted_secrets" does not exist` — while this form
-- applies everywhere and fails closed (false) without vault.
create or replace function public.ifund_disaster_authorize(p_token text)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_ok boolean := false;
begin
  if p_token is null or length(p_token) <> 64 then
    return false;
  end if;
  if not exists(select 1 from pg_extension where extname = 'vault') then
    return false;
  end if;
  execute $vault$
    select exists(
      select 1 from vault.decrypted_secrets
      where name = 'ifund_disaster_cron_token'
        and encode(extensions.digest(convert_to($1, 'UTF8'), 'sha256'), 'hex') =
            encode(extensions.digest(convert_to(decrypted_secret, 'UTF8'), 'sha256'), 'hex')
    )
  $vault$ into v_ok using p_token;
  return coalesce(v_ok, false);
end
$$;
revoke all on function public.ifund_disaster_authorize(text) from public, anon, authenticated;
-- service_role exists on hosted Supabase but not in PGlite; grant only
-- where the role exists so this migration applies in both.
do $$
begin
  if exists(select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.ifund_disaster_authorize(text) to service_role;
  end if;
end $$;

-- Pending check-ins for the caller only.
create or replace function public.ifund_my_disaster_checkins()
returns table(
  checkin_id uuid,
  alert_id uuid,
  campaign_id uuid,
  campaign_title text,
  alert_title text,
  alert_area text,
  disaster_type text,
  severity text,
  asked_at timestamptz
)
language sql stable security definer set search_path = '' set row_security = 'off'
as $$
  select k.id, k.alert_id, k.campaign_id, c.title, a.title, a.area_description,
    a.disaster_type, a.severity, k.asked_at
  from public.ifund_disaster_checkins k
  join public.ifund_disaster_alerts a on a.id = k.alert_id
  join public.ifund_campaigns c on c.id = k.campaign_id
  where k.owner_id = auth.uid()
    and k.status = 'pending'
  order by k.asked_at desc;
$$;
revoke all on function public.ifund_my_disaster_checkins() from public, anon, authenticated;
grant execute on function public.ifund_my_disaster_checkins() to authenticated;

-- Answer a check-in. On 'yes' the campaign is flagged for disaster relief
-- and one promotion draft is queued in the editorial review table; on 'no'
-- the answer is recorded as final. Re-answering returns the current state
-- without re-applying any side effect.
create or replace function public.ifund_disaster_checkin_answer(p_checkin_id uuid, p_answer text)
returns table(
  checkin_id uuid,
  status text,
  campaign_id uuid,
  disaster_relief boolean
)
language plpgsql volatile security definer set search_path = '' set row_security = 'off'
as $$
#variable_conflict use_column
declare
  v_checkin public.ifund_disaster_checkins%rowtype;
  v_relief boolean;
begin
  if p_answer is null or p_answer not in ('yes', 'no') then
    raise exception 'Answer must be yes or no' using errcode = '22023';
  end if;
  select k.* into v_checkin
  from public.ifund_disaster_checkins k
  where k.id = p_checkin_id
    and k.owner_id = auth.uid()
  for update;
  if v_checkin.id is null then
    raise exception 'Check-in not found' using errcode = '42501';
  end if;
  if v_checkin.status <> 'pending' then
    -- Already answered: return the current state without side effects.
    select c.disaster_relief into v_relief
    from public.ifund_campaigns c where c.id = v_checkin.campaign_id;
    return query select v_checkin.id, v_checkin.status, v_checkin.campaign_id,
      coalesce(v_relief, false);
    return;
  end if;
  if p_answer = 'yes' then
    update public.ifund_campaigns c
    set disaster_relief = true, disaster_relief_since = now()
    where c.id = v_checkin.campaign_id;
    -- Promotion draft, same insert shape as
    -- ifund_queue_editorial_agent_review: the table is unique on
    -- (owner_id, campaign_id, finding_id), so a repeat insert is a no-op.
    insert into public.ifund_editorial_agent_reviews
      (owner_id, campaign_id, finding_id, lead_agent, task_title,
       suggested_action, review_agents, discussion, review_status)
    values (
      v_checkin.owner_id,
      v_checkin.campaign_id,
      'disaster_promotion_' || substr(v_checkin.id::text, 1, 8),
      'echo',
      'Draft disaster-relief promotion for the campaign',
      'Draft a short share post with the campaign link and image for IFund-owned channels. The owner authorized promotion by answering yes to the disaster check-in; do not publish anything without the promotion flow.',
      array['echo', 'story', 'nexus']::text[],
      pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'agent', 'echo',
          'kind', 'rule_based_proposal',
          'text', 'ECHO: Draft a short disaster-relief share post for this campaign (one concrete ask, campaign link, campaign image). Area verified by an authoritative alert; the need is the owner''s own statement.'
        )
      ),
      'queued'
    )
    on conflict (owner_id, campaign_id, finding_id) do nothing;
  end if;
  update public.ifund_disaster_checkins k
  set status = p_answer, answered_at = now()
  where k.id = v_checkin.id;
  select c.disaster_relief into v_relief
  from public.ifund_campaigns c where c.id = v_checkin.campaign_id;
  return query select v_checkin.id, p_answer, v_checkin.campaign_id,
    coalesce(v_relief, false);
end
$$;
revoke all on function public.ifund_disaster_checkin_answer(uuid, text) from public, anon, authenticated;
grant execute on function public.ifund_disaster_checkin_answer(uuid, text) to authenticated;

-- Flagged campaigns for the verified super-admin, each joined to its latest
-- 'yes' check-in for the alert fields. This is the "expedited review" list:
-- no separate review queue exists.
create or replace function public.ifund_disaster_relief_campaigns()
returns table(
  campaign_id uuid,
  campaign_title text,
  owner_id uuid,
  alert_title text,
  alert_area text,
  disaster_type text,
  flagged_at timestamptz
)
language plpgsql stable security definer set search_path = '' set row_security = 'off'
as $$
begin
  if not coalesce(public.ifund_current_user_is_verified_super_admin(), false) then
    raise exception 'Verified super-admin required' using errcode = '42501';
  end if;
  return query
    select latest.campaign_id, latest.campaign_title, latest.owner_id,
      latest.alert_title, latest.alert_area, latest.disaster_type,
      latest.flagged_at
    from (
      select distinct on (c.id)
        c.id as campaign_id, c.title as campaign_title, c.owner_id,
        a.title as alert_title, a.area_description as alert_area,
        a.disaster_type, c.disaster_relief_since as flagged_at
      from public.ifund_campaigns c
      join public.ifund_disaster_checkins k
        on k.campaign_id = c.id and k.status = 'yes'
      join public.ifund_disaster_alerts a on a.id = k.alert_id
      where c.disaster_relief = true
      order by c.id, k.answered_at desc nulls last
    ) latest
    order by latest.flagged_at desc nulls last;
end
$$;
revoke all on function public.ifund_disaster_relief_campaigns() from public, anon, authenticated;
grant execute on function public.ifund_disaster_relief_campaigns() to authenticated;

-- Super-admin revocation of a disaster-relief flag. The spec promises a
-- super-admin can revoke a disaster flag: clearing it removes the Discover
-- boost and the badge (both render off disaster_relief = true) and deletes
-- any not-yet-posted promotion drafts for the campaign. A draft counts as
-- not-yet-posted while its review_status is anything but 'acknowledged'
-- (queued / under_review / owner_action_needed); acknowledged drafts are
-- left alone. The check-in rows stay as the consent history, and the
-- campaign drops out of ifund_disaster_relief_campaigns() because that
-- listing filters on disaster_relief = true. Idempotent on an already
-- unflagged campaign; unknown campaign ids are rejected.
create or replace function public.ifund_disaster_revoke_relief(p_campaign_id uuid)
returns table(
  campaign_id uuid,
  disaster_relief boolean
)
language plpgsql volatile security definer set search_path = '' set row_security = 'off'
as $$
#variable_conflict use_column
declare
  v_found boolean;
begin
  if not coalesce(public.ifund_current_user_is_verified_super_admin(), false) then
    raise exception 'Verified super-admin required' using errcode = '42501';
  end if;
  update public.ifund_campaigns c
  set disaster_relief = false, disaster_relief_since = null
  where c.id = p_campaign_id
  returning true into v_found;
  if v_found is null then
    raise exception 'Campaign not found' using errcode = '42501';
  end if;
  delete from public.ifund_editorial_agent_reviews r
  where r.campaign_id = p_campaign_id
    and r.finding_id like 'disaster_promotion\_%'
    and r.review_status <> 'acknowledged';
  return query select p_campaign_id, false;
end
$$;
revoke all on function public.ifund_disaster_revoke_relief(uuid) from public, anon, authenticated;
grant execute on function public.ifund_disaster_revoke_relief(uuid) to authenticated;
