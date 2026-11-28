-- ============================================================================
-- Supabase Migration: Michelle Rogers Executive Intelligence System
-- Version: 20261124000000
-- Purpose: Persistent executive identity, 30-dept academy, corporate facts,
--          investor CRM, governance gateway, RLS and audit trails.
-- ============================================================================

-- 1. Executive Identities
create table if not exists public.executive_identities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  title text not null,
  organization text not null default 'Interplanetary Fund',
  email text,
  email_verified boolean not null default false,
  avatar_url text,
  bio text not null,
  status text not null check (status in ('active', 'training', 'suspended', 'retired')) default 'training',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Executive Objectives
create table if not exists public.executive_objectives (
  id uuid primary key default gen_random_uuid(),
  executive_id uuid not null references public.executive_identities(id) on delete cascade,
  title text not null,
  description text not null,
  target_amount numeric(14,2) default 0.00,
  current_verified_amount numeric(14,2) not null default 0.00,
  currency text not null default 'USD',
  category text not null check (category in ('capital_acquisition', 'partnerships', 'sponsorships', 'grants', 'governance', 'education')),
  status text not null check (status in ('active', 'achieved', 'paused', 'cancelled')) default 'active',
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Executive Tasks
create table if not exists public.executive_tasks (
  id uuid primary key default gen_random_uuid(),
  executive_id uuid not null references public.executive_identities(id) on delete cascade,
  objective_id uuid references public.executive_objectives(id) on delete set null,
  title text not null,
  description text not null,
  priority text not null check (priority in ('low', 'medium', 'high', 'urgent')) default 'medium',
  status text not null check (status in ('pending', 'in_progress', 'completed', 'blocked', 'failed', 'cancelled')) default 'pending',
  lease_owner text,
  lease_expires_at timestamptz,
  result jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Corporate Facts (Verified Truth Engine)
create table if not exists public.corporate_facts (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  predicate text not null,
  value text not null,
  currency text,
  numeric_value numeric(14,2),
  truth_class text not null check (truth_class in ('verified_fact', 'approved_plan', 'projection_assumption', 'unknown_unverified')),
  effective_date date not null default current_date,
  source_uri text not null,
  confidentiality_level text not null check (confidentiality_level in ('public', 'confidential', 'restricted_investor', 'board_only')) default 'confidential',
  responsible_owner text not null,
  verification_date date not null default current_date,
  review_due_date date not null default (current_date + interval '90 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Educational Departments (MR-001 through MR-030)
create table if not exists public.educational_departments (
  id uuid primary key default gen_random_uuid(),
  dept_code text unique not null check (dept_code ~ '^MR-[0-9]{3}$'),
  name text not null,
  description text not null,
  category text not null,
  learning_objectives jsonb not null default '[]'::jsonb,
  prerequisites jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- 6. Educational Modules
create table if not exists public.educational_modules (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.educational_departments(id) on delete cascade,
  level text not null check (level in ('foundational', 'intermediate', 'advanced')),
  title text not null,
  description text not null,
  concepts jsonb not null default '[]'::jsonb,
  practical_techniques jsonb not null default '[]'::jsonb,
  decision_frameworks jsonb not null default '[]'::jsonb,
  references_list jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- 7. Educational Source Registry
create table if not exists public.educational_source_registry (
  id uuid primary key default gen_random_uuid(),
  institution text not null,
  resource_title text not null,
  author text,
  original_url text not null,
  publication_date date,
  retrieval_date date not null default current_date,
  license text not null,
  commercial_reuse_permitted boolean not null default false,
  ai_ingestion_permitted boolean not null default false,
  attribution_requirements text,
  verification_status text not null check (verification_status in ('verified', 'pending_review', 'restricted', 'expired')) default 'verified',
  next_review_date date not null default (current_date + interval '180 days'),
  created_at timestamptz not null default now()
);

-- 8. Simulation Scenarios
create table if not exists public.simulation_scenarios (
  id uuid primary key default gen_random_uuid(),
  scenario_code text unique not null,
  name text not null,
  category text not null,
  persona_description text not null,
  counterparty_style text not null,
  prompt text not null,
  redline_criteria jsonb not null default '[]'::jsonb,
  difficulty text not null check (difficulty in ('foundational', 'intermediate', 'advanced', 'expert')) default 'intermediate',
  held_out boolean not null default false,
  created_at timestamptz not null default now()
);

-- 9. Training Sessions
create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  executive_id uuid not null references public.executive_identities(id) on delete cascade,
  scenario_id uuid references public.simulation_scenarios(id) on delete set null,
  transcript jsonb not null default '[]'::jsonb,
  score numeric(5,2),
  passed boolean not null default false,
  feedback text,
  evaluated_by text not null default 'independent_evaluator',
  created_at timestamptz not null default now()
);

-- 10. Competency Evaluations
create table if not exists public.competency_evaluations (
  id uuid primary key default gen_random_uuid(),
  executive_id uuid not null references public.executive_identities(id) on delete cascade,
  department_id uuid references public.educational_departments(id) on delete cascade,
  evaluation_type text not null check (evaluation_type in ('written_exam', 'scenario_simulation', 'case_study', 'oral_defense', 'comprehensive_benchmark')),
  score numeric(5,2) not null,
  threshold numeric(5,2) not null default 95.00,
  rubric_results jsonb not null default '{}'::jsonb,
  passed boolean not null default false,
  remedial_required boolean not null default false,
  evaluator_version text not null default 'evaluator-v1',
  created_at timestamptz not null default now()
);

-- 11. Professional Contacts
create table if not exists public.professional_contacts (
  id uuid primary key default gen_random_uuid(),
  executive_id uuid not null references public.executive_identities(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  organization text,
  role text,
  email text,
  phone text,
  location text,
  linkedin_url text,
  communication_preferences jsonb not null default '{}'::jsonb,
  source_evidence text,
  relationship_stage text not null check (relationship_stage in ('identified', 'researching', 'relationship_developing', 'qualified', 'introduction_requested', 'conversation_established', 'meeting_scheduled', 'pitch_invited', 'due_diligence', 'terms_under_discussion', 'nonbinding_interest', 'committed', 'documents_executed', 'funds_received', 'declined', 'deferred', 'long_term_relationship')) default 'identified',
  tags text[] default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 12. Professional Interactions
create table if not exists public.professional_interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.professional_contacts(id) on delete cascade,
  executive_id uuid not null references public.executive_identities(id) on delete cascade,
  channel text not null check (channel in ('email', 'calendar', 'phone', 'video_meeting', 'linkedin', 'facebook', 'in_person', 'portal')),
  direction text not null check (direction in ('inbound', 'outbound', 'internal_memo')),
  subject text,
  summary text not null,
  full_text text,
  commitments_made text,
  follow_up_due date,
  created_at timestamptz not null default now()
);

-- 13. Investor Profiles
create table if not exists public.investor_profiles (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.professional_contacts(id) on delete cascade,
  organization text not null,
  investor_type text not null check (investor_type in ('angel', 'angel_group', 'micro_vc', 'seed_vc', 'family_office', 'strategic_corporate', 'grantor', 'sponsor', 'accelerator', 'incubator')),
  stage_preferences text[] not null default array['pre_seed', 'seed']::text[],
  sector_preferences text[] not null default array['fintech', 'ai', 'fundraising']::text[],
  typical_check_min numeric(14,2),
  typical_check_max numeric(14,2),
  check_size_source text,
  geography text,
  fit_score numeric(5,2),
  fit_breakdown jsonb not null default '{}'::jsonb,
  accreditation_verified boolean not null default false,
  lead_interest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 14. Funding Opportunities
create table if not exists public.funding_opportunities (
  id uuid primary key default gen_random_uuid(),
  executive_id uuid not null references public.executive_identities(id) on delete cascade,
  investor_id uuid references public.investor_profiles(id) on delete set null,
  title text not null,
  opportunity_type text not null check (opportunity_type in ('equity_lead', 'equity_angel', 'grant', 'sponsorship', 'accelerator')),
  target_amount numeric(14,2) not null default 0.00,
  committed_amount numeric(14,2) not null default 0.00,
  received_amount numeric(14,2) not null default 0.00,
  status text not null check (status in ('identified', 'researching', 'relationship_developing', 'qualified', 'introduction_requested', 'conversation_established', 'meeting_scheduled', 'pitch_invited', 'due_diligence', 'terms_under_discussion', 'nonbinding_interest', 'committed', 'documents_executed', 'funds_received', 'declined', 'deferred', 'long_term_relationship')) default 'identified',
  probability numeric(5,2) not null default 0.00,
  documents jsonb not null default '[]'::jsonb,
  next_action text,
  next_action_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 15. Funding Confirmations (Independent Verifications Only)
create table if not exists public.funding_confirmations (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.funding_opportunities(id) on delete cascade,
  verified_amount numeric(14,2) not null,
  currency text not null default 'USD',
  verification_type text not null check (verification_type in ('bank_statement', 'escrow_receipt', 'grant_disbursement', 'accounting_ledger')),
  verified_by_user_id uuid references auth.users(id) on delete set null,
  verified_at timestamptz not null default now(),
  confirmation_reference text not null unique,
  notes text,
  created_at timestamptz not null default now()
);

-- 16. Communication Suppressions (Anti-Spam / Opt-Out Engine)
create table if not exists public.communication_suppressions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.professional_contacts(id) on delete set null,
  identifier text not null,
  channel text not null check (channel in ('all', 'email', 'phone', 'sms', 'social_fb', 'social_li')),
  opt_out_type text not null check (opt_out_type in ('all', 'marketing', 'investment', 'calls', 'unsolicited')),
  reason text,
  source text not null,
  scope text not null default 'global',
  irreversible_until_review boolean not null default true,
  created_at timestamptz not null default now()
);

-- 17. Executive Correspondence
create table if not exists public.executive_correspondence (
  id uuid primary key default gen_random_uuid(),
  executive_id uuid not null references public.executive_identities(id) on delete cascade,
  contact_id uuid references public.professional_contacts(id) on delete set null,
  channel text not null check (channel in ('email', 'calendar', 'linkedin', 'facebook')),
  direction text not null check (direction in ('inbound', 'outbound')),
  subject text,
  body text not null,
  draft_status text not null check (draft_status in ('draft', 'approval_pending', 'approved', 'rejected', 'sent', 'failed')) default 'draft',
  approval_id uuid,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- 18. Executive Meetings (/investor-meeting route)
create table if not exists public.executive_meetings (
  id uuid primary key default gen_random_uuid(),
  executive_id uuid not null references public.executive_identities(id) on delete cascade,
  contact_id uuid references public.professional_contacts(id) on delete set null,
  title text not null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  access_token text unique not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  meeting_route text not null default '/investor-meeting',
  status text not null check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')) default 'scheduled',
  agenda text,
  transcript jsonb not null default '[]'::jsonb,
  summary text,
  action_items jsonb not null default '[]'::jsonb,
  consent_recorded boolean not null default false,
  created_at timestamptz not null default now()
);

-- 19. Data Room Documents
create table if not exists public.data_room_documents (
  id uuid primary key default gen_random_uuid(),
  folder_name text not null check (folder_name in ('00_Summary', '01_Governance', '02_Cap_Table_and_Securities', '03_Financials_and_Projections', '04_Contracts_and_Partnerships', '05_IP_and_Technology', '06_HR_and_Advisors')),
  file_name text not null,
  title text not null,
  description text not null,
  confidentiality_level text not null check (confidentiality_level in ('public', 'confidential', 'restricted_investor', 'board_only')) default 'confidential',
  file_path text,
  file_size_bytes bigint,
  mime_type text default 'application/pdf',
  version text not null default 'v1.0',
  verification_status text not null check (verification_status in ('verified_uploaded', 'pending_upload', 'missing_requirement', 'redacted')) default 'verified_uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 20. Data Room Access Grants
create table if not exists public.data_room_access_grants (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.data_room_documents(id) on delete cascade,
  contact_id uuid references public.professional_contacts(id) on delete cascade,
  access_token text unique not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked boolean not null default false,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- 21. Compliance Policies
create table if not exists public.compliance_policies (
  id uuid primary key default gen_random_uuid(),
  policy_code text unique not null,
  domain text not null check (domain in ('securities_sec', 'securities_wa_dfi', 'can_spam', 'tcpa', 'ai_voice', 'confidentiality', 'broker_dealer', 'platform_rules')),
  description text not null,
  rule_definition jsonb not null default '{}'::jsonb,
  enforcement_action text not null check (enforcement_action in ('block', 'flag_approval', 'log')) default 'block',
  is_active boolean not null default true,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 22. Executive Approval Requests
create table if not exists public.executive_approval_requests (
  id uuid primary key default gen_random_uuid(),
  executive_id uuid not null references public.executive_identities(id) on delete cascade,
  action_type text not null,
  description text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('pending', 'approved', 'rejected', 'expired')) default 'pending',
  requested_by text not null default 'michelle-rogers',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours')
);

-- 23. Executive Audit Events (Append-Only Log)
create table if not exists public.executive_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_timestamp timestamptz not null default now(),
  actor text not null,
  requested_action text not null,
  source_context text,
  model_version text,
  tool text,
  permissions_used text[] default array[]::text[],
  payload_summary text,
  recipient text,
  approval_state text,
  result text not null,
  rollback_reference_id text,
  created_at timestamptz not null default now()
);

-- 24. Executive Operating Modes & Emergency Stop
create table if not exists public.executive_operating_modes (
  id uuid primary key default gen_random_uuid(),
  executive_id uuid not null references public.executive_identities(id) on delete cascade,
  mode text not null check (mode in ('training', 'research', 'draft', 'supervised', 'limited_autonomous')) default 'training',
  emergency_stop_active boolean not null default false,
  emergency_stop_reason text,
  emergency_stop_at timestamptz,
  daily_budget_usd numeric(8,2) not null default 5.00,
  current_daily_spend_usd numeric(8,2) not null default 0.00,
  updated_at timestamptz not null default now()
);

-- Security Trigger: Immutability of Executive Audit Trail
create or replace function public.enforce_executive_audit_immutability()
returns trigger language plpgsql as $$
begin
  raise exception 'Executive audit events are immutable append-only records and cannot be updated or deleted.';
end;
$$;

drop trigger if exists trg_executive_audit_immutable on public.executive_audit_events;
create trigger trg_executive_audit_immutable
before update or delete on public.executive_audit_events
for each row execute function public.enforce_executive_audit_immutability();

-- RLS Setup: Deny all by default, restrict to superadmin/server
alter table public.executive_identities enable row level security;
alter table public.executive_objectives enable row level security;
alter table public.executive_tasks enable row level security;
alter table public.corporate_facts enable row level security;
alter table public.educational_departments enable row level security;
alter table public.educational_modules enable row level security;
alter table public.educational_source_registry enable row level security;
alter table public.simulation_scenarios enable row level security;
alter table public.training_sessions enable row level security;
alter table public.competency_evaluations enable row level security;
alter table public.professional_contacts enable row level security;
alter table public.professional_interactions enable row level security;
alter table public.investor_profiles enable row level security;
alter table public.funding_opportunities enable row level security;
alter table public.funding_confirmations enable row level security;
alter table public.communication_suppressions enable row level security;
alter table public.executive_correspondence enable row level security;
alter table public.executive_meetings enable row level security;
alter table public.data_room_documents enable row level security;
alter table public.data_room_access_grants enable row level security;
alter table public.compliance_policies enable row level security;
alter table public.executive_approval_requests enable row level security;
alter table public.executive_audit_events enable row level security;
alter table public.executive_operating_modes enable row level security;

-- Super-admin policy helper
create or replace function public.ifund_is_super_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.admin_roles
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;

revoke all on function public.ifund_is_super_admin() from public;
grant execute on function public.ifund_is_super_admin() to authenticated;

-- Apply owner/superadmin policies
do $$
declare
  tbl text;
begin
  for tbl in select tablename from pg_tables where schemaname = 'public' and tablename like 'executive_%' or tablename in (
    'corporate_facts', 'educational_departments', 'educational_modules', 'educational_source_registry',
    'simulation_scenarios', 'training_sessions', 'competency_evaluations', 'professional_contacts',
    'professional_interactions', 'investor_profiles', 'funding_opportunities', 'funding_confirmations',
    'communication_suppressions', 'data_room_documents', 'data_room_access_grants', 'compliance_policies'
  ) loop
    execute format('drop policy if exists super_admin_all on public.%I', tbl);
    execute format('create policy super_admin_all on public.%I for all using (public.ifund_is_super_admin())', tbl);
  end loop;
end;
$$;

-- Seed 1: Executive Identity
insert into public.executive_identities (id, slug, name, title, organization, email, bio, status)
values (
  '11111111-1111-4111-8111-111111111111',
  'michelle-rogers',
  'Michelle Rogers',
  'Director of Strategic Partnerships & Capital Development',
  'Interplanetary Fund',
  'michelle@interplanetaryfund.com',
  'Michelle Rogers is the Director of Strategic Partnerships & Capital Development for Interplanetary Fund. Benchmarked against elite MBA and executive education curricula, she specializes in capital formation, relationship building, institutional due diligence, and platform partnerships.',
  'training'
) on conflict (slug) do nothing;

-- Seed 2: Initial Capital Objective ($450,000)
insert into public.executive_objectives (id, executive_id, title, description, target_amount, current_verified_amount, category, status)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Initial Capital & Strategic Backing Acquisition',
  'Acquire $450,000 in verified received investments, grants, sponsorships, and strategic financial backing across a balanced allocation: $150k Lead Strategic, $150k Angels/Micro-VCs, $75k Grants/Non-dilutive, $50k Corporate Sponsorships, and $25k Accelerators/Competitions.',
  450000.00,
  0.00,
  'capital_acquisition',
  'active'
) on conflict do nothing;

-- Seed 3: Initial Operating Mode
insert into public.executive_operating_modes (executive_id, mode, emergency_stop_active, daily_budget_usd, current_daily_spend_usd)
values (
  '11111111-1111-4111-8111-111111111111',
  'training',
  false,
  5.00,
  0.00
) on conflict do nothing;

-- Seed 4: The 30 Educational Departments (MR-001 through MR-030)
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-001', 'Business Administration', 'Core organizational structures, management principles, operational cadence, executive execution.', 'Operations')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-002', 'Executive Leadership', 'Vision casting, stakeholder alignment, ethical decision-making, adaptive leadership.', 'Leadership')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-003', 'Corporate Strategy', 'Competitive advantage, industry dynamics, Helmer 7 Powers, strategic positioning.', 'Strategy')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-004', 'Financial Accounting', 'Balance sheets, income statements, cash flow statements, GAAP compliance, revenue recognition.', 'Finance')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-005', 'Corporate Finance', 'Capital structure, cost of capital, WACC, capital allocation, working capital management.', 'Finance')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-006', 'Financial Modeling and Valuation', 'DCF modeling, comparable company analysis, unit economics, sensitivity tables, scenario analysis.', 'Finance')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-007', 'Venture Capital', 'Fund economics, LP/GP dynamics, term sheets, dilution modeling, preferred equity, board governance.', 'Fundraising')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-008', 'Angel Investment', 'Angel syndicates, SAFEs, convertible notes, early-stage diligence, founder-friendly terms.', 'Fundraising')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-009', 'Grant Acquisition', 'SBIR/STTR programs, federal grants, foundation grants, compliance, eligibility verification.', 'Fundraising')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-010', 'Sponsorship Acquisition', 'Corporate sponsorship tiers, deliverable management, ROI measurement, co-branding.', 'Fundraising')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-011', 'Strategic Partnerships', 'Ecosystem alliances, joint ventures, channel partnerships, revenue sharing, strategic fit.', 'Strategy')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-012', 'Entrepreneurship', 'Customer discovery, product-market fit, lean startup methodology, iteration loops.', 'Strategy')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-013', 'Behavioral Psychology', 'Cognitive biases, loss aversion, social proof, decision architecture, choice framing.', 'Psychology')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-014', 'Social and Emotional Intelligence', 'Empathy, emotional regulation, social awareness, relationship management, executive composure.', 'Communication')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-015', 'Professional Relationship Development', 'Long-term relationship nurturing, authentic networking, trust building, non-transactional rapport.', 'Communication')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-016', 'Negotiation', 'Principled negotiation, BATNA, reservation value, ZOPA, interest-based bargaining, concession strategy.', 'Negotiation')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-017', 'Diplomacy and Conflict Resolution', 'Face-preserving disagreement, de-escalation, conflict mediation, cross-cultural sensitivity.', 'Negotiation')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-018', 'Conversational Intelligence', 'Active listening, conversational arcs, question framing, timing, conversational agility.', 'Communication')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-019', 'Persuasive Communication', 'Rhetorical structure, Minto Pyramid Principle, storytelling, narrative tension, conviction delivery.', 'Communication')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-020', 'Public Speaking and Presentations', 'Executive presence, slide design, presentation pacing, handling live Q&A, keynote delivery.', 'Communication')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-021', 'Marketing', 'Positioning, messaging hierarchies, customer acquisition, funnel optimization, brand narrative.', 'Marketing')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-022', 'Public Relations', 'Media relations, press releases, story pitching, reputation building, thought leadership.', 'Marketing')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-023', 'Social Media Management', 'B2B social strategy, organic community engagement, platform policies, audience nurturing.', 'Marketing')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-024', 'Corporate Reputation Management', 'Crisis communication, trust preservation, issue monitoring, stakeholder transparency.', 'Marketing')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-025', 'Business Law and Regulatory Compliance', 'Securities laws, Reg D, Reg CF, Washington DFI, CAN-SPAM, TCPA, fiduciary duties.', 'Legal')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-026', 'Technology Commercialization', 'IP protection, licensing, technology transfer, academic spin-offs, R&D roadmaps.', 'Technology')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-027', 'Artificial Intelligence and Platform Economics', 'AI agent workflows, multi-sided platforms, network effects, autonomous system ethics.', 'Technology')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-028', 'Business Intelligence and Research', 'Secondary research, market sizing, competitive intelligence, data triangulation, synthesis.', 'Research')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-029', 'Corporate Governance and Ethics', 'Board structure, shareholder rights, ESG principles, conflict of interest management.', 'Governance')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;
insert into public.educational_departments (dept_code, name, description, category)
values ('MR-030', 'Interplanetary Fund Operations', 'Platform architecture, verified truth system, partner-first model, iFund agent coordination.', 'Operations')
on conflict (dept_code) do update set name = excluded.name, description = excluded.description, category = excluded.category;

-- Seed 5: Verified Corporate Facts
insert into public.corporate_facts (subject, predicate, value, truth_class, source_uri, confidentiality_level, responsible_owner)
values
  ('ifund', 'legal_status', 'Washington-registered sole-proprietor trade name', 'verified_fact', 'internal:terms_of_service', 'public', 'executive_owner'),
  ('ifund', 'business_model', 'Partner-first fundraising platform operating alongside authorized fundraising hosts', 'verified_fact', 'internal:business_charter', 'public', 'executive_owner'),
  ('ifund', 'capital_target', '450000', 'approved_plan', 'internal:master_development_directive', 'confidential', 'michelle-rogers'),
  ('ifund', 'payment_processing', 'Isolated preview migration build; live donation receiving not yet enabled', 'verified_fact', 'internal:payment_architecture', 'public', 'engineering'),
  ('ifund', 'recurring_subscription_tier', 'Basic monthly at $4.99/mo with optional $1.00/mo campaign email add-on', 'verified_fact', 'internal:subscription_policy', 'public', 'executive_owner')
on conflict do nothing;
