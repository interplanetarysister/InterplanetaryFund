import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const campaign = "00000000-0000-4000-8000-000000000003";
const otherCampaign = "00000000-0000-4000-8000-000000000004";
const migration = async (name) =>
  readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

test("forward STABLE repair preserves owner-only aggregate, grants and body on an applied catalog", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table public.ifund_profiles (id uuid primary key, active boolean);
      create function public.ifund_current_account_is_active() returns boolean language sql stable
        as $$ select exists (select 1 from public.ifund_profiles where id=auth.uid() and active) $$;
      create table public.ifund_campaigns (id uuid primary key, owner_id uuid);
      create table public.ifund_agent_activity (campaign_id text, category text, status text, description text);
      insert into public.ifund_profiles values ('${owner}',true),('${other}',true);
      insert into public.ifund_campaigns values ('${campaign}','${owner}'),('${otherCampaign}','${other}');
      insert into public.ifund_agent_activity values
        ('${campaign}','writing','completed','private detail'),
        ('${campaign}','writing','completed','another private detail'),
        ('${otherCampaign}','research','completed','other owner private detail');
    `);
    await db.exec(
      await migration(
        "20261111154500_ifund_opt_in_atlas_and_owner_agent_focus.sql",
      ),
    );
    // Model the already-applied VOLATILE catalog independently of the repaired
    // fresh-install declaration. Only the forward migration may fix this state.
    await db.exec(
      "alter function public.ifund_owner_campaign_agent_focus(uuid) volatile",
    );
    const catalog = async () =>
      (
        await db.query(`select prosrc, proacl::text, proconfig::text,
      prosecdef, proowner, provolatile from pg_proc
      where oid='public.ifund_owner_campaign_agent_focus(uuid)'::regprocedure`)
      ).rows[0];
    const before = await catalog();
    assert.equal(before.provolatile, "v");
    const repair = await migration(
      "20261112123500_ifund_owner_agent_focus_stable.sql",
    );
    await db.exec(repair);
    const after = await catalog();
    assert.deepEqual(after, { ...before, provolatile: "s" });
    await db.exec(repair);
    assert.deepEqual(
      await catalog(),
      after,
      "replay must leave the same catalog",
    );

    const privileges = (
      await db.query(`select
      has_function_privilege('anon','public.ifund_owner_campaign_agent_focus(uuid)','EXECUTE') as anon,
      has_function_privilege('authenticated','public.ifund_owner_campaign_agent_focus(uuid)','EXECUTE') as member`)
    ).rows[0];
    assert.deepEqual(privileges, { anon: false, member: true });
    await db.exec(`set role anon`);
    await assert.rejects(
      db.query("select * from public.ifund_owner_campaign_agent_focus($1)", [
        campaign,
      ]),
      /permission denied/,
    );
    await db.exec(
      `reset role; select set_config('request.jwt.claim.sub','${owner}',false); set role authenticated`,
    );
    const result = await db.query(
      "select category,status,activity_count::int as activity_count from public.ifund_owner_campaign_agent_focus($1)",
      [campaign],
    );
    assert.deepEqual(result.rows, [
      { category: "writing", status: "completed", activity_count: 2 },
    ]);
    await assert.rejects(
      db.query("select * from public.ifund_owner_campaign_agent_focus($1)", [
        otherCampaign,
      ]),
      /Campaign not found for this owner/,
    );
    await db.exec(
      `reset role; update public.ifund_profiles set active=false where id='${owner}'; set role authenticated`,
    );
    await assert.rejects(
      db.query("select * from public.ifund_owner_campaign_agent_focus($1)", [
        campaign,
      ]),
      /Campaign not found for this owner/,
    );
    await db.exec(
      "reset role; select set_config('request.jwt.claim.sub','',false); set role authenticated",
    );
    await assert.rejects(
      db.query("select * from public.ifund_owner_campaign_agent_focus($1)", [
        campaign,
      ]),
      /Campaign not found for this owner/,
    );
  } finally {
    await db.close();
  }
});
