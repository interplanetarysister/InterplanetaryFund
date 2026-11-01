-- Zero-record private schema transfer into canonical IFund Supabase target.
-- Source: tzehxfikoslihnclhxuz business_mail/outreach_mail, 2026-10-27.
-- This does NOT switch mail delivery, migrate secrets/Auth, activate senders,
-- or port any privileged SECURITY DEFINER functions.
create schema if not exists business_mail;
create schema if not exists outreach_mail;
revoke all on schema business_mail from public,anon,authenticated,service_role;
revoke all on schema outreach_mail from public,anon,authenticated,service_role;

create table if not exists business_mail.mailboxes (
 id uuid primary key default gen_random_uuid(),
 organization_id text not null,
 owner_user_id text not null,
 local_part text not null check(local_part ~ '^[a-z0-9][a-z0-9._-]{0,62}$'),
 domain text not null default 'mail.interplanetaryfund.com' check(domain='mail.interplanetaryfund.com'),
 status text not null default 'reserved' check(status in ('reserved','active','suspended','closed')),
 entitlement_verified_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 paid_until timestamptz,grace_until timestamptz,
 stored_bytes bigint not null default 0 check(stored_bytes>=0),
 overflow_started_at timestamptz,
 unique(domain,local_part)
);
create table if not exists business_mail.addresses (
 id uuid primary key default gen_random_uuid(),
 mailbox_id uuid not null references business_mail.mailboxes(id),
 local_part text not null check(local_part ~ '^[a-z0-9][a-z0-9._-]{0,62}$'),
 domain text not null default 'mail.interplanetaryfund.com' check(domain='mail.interplanetaryfund.com'),
 status text not null default 'reserved' check(status in ('reserved','active','disabled')),
 created_at timestamptz not null default now(),
 unique(domain,local_part)
);
create table if not exists business_mail.messages (
 id uuid primary key default gen_random_uuid(),
 mailbox_id uuid not null references business_mail.mailboxes(id),
 provider_message_id text,
 direction text not null check(direction in ('incoming','outgoing')),
 envelope_from text not null,
 envelope_to text not null,
 subject text,body_object_key text,
 attachment_count integer not null default 0 check(attachment_count>=0),
 received_at timestamptz not null default now(),
 state text not null default 'received' check(state in ('received','quarantined','queued','sent','failed')),
 created_at timestamptz not null default now(),
 body_text text check(body_text is null or length(body_text)<=12000),
 stored_bytes bigint not null default 0 check(stored_bytes>=0),
 unique(mailbox_id,provider_message_id)
);
create index if not exists business_mail_messages_mailbox_received
 on business_mail.messages(mailbox_id,received_at desc);
create table if not exists business_mail.delivery_events (
 id uuid primary key default gen_random_uuid(),
 message_id uuid not null references business_mail.messages(id),
 event_kind text not null,
 event_time timestamptz not null default now(),
 provider_reference text,
 sanitized_detail jsonb not null default '{}'::jsonb
);

create table if not exists outreach_mail.connections (
 id uuid primary key default gen_random_uuid(),
 owner_user_id text not null,
 provider text not null check(provider in ('gmail','outlook','other')),
 provider_subject text not null,
 state text not null default 'pending' check(state in ('pending','connected','revoked','failed')),
 permitted_scopes text[] not null default '{}'::text[],
 created_at timestamptz not null default now(),
 revoked_at timestamptz,
 unique(owner_user_id,provider,provider_subject)
);
create table if not exists outreach_mail.contacts (
 id uuid primary key default gen_random_uuid(),
 owner_user_id text not null,
 email text not null,display_name text,
 source_connection_id uuid references outreach_mail.connections(id),
 solicitation_basis text not null default 'unverified'
  check(solicitation_basis in ('unverified','consent','existing_relationship','other_lawful_basis')),
 opt_out_at timestamptz,blocked_at timestamptz,
 created_at timestamptz not null default now(),
 unique(owner_user_id,email)
);
create table if not exists outreach_mail.campaigns (
 id uuid primary key default gen_random_uuid(),
 owner_user_id text not null,
 connection_id uuid not null references outreach_mail.connections(id),
 selection_mode text not null check(selection_mode in ('selected','agent_discretion')),
 authorization_state text not null default 'draft'
  check(authorization_state in ('draft','authorized','paused','revoked','completed')),
 purpose text not null,
 daily_limit integer not null default 10 check(daily_limit between 1 and 100),
 scope_approved_at timestamptz,authorization_expires_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists outreach_mail.recipients (
 campaign_id uuid not null references outreach_mail.campaigns(id),
 contact_id uuid not null references outreach_mail.contacts(id),
 selection_source text not null check(selection_source in ('user','agent')),
 selected_at timestamptz not null default now(),
 primary key(campaign_id,contact_id)
);
create table if not exists outreach_mail.actions (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references outreach_mail.campaigns(id),
 contact_id uuid references outreach_mail.contacts(id),
 action_kind text not null check(action_kind in
   ('draft','approval','send_requested','provider_sent','provider_failed','reply_seen','paused','revoked')),
 provider_message_ref text,
 created_at timestamptz not null default now()
);
alter table business_mail.mailboxes enable row level security;
alter table business_mail.addresses enable row level security;
alter table business_mail.messages enable row level security;
alter table business_mail.delivery_events enable row level security;
alter table outreach_mail.connections enable row level security;
alter table outreach_mail.contacts enable row level security;
alter table outreach_mail.campaigns enable row level security;
alter table outreach_mail.recipients enable row level security;
alter table outreach_mail.actions enable row level security;
revoke all on all tables in schema business_mail from public,anon,authenticated,service_role;
revoke all on all tables in schema outreach_mail from public,anon,authenticated,service_role;
revoke all on all sequences in schema business_mail from public,anon,authenticated,service_role;
revoke all on all sequences in schema outreach_mail from public,anon,authenticated,service_role;
comment on schema business_mail is 'Inactive IFund business mail schema transferred for one-project consolidation; no active mail delivery.';
comment on schema outreach_mail is 'Inactive outreach consent-gated structure; no automatic external mail sync or sending.';
