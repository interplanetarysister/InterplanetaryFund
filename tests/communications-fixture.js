import { fixture as base, as } from "./strategy-fixture.js";
import { readFileSync } from "node:fs";
export { as };
export async function fixture() {
  const db = await base();
  const source = readFileSync(
    new URL(
      "../supabase/migrations/pending/20261102_ifund_base44_entity_tables.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const name of ["ifund_message", "ifund_agent_conversation_run"]) {
    const start = source.indexOf(
      "create table if not exists public." + name + " (",
    );
    const end = source.indexOf(
      "\n\n",
      source.indexOf("revoke all on public." + name, start),
    );
    await db.exec(source.slice(start, end));
  }
  // Reconciled hosted profile/notification shape, independently inspected before
  // this migration. No provider, real user, legal acceptance or delivery occurs.
  await db.exec(`alter table public.ifund_profiles add column comm_prefs jsonb not null default '{"email_updates":true,"in_app_updates":true}';
 alter table public.ifund_donations add column donor_id uuid;
 create table public.ifund_notifications(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,title text not null check(length(title) between 1 and 240),body text check(length(body)<=4000),type text not null check(type in('donation','update','thank_you','announcement','milestone','system')),link text,read boolean not null default false,canonical_operation_id text check(length(canonical_operation_id)<=256),created_at timestamptz not null default now());
 create unique index ifund_notifications_canonical_operation_uidx on public.ifund_notifications(canonical_operation_id) where canonical_operation_id is not null;
 alter table public.ifund_notifications enable row level security;
 create policy notifications_owner on public.ifund_notifications for select to authenticated using(owner_id=auth.uid());
 grant select on public.ifund_notifications to authenticated;`);
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/20261105111617_ifund_communications_agent_contracts.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    "update ifund_communications_runtime.control set enabled=true,delivery_enabled=true",
  );
  return db;
}
