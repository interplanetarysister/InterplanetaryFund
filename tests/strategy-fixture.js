import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const uid = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  rid = "33333333-3333-4333-8333-333333333333";
const hash = "a".repeat(64);
const suggestion = {
  titles: ["A", "B", "C", "D", "E"],
  summaries: ["Summary A", "Summary B"],
  story: "A true story",
  image_prompt: "Mission image",
};
export async function fixture() {
  const db = new PGlite();
  await db.exec(`create schema auth; create schema ifund_ops; create role anon; create role authenticated;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
 create table public.ifund_profiles(id uuid primary key,account_status text,account_deletion_pending boolean,display_name text,handle text);
 create function public.ifund_current_user_is_verified_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin',true),'')=auth.uid()::text $$;
 create table public.ifund_legal_acceptances(owner_id uuid,terms_version text,explicit_consent boolean);
 create table public.ifund_campaigns(id uuid primary key,owner_id uuid,title text,summary text,story text,category text,goal_amount numeric,status text,cover_image_url text,updated_at timestamptz default now());
 create table public.ifund_connections(id uuid primary key,owner_id uuid,provider text,status text,verified_at timestamptz,created_at timestamptz default now());
 create table public.ifund_posts(id uuid primary key,author_id uuid,body text,created_at timestamptz default now());
 create table ifund_ops.workflow_jobs(id bigint generated always as identity primary key,workflow_key text not null,source_event_id text not null,owner_id uuid,payload jsonb not null default '{}',status text not null default 'paused' check(status in ('paused','pending','running','succeeded','failed','cancelled')),run_after timestamptz not null default now(),attempt_count integer not null default 0,max_attempts integer not null default 3,lease_until timestamptz,last_error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),lease_token uuid,unique(workflow_key,source_event_id));`);
  // Execute the actual generated entity DDL including its real enum constraints.
  const sql = readFileSync(
    new URL(
      "../supabase/migrations/pending/20261102_ifund_base44_entity_tables.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const name of [
    "ifund_agent_content_draft",
    "ifund_agent_activity",
    "ifund_writing_research_brief",
    "ifund_mission_brief",
    "ifund_recommendation",
  ]) {
    const start = sql.indexOf(
      "create table if not exists public." + name + " (",
    );
    const end = sql.indexOf(
      "\n\n",
      sql.indexOf("revoke all on public." + name, start),
    );
    await db.exec(sql.slice(start, end));
  }
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/20261104043420_ifund_story_preview_contracts.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec("update ifund_story_runtime.control set enabled=true");
  for (const id of [uid, other]) {
    await db.query("insert into auth.users values($1,now())", [id]);
    await db.query(
      "insert into public.ifund_profiles(id,account_status,account_deletion_pending) values($1,'active',false)",
      [id],
    );
    await db.query(
      "insert into ifund_access.member_entitlements(owner_id,tier,status,verified_at,valid_until,provider,receipt_id) values($1,'basic','active',now(),now()+interval '1 day','paypal',$2)",
      [id, "verified-test-" + id],
    );
    await db.query(
      "insert into public.ifund_legal_acceptances values($1,'2026-10-13-v3',true)",
      [id],
    );
  }
  await db.exec(
    `create table public.ifund_donations(id uuid primary key,campaign_id uuid,gift_cents bigint,currency text,status text,paypal_capture_id text,captured_at timestamptz);`,
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/20261104061736_ifund_strategy_agent_contracts.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec("update ifund_strategy_runtime.control set enabled=true");
  return db;
}
export async function as(db, id, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('test.uid',$1,false)", [id || ""]);
  await db.exec("set role " + role);
}
