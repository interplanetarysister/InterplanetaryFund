import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { connectionCatalog, connectionMethods, connectionProvider } from "../worker/connections/catalog.js";
import { oauthProviders } from "../worker/oauth.js";
import { sandboxConfigured } from "../worker/paypalSandboxSecurity.js";
import { appendTeamContext, readTeamContext, readCampaignDocumentContext } from "../worker/agents/teamContext.js";
import { cleanupPrivateCampaignDocuments } from "../worker/services/privateDocumentErasure.js";
import providerCatalog from "../worker/connections/provider-catalog.js";
import positionContracts from "../worker/services/position-contracts.js";
import skillManifest from "../worker/services/skills/manifest.js";
import { serviceSkill } from "../worker/services/skills/index.js";
import { CONNECTION_PLATFORMS } from "../apps/web/src/lib/connectionCatalog.mjs";

const migration=readFileSync(new URL("../supabase/migrations/20261113080000_ifund_member_connections_hub.sql",import.meta.url),"utf8");
const eventIntegrityMigration=readFileSync(new URL("../supabase/migrations/20261118200500_ifund_event_activity_integrity.sql",import.meta.url),"utf8");
const owner="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const stranger="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ownedCampaign="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const foreignCampaign="dddddddd-dddd-4ddd-8ddd-dddddddddddd";


test("event integrity migration enforces provider-bound URLs and one-way immutable cancellation", async t => {
 const db=new PGlite();
 t.after(()=>db.close());
 await db.exec([
  "create role anon; create role authenticated;",
  "create schema auth;",
  "create function auth.uid() returns uuid language sql stable as $ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $;",
  "grant usage on schema auth to anon,authenticated;",
  "grant execute on function auth.uid() to anon,authenticated;",
  "create table public.ifund_campaigns(id uuid primary key,status text not null);",
  "create table public.ifund_events(id uuid primary key,owner_id uuid not null,status text not null,visibility text not null,campaign_id uuid,checkout_url text,checkout_provider text);",
  "create table public.ifund_event_items(id uuid primary key,owner_id uuid not null,event_id uuid not null,status text not null,checkout_url text,checkout_provider text);",
  "create table public.ifund_event_registrations(id uuid primary key,user_id uuid,event_id uuid,activity_type text,reported_amount_cents integer,status text not null,updated_at timestamptz default now());",
  "alter table public.ifund_events enable row level security;",
  "alter table public.ifund_event_items enable row level security;",
  "alter table public.ifund_event_registrations enable row level security;",
  "create policy ifund_events_owner_read on public.ifund_events for select to authenticated using (owner_id=auth.uid());",
  "create policy ifund_events_public_read on public.ifund_events for select to anon,authenticated using (status='published' and visibility='public');",
  "create policy ifund_event_items_owner_read on public.ifund_event_items for select to authenticated using (owner_id=auth.uid());",
  "create policy ifund_event_items_public_read on public.ifund_event_items for select to anon,authenticated using (status='available');"
 ].join("\n"));
 await db.exec(eventIntegrityMigration);
 const eventId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",ownerId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
 await db.query("insert into public.ifund_events(id,owner_id,status,visibility,checkout_provider,checkout_url) values($1,$2,'published','public','eventbrite','https://eventbrite.com/e/benefit-dinner')",[eventId,ownerId]);
 await assert.rejects(db.query("insert into public.ifund_events(id,owner_id,status,visibility,checkout_provider,checkout_url) values($1,$2,'published','public','eventbrite','https://paypal.com/paypalme/fund')",["cccccccc-cccc-4ccc-8ccc-cccccccccccc",ownerId]));
 await assert.rejects(db.query("insert into public.ifund_events(id,owner_id,status,visibility,checkout_provider,checkout_url) values($1,$2,'published','public','eventbrite','https://eventbrite.com')",["dddddddd-dddd-4ddd-8ddd-dddddddddddd",ownerId]));
 await db.query("insert into public.ifund_event_items(id,owner_id,event_id,status,checkout_provider,checkout_url) values($1,$2,$3,'available','paypal','https://paypal.me/communityfund')",["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",ownerId,eventId]);
 await assert.rejects(db.query("insert into public.ifund_event_items(id,owner_id,event_id,status,checkout_provider,checkout_url) values($1,$2,$3,'available','eventbrite','https://paypal.com/paypalme/fund')",["ffffffff-ffff-4fff-8fff-ffffffffffff",ownerId,eventId]));
 const activityId="11111111-1111-4111-8111-111111111111",memberId="22222222-2222-4222-8222-222222222222";
 await db.query("insert into public.ifund_event_registrations(id,user_id,event_id,activity_type,reported_amount_cents,status) values($1,$2,$3,'rsvp',null,'active')",[activityId,memberId,eventId]);
 await db.query("update public.ifund_event_registrations set status='cancelled' where id=$1",[activityId]);
 const cancelled=(await db.query("select status,updated_at from public.ifund_event_registrations where id=$1",[activityId])).rows[0];
 assert.equal(cancelled.status,"cancelled");
 assert.ok(cancelled.updated_at);
 await assert.rejects(db.query("update public.ifund_event_registrations set status='active' where id=$1",[activityId]));
 const secondId="33333333-3333-4333-8333-333333333333";
 await db.query("insert into public.ifund_event_registrations(id,user_id,event_id,activity_type,reported_amount_cents,status) values($1,$2,$3,'rsvp',null,'active')",[secondId,memberId,eventId]);
 await assert.rejects(db.query("update public.ifund_event_registrations set status='cancelled',user_id=$2 where id=$1",[secondId,ownerId]));
});

test("public page links and sharing choices are private and never count as OAuth grants",async t=>{
 const db=new PGlite();
 t.after(()=>db.close());
 await db.exec([
  "create role anon; create role authenticated;",
  "create schema auth;",
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  "grant usage on schema auth to anon,authenticated;",
  "grant execute on function auth.uid() to anon,authenticated;",
  "create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);",
  "create table public.ifund_campaigns(id uuid primary key,owner_id uuid);",
  "create function public.ifund_current_account_is_active() returns boolean language sql stable as $active$",
  " select exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and u.is_anonymous is false) $active$;",
  "insert into auth.users(id,email_confirmed_at) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now());",
  "insert into public.ifund_campaigns(id,owner_id) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('dddddddd-dddd-4ddd-8ddd-dddddddddddd','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');"
 ].join("\n"));
 await db.exec(migration);
 const query=(q,args=[])=>db.query(q,args);
 const who=async(id,role="authenticated")=>{
  await db.exec("reset role");
  await query("select set_config('request.jwt.claim.sub',$1,false)",[id||""]);
  await db.exec("set role "+role);
 };
 assert.equal((await query("select has_function_privilege('anon','public.ifund_save_public_link(text,text,text,uuid)','execute') ok")).rows[0].ok,false);
 assert.equal((await query("select has_table_privilege('authenticated','public.ifund_member_public_links','select') ok")).rows[0].ok,false);
 await who(owner);
 await assert.rejects(query("select * from public.ifund_member_public_links"),/permission denied/);
 await assert.rejects(query("select public.ifund_save_public_link($1,$2,$3,$4)",[
  "gofundme","https://gofundme.com.evil.org/f/fake","fake",null
 ]),/selected platform/);
 await assert.rejects(query("select public.ifund_save_public_link($1,$2,$3,$4)",[
  "gofundme","http://www.gofundme.com/f/no","fake",null
 ]),/secure public page/);
 await assert.rejects(query("select public.ifund_save_public_link($1,$2,$3,$4)",[
  "gofundme","https://www.gofundme.com/f/real","Our effort",foreignCampaign
 ]),/campaign you manage/);
 await query("select public.ifund_save_public_link($1,$2,$3,$4)",[
  "gofundme","https://www.gofundme.com/f/real?token=sensitive#private","Our effort",ownedCampaign
 ]);
 const owned=(await query("select * from public.ifund_my_public_links()")).rows;
 assert.equal(owned.length,1);
 assert.equal(owned[0].page_url,"https://www.gofundme.com/f/real");
 assert.equal(owned[0].campaign_id,ownedCampaign);
 await query("select public.ifund_set_share_choice($1,$2)",["facebook","review"]);
 const prefs=(await query("select provider,choice from public.ifund_my_share_choices()")).rows;
 assert.deepEqual(prefs,[{provider:"facebook",choice:"review"}]);
 await assert.rejects(query("select public.ifund_set_share_choice($1,$2)",["fake","review"]),/Invalid sharing preference/);
 await assert.rejects(query("select public.ifund_set_share_choice($1,$2)",["facebook","automatic"]),/Invalid sharing preference/);
 await assert.rejects(query("select * from public.ifund_member_connection_assistance"),/permission denied/);
 assert.equal((await query("select * from public.ifund_my_connection_assistance()")).rows.length,0);
 assert.equal((await query("select public.ifund_set_connection_assistance($1) enabled",[true])).rows[0].enabled,true);
 assert.equal((await query("select enabled from public.ifund_my_connection_assistance()")).rows[0].enabled,true);
 assert.equal((await query("select public.ifund_set_connection_assistance($1) enabled",[false])).rows[0].enabled,true);
 assert.equal((await query("select enabled from public.ifund_my_connection_assistance()")).rows[0].enabled,false);
 await assert.rejects(query("select public.ifund_set_connection_assistance($1)",[null]),/Choose whether connection guidance/);
 await who(stranger);
 assert.equal((await query("select * from public.ifund_my_connection_assistance()")).rows.length,0);
 assert.equal((await query("select * from public.ifund_my_public_links()")).rows.length,0);
 assert.equal((await query("select * from public.ifund_my_share_choices()")).rows.length,0);
 await db.exec("reset role");
 await query("update auth.users set email_confirmed_at=null where id=$1",[stranger]);
 await who(stranger);
 await assert.rejects(query("select public.ifund_save_public_link($1,$2,$3,$4)",[
  "gofundme","https://www.gofundme.com/f/test","Test",null
 ]),/Verified active account required/);
 await who(owner);
 assert.equal((await query("select public.ifund_remove_public_link($1) removed",["gofundme"])).rows[0].removed,true);
 assert.equal((await query("select * from public.ifund_my_public_links()")).rows.length,0);
 await who(null,"anon");
 await assert.rejects(query("select * from public.ifund_my_connection_assistance()"),/permission denied/);
 await assert.rejects(query("select * from public.ifund_my_public_links()"),/permission denied/);
});


test("runtime JavaScript catalogs exactly match their retained canonical JSON sources", () => {
 const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
 assert.deepEqual(providerCatalog, readJson("../worker/connections/provider-catalog.json"));
 assert.deepEqual(positionContracts, readJson("../worker/services/position-contracts.json"));
 assert.deepEqual(skillManifest, readJson("../worker/services/skills/manifest.json"));
 const skill = serviceSkill("chief_of_staff");
 assert.equal(skill.id, "chief_of_staff");
 assert.ok(skill.instructions.length > 1000);
 assert.equal(skill.source_sha256, "eccac6ca3b31066d0c5817550834bd6a092348bb170e87d66459c993d1fda313");
});





test("browser Supabase clients reject insecure and non-canonical project URLs", () => {
 const authSource = readFileSync(new URL("../apps/web/src/api/auth.js", import.meta.url), "utf8");
 const publicSource = readFileSync(new URL("../apps/web/src/api/publicData.js", import.meta.url), "utf8");
 for (const source of [authSource, publicSource]) {
  assert.match(source, /CANONICAL_SUPABASE_URL/);
  assert.match(source, /parsed\.origin === CANONICAL_SUPABASE_URL/);
  assert.match(source, /parsed\.pathname === "\/"/);
  assert.match(source, /parsed\.username/);
  assert.match(source, /parsed\.password/);
  assert.doesNotMatch(source, /hostname === .*supabase\.co/);
 }
});

test("team context and privileged document cleanup refuse non-canonical Supabase projects", async () => {
 const wrong = {
  SUPABASE_URL: "https://another-project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
  SUPABASE_SECRET_KEY: ["sb","secret"].join("_") + "_test_key_with_sufficient_length",
  IFUND_TEAM_CONTEXT_ENABLED: "enabled",
  IFUND_CAMPAIGN_DOCUMENTS_ENABLED: "enabled",
 };
 const fetcher = () => assert.fail("A non-canonical project must not receive requests.");
 await assert.rejects(appendTeamContext({
  env: wrong, jwt: "test.member.token", eventKey: owner, agentId: "story",
  content: "hello", speaker: "user", fetcher,
 }), /canonical IFund project/i);
 await assert.rejects(readTeamContext({ env: wrong, jwt: "test.member.token", fetcher }), /canonical IFund project/i);
 await assert.rejects(readCampaignDocumentContext({
  env: wrong, jwt: "test.member.token", campaignId: ownedCampaign, fetcher,
 }), /canonical IFund project/i);
 await assert.rejects(cleanupPrivateCampaignDocuments({
  env: wrong, requestId: owner, jwt: "test.admin.token", fetcher,
 }), /not configured/i);
});

test("PayPal sandbox runtime is pinned to the canonical Supabase project", () => {
 const valid = {
  IFUND_PAYPAL_SANDBOX_ENABLED: "enabled",
  PAYPAL_CLIENT_ID: "sandbox_id",
  PAYPAL_CLIENT_SECRET: "sandbox_secret",
  PAYPAL_WEBHOOK_ID: "webhook",
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_SECRET_KEY: ["sb","secret"].join("_") + "_test_key_with_sufficient_length",
 };
 assert.equal(sandboxConfigured(valid), true);
 assert.equal(sandboxConfigured({ ...valid, SUPABASE_URL: "https://another-project.supabase.co" }), false);
 assert.equal(sandboxConfigured({ ...valid, SUPABASE_SECRET_KEY: "short" }), false);
});

test("connection methods advertise OAuth only when the provider has a registered runtime route", () => {
 const supported = new Set(oauthProviders);
 assert.equal(connectionMethods("eventbrite").method, "oauth");
 assert.equal(connectionMethods("facebook").method, "oauth");
 assert.equal(connectionMethods("google").method, "oauth");
 assert.equal(connectionMethods("twitch").method, "oauth");
 assert.equal(connectionMethods("patreon").method, "oauth");
 assert.equal(connectionMethods("youtube").method, "oauth");
 assert.equal(connectionMethods("pinterest").method, "oauth");
 assert.equal(connectionMethods("reddit").method, "oauth");
 assert.equal(connectionMethods("x").method, "oauth");
 for (const id of ["gmail","googledrive","googlecalendar","notion","outlook","microsoft_teams","one_drive","dropbox","gitlab","gumroad","wordpress_com"]) {
  assert.equal(connectionMethods(id).method, "protected_provider_step", id);
  assert.equal(supported.has(id), false, id);
 }
 assert.equal(connectionMethods("gofundme").method, "public_page");
 const future = new Date(Date.now() + 3600000).toISOString();
 assert.equal(connectionMethods("gmail", { provider: "gmail", status: "verified", valid_until: future, transport: "oauth" }).status, "setup_required");
 assert.equal(connectionMethods("facebook", { provider: "facebook", status: "verified", valid_until: future, transport: "oauth" }).status, "registration_verified");
 assert.ok(CONNECTION_PLATFORMS.every(platform => connectionProvider(platform.id)), "every member-facing platform must exist in the backend catalog");
});

test("provider catalog loads through the Worker JavaScript module and exposes only safe summary fields", () => {
 const providers = connectionCatalog();
 assert.ok(providers.length >= 40);
 assert.equal(new Set(providers.map((provider) => provider.id)).size, providers.length);
 assert.deepEqual(providers.find((provider) => provider.id === "gofundme"), {
  id: "gofundme",
  name: "GoFundMe",
  kind: "crowdfunding",
  logo: "/platform-logos/gofundme.svg",
 });
 assert.equal(connectionProvider("gofundme").legacy_auth_hint, "link");
 assert.equal(connectionProvider("not-a-provider"), null);
 assert.ok(providers.every((provider) =>
  Object.keys(provider).every((key) => ["id", "name", "kind", "logo"].includes(key))
 ));
});
