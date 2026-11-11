-- Independent IFund sandbox demo schema, reconstructed from deployed Supabase catalog on 2026-11-11.
-- Intended for a NEW dedicated demo database only. Do NOT apply to live production without schema review.
-- Contains schema and trusted executable function definitions; no user data, passwords or secrets.
BEGIN;

CREATE TABLE IF NOT EXISTS public."ifund_demo_ai_runs" (
  "id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "model" text NOT NULL,
  "status" text NOT NULL,
  "outcome" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS public."ifund_demo_campaigns" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "story" jsonb NOT NULL,
  "category" text NOT NULL,
  "goal_cents" integer NOT NULL,
  "status" text NOT NULL,
  "organizer" text NOT NULL,
  "location" text DEFAULT 'Synthetic location'::text NOT NULL,
  "latitude" double precision DEFAULT 0 NOT NULL,
  "longitude" double precision DEFAULT 0 NOT NULL,
  "image_path" text,
  "ai_request_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "fictional" boolean DEFAULT true NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public."ifund_demo_captures" (
  "capture_id" text NOT NULL,
  "order_id" uuid NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL,
  "verified_at" timestamp with time zone DEFAULT now() NOT NULL,
  "provider_status" text NOT NULL
);
CREATE TABLE IF NOT EXISTS public."ifund_demo_events" (
  "event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "payload_hash" text NOT NULL,
  "order_id" uuid,
  "verified_at" timestamp with time zone DEFAULT now() NOT NULL,
  "delivery_count" integer DEFAULT 1 NOT NULL,
  "last_verified_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public."ifund_demo_ledger" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "capture_id" text NOT NULL,
  "account" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public."ifund_demo_media" (
  "id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "object_key" text NOT NULL,
  "content_type" text NOT NULL,
  "ai_run_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public."ifund_demo_orders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "campaign_id" uuid,
  "purpose" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text DEFAULT 'USD'::text NOT NULL,
  "create_key" uuid NOT NULL,
  "paypal_order_id" text,
  "paypal_capture_id" text,
  "merchant_id" text,
  "status" text DEFAULT 'creating'::text NOT NULL,
  "reconciliation" text DEFAULT 'not_verified'::text NOT NULL,
  "approval_url" text,
  "failure_code" text,
  "captured_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public."ifund_demo_rate_limits" (
  "key" text NOT NULL,
  "count" integer NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS public."ifund_demo_receipts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "capture_id" text NOT NULL,
  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "disclosure" text DEFAULT 'PAYPAL SANDBOX — NO REAL FUNDS TRANSFERRED'::text NOT NULL
);
CREATE TABLE IF NOT EXISTS public."ifund_demo_sessions" (
  "token_hash" text NOT NULL,
  "user_id" uuid NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public."ifund_demo_tracker" (
  "gate" text NOT NULL,
  "status" text NOT NULL,
  "result" text DEFAULT ''::text NOT NULL,
  "evidence_url" text,
  "commit_sha" text,
  "updated_by" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL
);
CREATE TABLE IF NOT EXISTS public."ifund_demo_users" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "handle" text NOT NULL,
  "password_hash" text NOT NULL,
  "salt" text NOT NULL,
  "role" text DEFAULT 'member'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Constraints after table creation to permit cross-table foreign keys.
ALTER TABLE public."ifund_demo_ai_runs" ADD CONSTRAINT "ifund_demo_ai_runs_pkey" PRIMARY KEY (id);
ALTER TABLE public."ifund_demo_ai_runs" ADD CONSTRAINT "ifund_demo_ai_runs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES ifund_demo_users(id);
ALTER TABLE public."ifund_demo_ai_runs" ADD CONSTRAINT "ifund_demo_ai_runs_status_check" CHECK (status = ANY (ARRAY['started'::text, 'succeeded'::text, 'failed'::text]));
ALTER TABLE public."ifund_demo_campaigns" ADD CONSTRAINT "ifund_demo_campaigns_pkey" PRIMARY KEY (id);
ALTER TABLE public."ifund_demo_campaigns" ADD CONSTRAINT "ifund_demo_campaigns_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES ifund_demo_users(id);
ALTER TABLE public."ifund_demo_campaigns" ADD CONSTRAINT "ifund_demo_campaigns_longitude_check" CHECK (longitude >= '-180'::integer::double precision AND longitude <= 180::double precision);
ALTER TABLE public."ifund_demo_campaigns" ADD CONSTRAINT "ifund_demo_campaigns_organizer_check" CHECK (length(organizer) >= 3 AND length(organizer) <= 80);
ALTER TABLE public."ifund_demo_campaigns" ADD CONSTRAINT "ifund_demo_campaigns_title_check" CHECK (length(title) >= 5 AND length(title) <= 120);
ALTER TABLE public."ifund_demo_campaigns" ADD CONSTRAINT "ifund_demo_campaigns_category_check" CHECK (category = ANY (ARRAY['emergency'::text, 'medical'::text, 'education'::text, 'disaster_relief'::text, 'community'::text, 'animals'::text, 'environment'::text, 'creative'::text, 'science'::text]));
ALTER TABLE public."ifund_demo_campaigns" ADD CONSTRAINT "ifund_demo_campaigns_fictional_check" CHECK (fictional);
ALTER TABLE public."ifund_demo_campaigns" ADD CONSTRAINT "ifund_demo_campaigns_goal_cents_check" CHECK (goal_cents >= 100 AND goal_cents <= 100000000);
ALTER TABLE public."ifund_demo_campaigns" ADD CONSTRAINT "ifund_demo_campaigns_latitude_check" CHECK (latitude >= '-90'::integer::double precision AND latitude <= 90::double precision);
ALTER TABLE public."ifund_demo_campaigns" ADD CONSTRAINT "ifund_demo_campaigns_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text]));
ALTER TABLE public."ifund_demo_campaigns" ADD CONSTRAINT "ifund_demo_campaigns_story_check" CHECK (jsonb_typeof(story) = 'array'::text);
ALTER TABLE public."ifund_demo_campaigns" ADD CONSTRAINT "ifund_demo_campaigns_summary_check" CHECK (length(summary) >= 10 AND length(summary) <= 600);
ALTER TABLE public."ifund_demo_captures" ADD CONSTRAINT "ifund_demo_captures_order_id_key" UNIQUE (order_id);
ALTER TABLE public."ifund_demo_captures" ADD CONSTRAINT "ifund_demo_captures_pkey" PRIMARY KEY (capture_id);
ALTER TABLE public."ifund_demo_captures" ADD CONSTRAINT "ifund_demo_captures_order_id_fkey" FOREIGN KEY (order_id) REFERENCES ifund_demo_orders(id);
ALTER TABLE public."ifund_demo_captures" ADD CONSTRAINT "ifund_demo_captures_currency_check" CHECK (currency = 'USD'::text);
ALTER TABLE public."ifund_demo_captures" ADD CONSTRAINT "ifund_demo_captures_provider_status_check" CHECK (provider_status = 'COMPLETED'::text);
ALTER TABLE public."ifund_demo_captures" ADD CONSTRAINT "ifund_demo_captures_amount_cents_check" CHECK (amount_cents >= 100 AND amount_cents <= 10000);
ALTER TABLE public."ifund_demo_events" ADD CONSTRAINT "ifund_demo_events_pkey" PRIMARY KEY (event_id);
ALTER TABLE public."ifund_demo_events" ADD CONSTRAINT "ifund_demo_events_order_id_fkey" FOREIGN KEY (order_id) REFERENCES ifund_demo_orders(id);
ALTER TABLE public."ifund_demo_events" ADD CONSTRAINT "ifund_demo_events_delivery_count_check" CHECK (delivery_count > 0);
ALTER TABLE public."ifund_demo_ledger" ADD CONSTRAINT "ifund_demo_ledger_capture_id_account_key" UNIQUE (capture_id, account);
ALTER TABLE public."ifund_demo_ledger" ADD CONSTRAINT "ifund_demo_ledger_pkey" PRIMARY KEY (id);
ALTER TABLE public."ifund_demo_ledger" ADD CONSTRAINT "ifund_demo_ledger_capture_id_fkey" FOREIGN KEY (capture_id) REFERENCES ifund_demo_captures(capture_id);
ALTER TABLE public."ifund_demo_ledger" ADD CONSTRAINT "ifund_demo_ledger_amount_cents_check" CHECK (amount_cents <> 0);
ALTER TABLE public."ifund_demo_ledger" ADD CONSTRAINT "ifund_demo_ledger_account_check" CHECK (account = ANY (ARRAY['sandbox_clearing'::text, 'campaign_support'::text, 'platform_support'::text]));
ALTER TABLE public."ifund_demo_ledger" ADD CONSTRAINT "ifund_demo_ledger_currency_check" CHECK (currency = 'USD'::text);
ALTER TABLE public."ifund_demo_media" ADD CONSTRAINT "ifund_demo_media_object_key_key" UNIQUE (object_key);
ALTER TABLE public."ifund_demo_media" ADD CONSTRAINT "ifund_demo_media_pkey" PRIMARY KEY (id);
ALTER TABLE public."ifund_demo_media" ADD CONSTRAINT "ifund_demo_media_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES ifund_demo_users(id);
ALTER TABLE public."ifund_demo_media" ADD CONSTRAINT "ifund_demo_media_ai_run_id_fkey" FOREIGN KEY (ai_run_id) REFERENCES ifund_demo_ai_runs(id);
ALTER TABLE public."ifund_demo_media" ADD CONSTRAINT "ifund_demo_media_content_type_check" CHECK (content_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text]));
ALTER TABLE public."ifund_demo_orders" ADD CONSTRAINT "ifund_demo_orders_paypal_capture_id_key" UNIQUE (paypal_capture_id);
ALTER TABLE public."ifund_demo_orders" ADD CONSTRAINT "ifund_demo_orders_paypal_order_id_key" UNIQUE (paypal_order_id);
ALTER TABLE public."ifund_demo_orders" ADD CONSTRAINT "ifund_demo_orders_user_id_create_key_key" UNIQUE (user_id, create_key);
ALTER TABLE public."ifund_demo_orders" ADD CONSTRAINT "ifund_demo_orders_pkey" PRIMARY KEY (id);
ALTER TABLE public."ifund_demo_orders" ADD CONSTRAINT "ifund_demo_orders_user_id_fkey" FOREIGN KEY (user_id) REFERENCES ifund_demo_users(id);
ALTER TABLE public."ifund_demo_orders" ADD CONSTRAINT "ifund_demo_orders_campaign_id_fkey" FOREIGN KEY (campaign_id) REFERENCES ifund_demo_campaigns(id);
ALTER TABLE public."ifund_demo_orders" ADD CONSTRAINT "ifund_demo_orders_check1" CHECK (status <> 'captured'::text OR paypal_order_id IS NOT NULL AND paypal_capture_id IS NOT NULL AND captured_at IS NOT NULL AND reconciliation = 'provider_verified'::text);
ALTER TABLE public."ifund_demo_orders" ADD CONSTRAINT "ifund_demo_orders_reconciliation_check" CHECK (reconciliation = ANY (ARRAY['not_verified'::text, 'provider_verified'::text, 'retry_required'::text]));
ALTER TABLE public."ifund_demo_orders" ADD CONSTRAINT "ifund_demo_orders_check" CHECK (purpose = 'campaign'::text AND campaign_id IS NOT NULL OR purpose = 'platform_support'::text AND campaign_id IS NULL);
ALTER TABLE public."ifund_demo_orders" ADD CONSTRAINT "ifund_demo_orders_status_check" CHECK (status = ANY (ARRAY['creating'::text, 'created'::text, 'pending'::text, 'captured'::text, 'cancelled'::text, 'failed'::text]));
ALTER TABLE public."ifund_demo_orders" ADD CONSTRAINT "ifund_demo_orders_purpose_check" CHECK (purpose = ANY (ARRAY['campaign'::text, 'platform_support'::text]));
ALTER TABLE public."ifund_demo_orders" ADD CONSTRAINT "ifund_demo_orders_currency_check" CHECK (currency = 'USD'::text);
ALTER TABLE public."ifund_demo_orders" ADD CONSTRAINT "ifund_demo_orders_amount_cents_check" CHECK (amount_cents >= 100 AND amount_cents <= 10000);
ALTER TABLE public."ifund_demo_rate_limits" ADD CONSTRAINT "ifund_demo_rate_limits_pkey" PRIMARY KEY (key);
ALTER TABLE public."ifund_demo_rate_limits" ADD CONSTRAINT "ifund_demo_rate_limits_count_check" CHECK (count > 0);
ALTER TABLE public."ifund_demo_receipts" ADD CONSTRAINT "ifund_demo_receipts_capture_id_key" UNIQUE (capture_id);
ALTER TABLE public."ifund_demo_receipts" ADD CONSTRAINT "ifund_demo_receipts_pkey" PRIMARY KEY (id);
ALTER TABLE public."ifund_demo_receipts" ADD CONSTRAINT "ifund_demo_receipts_capture_id_fkey" FOREIGN KEY (capture_id) REFERENCES ifund_demo_captures(capture_id);
ALTER TABLE public."ifund_demo_receipts" ADD CONSTRAINT "ifund_demo_receipts_disclosure_check" CHECK (disclosure = 'PAYPAL SANDBOX — NO REAL FUNDS TRANSFERRED'::text);
ALTER TABLE public."ifund_demo_sessions" ADD CONSTRAINT "ifund_demo_sessions_pkey" PRIMARY KEY (token_hash);
ALTER TABLE public."ifund_demo_sessions" ADD CONSTRAINT "ifund_demo_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES ifund_demo_users(id) ON DELETE CASCADE;
ALTER TABLE public."ifund_demo_tracker" ADD CONSTRAINT "ifund_demo_tracker_pkey" PRIMARY KEY (gate);
ALTER TABLE public."ifund_demo_tracker" ADD CONSTRAINT "ifund_demo_tracker_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES ifund_demo_users(id);
ALTER TABLE public."ifund_demo_tracker" ADD CONSTRAINT "ifund_demo_tracker_status_check" CHECK (status = ANY (ARRAY['PASS'::text, 'FAIL'::text, 'BLOCKED'::text, 'NOT VERIFIED'::text]));
ALTER TABLE public."ifund_demo_users" ADD CONSTRAINT "ifund_demo_users_handle_key" UNIQUE (handle);
ALTER TABLE public."ifund_demo_users" ADD CONSTRAINT "ifund_demo_users_pkey" PRIMARY KEY (id);
ALTER TABLE public."ifund_demo_users" ADD CONSTRAINT "ifund_demo_users_role_check" CHECK (role = ANY (ARRAY['member'::text, 'admin'::text]));
ALTER TABLE public."ifund_demo_users" ADD CONSTRAINT "ifund_demo_users_handle_check" CHECK (handle ~ '^[a-z0-9_]{3,30}$'::text);

-- Supporting indexes.
CREATE INDEX ifund_demo_ai_runs_user_id_idx ON public.ifund_demo_ai_runs USING btree (user_id);
CREATE INDEX ifund_demo_campaigns_owner_id_idx ON public.ifund_demo_campaigns USING btree (owner_id);
CREATE INDEX ifund_demo_campaigns_status_created_at_idx ON public.ifund_demo_campaigns USING btree (status, created_at DESC);
CREATE INDEX ifund_demo_media_owner_id_idx ON public.ifund_demo_media USING btree (owner_id);
CREATE INDEX ifund_demo_orders_campaign_id_idx ON public.ifund_demo_orders USING btree (campaign_id);
CREATE INDEX ifund_demo_orders_status_created_at_idx ON public.ifund_demo_orders USING btree (status, created_at);
CREATE INDEX ifund_demo_sessions_user_id_idx ON public.ifund_demo_sessions USING btree (user_id);

-- Functions and RPCs.
CREATE OR REPLACE FUNCTION public.ifund_demo_event_replay(p_event text, p_hash text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare n integer;
begin
 update public.ifund_demo_events set delivery_count=delivery_count+1,last_verified_at=now()
 where event_id=p_event and payload_hash=p_hash returning delivery_count into n;
 if not found then raise exception 'Verified event replay mismatch'; end if;
 return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.ifund_demo_finalize(p_order uuid, p_capture text, p_amount integer, p_currency text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare o public.ifund_demo_orders; c public.ifund_demo_captures; r public.ifund_demo_receipts;
begin
 select * into strict o from public.ifund_demo_orders where id=p_order for update;
 if o.paypal_order_id is null or o.amount_cents<>p_amount or p_currency<>'USD' or length(p_capture)<8 then raise exception 'Verified capture mismatch'; end if;
 if o.paypal_capture_id is not null and o.paypal_capture_id<>p_capture then raise exception 'Conflicting capture'; end if;
 select * into c from public.ifund_demo_captures where capture_id=p_capture;
 if found and (c.order_id<>p_order or c.amount_cents<>p_amount) then raise exception 'Capture already assigned'; end if;
 insert into public.ifund_demo_captures(capture_id,order_id,amount_cents,currency,provider_status)
 values(p_capture,p_order,p_amount,p_currency,'COMPLETED') on conflict(capture_id) do nothing;
 insert into public.ifund_demo_ledger(capture_id,account,amount_cents,currency) values
 (p_capture,'sandbox_clearing',-p_amount,'USD'),
 (p_capture,case when o.purpose='campaign' then 'campaign_support' else 'platform_support' end,p_amount,'USD')
 on conflict(capture_id,account) do nothing;
 insert into public.ifund_demo_receipts(capture_id) values(p_capture) on conflict(capture_id) do nothing;
 update public.ifund_demo_orders set status='captured',paypal_capture_id=p_capture,reconciliation='provider_verified',captured_at=coalesce(captured_at,now()),updated_at=now() where id=p_order;
 select * into strict r from public.ifund_demo_receipts where capture_id=p_capture;
 return jsonb_build_object('receipt_id',r.id,'capture_id',p_capture,'order_id',o.paypal_order_id,'amount_cents',p_amount,'purpose',o.purpose,'currency','USD','status','captured','disclosure',r.disclosure);
end $function$
;

CREATE OR REPLACE FUNCTION public.ifund_demo_finance(p_user uuid, p_view text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if p_view not in ('donor','organizer','admin') then raise exception 'Invalid view'; end if;
 if p_view='admin' and not exists(select 1 from public.ifund_demo_users where id=p_user and role='admin') then raise exception 'Admin required'; end if;
 with scoped as (
  select o.* from public.ifund_demo_orders o where
  (p_view='donor' and o.user_id=p_user) or p_view='admin' or
  (p_view='organizer' and o.purpose='campaign' and exists(select 1 from public.ifund_demo_campaigns c where c.id=o.campaign_id and c.owner_id=p_user))
 ), verified as (
  select o.* from scoped o join public.ifund_demo_captures c on c.order_id=o.id and c.capture_id=o.paypal_capture_id and c.amount_cents=o.amount_cents
  where o.status='captured' and o.reconciliation='provider_verified'
 ), recent as (
  select id,campaign_id,purpose,amount_cents,currency,status,reconciliation,paypal_order_id,paypal_capture_id,created_at,captured_at from scoped order by created_at desc limit 200
 ) select jsonb_build_object(
 'orders',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from recent r),'[]'::jsonb),
 'receipts',coalesce((select jsonb_agg(to_jsonb(r)) from public.ifund_demo_receipts r where r.capture_id in (select paypal_capture_id from recent)),'[]'::jsonb),
 'captured_cents',coalesce((select sum(amount_cents) from verified where purpose='campaign'),0),
 'platform_support_cents',coalesce((select sum(amount_cents) from verified where purpose='platform_support'),0),
 'pending_count',(select count(*) from scoped where status in ('creating','created','pending')),
 'record_count',(select count(*) from scoped),'limited_to_latest',200) into result;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.ifund_demo_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin raise exception 'Demo financial records are append-only'; end $function$
;

CREATE OR REPLACE FUNCTION public.ifund_demo_rate(p_key text, p_limit integer, p_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare n integer;
begin
 if p_limit<1 or p_seconds<1 then raise exception 'Invalid limit'; end if;
 insert into public.ifund_demo_rate_limits as r(key,count,expires_at) values(p_key,1,now()+make_interval(secs=>p_seconds))
 on conflict(key) do update set count=case when r.expires_at<now() then 1 else r.count+1 end,
 expires_at=case when r.expires_at<now() then now()+make_interval(secs=>p_seconds) else r.expires_at end returning count into n;
 return n<=p_limit;
end $function$
;

CREATE OR REPLACE FUNCTION public.ifund_demo_totals(p_ids uuid[])
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from (
  select o.campaign_id,sum(c.amount_cents) as raised_cents,count(distinct o.user_id) as donor_count
  from public.ifund_demo_orders o join public.ifund_demo_captures c on c.order_id=o.id and c.capture_id=o.paypal_capture_id
  where o.campaign_id=any(p_ids) and o.purpose='campaign' and o.status='captured' and o.reconciliation='provider_verified'
  group by o.campaign_id
 ) t;
$function$
;


-- Security: deny all client roles by default; only service_role may access the transport tables and RPCs.
ALTER TABLE public."ifund_demo_ai_runs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ifund_demo_ai_runs" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."ifund_demo_ai_runs" TO service_role;
ALTER TABLE public."ifund_demo_campaigns" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ifund_demo_campaigns" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."ifund_demo_campaigns" TO service_role;
ALTER TABLE public."ifund_demo_captures" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ifund_demo_captures" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."ifund_demo_captures" TO service_role;
ALTER TABLE public."ifund_demo_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ifund_demo_events" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."ifund_demo_events" TO service_role;
ALTER TABLE public."ifund_demo_ledger" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ifund_demo_ledger" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."ifund_demo_ledger" TO service_role;
ALTER TABLE public."ifund_demo_media" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ifund_demo_media" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."ifund_demo_media" TO service_role;
ALTER TABLE public."ifund_demo_orders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ifund_demo_orders" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."ifund_demo_orders" TO service_role;
ALTER TABLE public."ifund_demo_rate_limits" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ifund_demo_rate_limits" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."ifund_demo_rate_limits" TO service_role;
ALTER TABLE public."ifund_demo_receipts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ifund_demo_receipts" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."ifund_demo_receipts" TO service_role;
ALTER TABLE public."ifund_demo_sessions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ifund_demo_sessions" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."ifund_demo_sessions" TO service_role;
ALTER TABLE public."ifund_demo_tracker" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ifund_demo_tracker" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."ifund_demo_tracker" TO service_role;
ALTER TABLE public."ifund_demo_users" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ifund_demo_users" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."ifund_demo_users" TO service_role;
REVOKE ALL ON FUNCTION public."ifund_demo_event_replay"(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public."ifund_demo_event_replay"(text,text) TO service_role;
REVOKE ALL ON FUNCTION public."ifund_demo_finalize"(uuid,text,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public."ifund_demo_finalize"(uuid,text,integer,text) TO service_role;
REVOKE ALL ON FUNCTION public."ifund_demo_finance"(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public."ifund_demo_finance"(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public."ifund_demo_immutable"() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public."ifund_demo_immutable"() TO service_role;
REVOKE ALL ON FUNCTION public."ifund_demo_rate"(text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public."ifund_demo_rate"(text,integer,integer) TO service_role;
REVOKE ALL ON FUNCTION public."ifund_demo_totals"(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public."ifund_demo_totals"(uuid[]) TO service_role;

-- Immutable financial event guards.
CREATE TRIGGER immutable BEFORE DELETE OR UPDATE ON ifund_demo_captures FOR EACH ROW EXECUTE FUNCTION ifund_demo_immutable();
CREATE TRIGGER immutable BEFORE DELETE OR UPDATE ON ifund_demo_ledger FOR EACH ROW EXECUTE FUNCTION ifund_demo_immutable();
CREATE TRIGGER immutable BEFORE DELETE OR UPDATE ON ifund_demo_receipts FOR EACH ROW EXECUTE FUNCTION ifund_demo_immutable();

COMMIT;
