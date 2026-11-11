import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  listOwnerCampaigns, listMyCampaigns, loadOwnerCampaign, saveOwnerCampaign,
  setCampaignStatus, deleteDraftCampaign, isCampaignConflict, CAMPAIGN_CONFLICT_MESSAGE,
} from "../src/api/ownerCampaigns.js";
import { TERMS_VERSION } from "../src/lib/legalPolicy.js";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const DRAFT_ID = "33333333-3333-4333-8333-333333333333";
const ACTIVE_ID = "44444444-4444-4444-8444-444444444444";
const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

const campaign = (over = {}) => ({
  id: DRAFT_ID, owner_id: OWNER, title: "Plaza lights", summary: "Light the plaza.",
  story: "Longer story.", category: "community", goal_amount: 1200,
  cover_image_url: "", status: "draft", created_at: "2026-11-01T10:00:00Z", ...over,
});

/**
 * Minimal in-memory stand-in for the Supabase client that records every call,
 * so the tests can assert the exact table, columns, filters and payloads used.
 */
function fakeClient({
  rows = [campaign()],
  authenticatedUserId = OWNER,
  changeAfterFirstUserCheck = false,
  profileActive = true,
  unverifiedEmail = false,
  anonymousUser = false,
  failSelect = false,
  failInsert = false,
  failUpdate = false,
  failDelete = false,
  returnOtherOwner = false,
  statusOverride = null,
  insertStatusOverride = null,
  legalAccepted = true,
  legalReadError = false,
  acceptanceOwner = OWNER,
  acceptanceVersion = TERMS_VERSION,
  // Simulates another browser session changing the row *between* this
  // operation's pre-read and its write, which is the real race window.
  raceStatusAfterRead = null,
} = {}) {
  const calls = [];
  const store = rows.map((row) => ({ ...row }));
  let authReads = 0;
  let lastInsert = null;
  let lastUpdate = null;
  const client = {
    calls,
    auth: {
      async getUser() {
        authReads++;
        const id = changeAfterFirstUserCheck && authReads > 1 ? OTHER : authenticatedUserId;
        return {
          data: { user: { id, is_anonymous: anonymousUser, email_confirmed_at: unverifiedEmail || anonymousUser ? null : "2026-10-15T12:00:00Z" } },
          error: null,
        };
      },
    },
    from(table) {
      const query = { table, op: "select", columns: null, filters: [], payload: null };
      calls.push({ type: "table", table });
      const api = {
        select(columns) { query.columns = columns; calls.push({ type: "select", table, columns }); return api; },
        insert(payload) { query.op = "insert"; query.payload = payload; calls.push({ type: "insert", table, payload }); return api; },
        update(payload) { query.op = "update"; query.payload = payload; calls.push({ type: "update", table, payload }); return api; },
        delete() { query.op = "delete"; calls.push({ type: "delete", table }); return api; },
        eq(column, value) { query.filters.push([column, value]); calls.push({ type: "eq", table, column, value }); return api; },
        order(column, config) { calls.push({ type: "order", table, column, config }); return api; },
        limit(value) { calls.push({ type: "limit", table, value }); return api; },
        maybeSingle() { return Promise.resolve(resolve(api, "maybe")); },
        single() { return Promise.resolve(resolve(api, "single")); },
        then(onFulfilled, onRejected) { return Promise.resolve(resolve(api, "list")).then(onFulfilled, onRejected); },
      };
      // Mirrors postgrest-js: .single() errors on zero rows, .maybeSingle()
      // resolves { data: null, error: null }, and a list query resolves [].
      function resolve(_api, mode) {
        const singleRow = mode !== "list";
        const noRows = () => (mode === "maybe" ? { data: null, error: null }
          : mode === "single" ? { data: null, error: { message: "no rows" } }
            : { data: [], error: null });
        if (table === "ifund_profiles") {
          return {
            data: profileActive ? { account_status: "active", account_deletion_pending: false } : { account_status: "suspended", account_deletion_pending: false },
            error: null,
          };
        }
        if (table === "ifund_legal_acceptances") {
          return { data: legalAccepted ? { owner_id: acceptanceOwner, terms_version: acceptanceVersion, explicit_consent: true } : null,
            error: legalReadError ? { message: "unavailable" } : null };
        }
        if (table !== "ifund_campaigns") return { data: null, error: { message: "unexpected table" } };
        const byId = query.filters.find(([column]) => column === "id")?.[1];
        const byOwner = query.filters.find(([column]) => column === "owner_id")?.[1];
        if (query.op === "select") {
          if (failSelect) return { data: null, error: { message: "select failed" } };
          let found = store.filter((row) => (byId === undefined || row.id === byId) &&
            (byOwner === undefined || row.owner_id === byOwner));
          if (returnOtherOwner) found = found.map((row) => ({ ...row, owner_id: OTHER }));
          if (singleRow) {
            if (found.length !== 1) return noRows();
            const snapshot = { ...found[0] };
            // Another session commits a change right after this read returns.
            if (raceStatusAfterRead !== null) {
              const index = store.findIndex((row) => row.id === snapshot.id);
              if (index >= 0) store[index].status = raceStatusAfterRead;
            }
            return { data: snapshot, error: null };
          }
          return { data: found.map((row) => ({ ...row })), error: null };
        }
        if (query.op === "insert") {
          lastInsert = query.payload;
          if (failInsert) return { data: null, error: { message: "insert failed" } };
          const created = { id: ACTIVE_ID, created_at: "2026-11-01T10:00:00Z", ...query.payload };
          if (insertStatusOverride !== null) created.status = insertStatusOverride;
          store.push(created);
          return singleRow ? { data: { ...created }, error: null } : { data: [{ ...created }], error: null };
        }
        if (query.op === "update") {
          lastUpdate = query.payload;
          if (failUpdate) return { data: null, error: { message: "update failed" } };
          // Real PostgREST applies every filter, including a status filter, so a
          // compare-and-swap on status matches zero rows once the row moved on.
          const statusFilter = query.filters.find(([column]) => column === "status");
          const index = store.findIndex((row) => row.id === byId && row.owner_id === byOwner &&
            (statusFilter === undefined || row.status === statusFilter[1]));
          if (index < 0) return noRows();
          store[index] = { ...store[index], ...query.payload };
          if (statusOverride !== null) store[index].status = statusOverride;
          return singleRow ? { data: { ...store[index] }, error: null } : { data: [{ ...store[index] }], error: null };
        }
        if (query.op === "delete") {
          if (failDelete) return { data: null, error: { message: "delete failed" } };
          const index = store.findIndex((row) => row.id === byId && row.owner_id === byOwner &&
            (query.filters.some(([c, v]) => c === "status" && row.status === v) || !query.filters.some(([c]) => c === "status")));
          if (index < 0) return { data: [], error: null };
          const removed = store.splice(index, 1)[0];
          return { data: [{ id: removed.id, owner_id: removed.owner_id, status: removed.status }], error: null };
        }
        return { data: null, error: { message: "unsupported" } };
      }
      return api;
    },
  };
  return { client, calls, store, get lastInsert() { return lastInsert; }, get lastUpdate() { return lastUpdate; } };
}

test("the management pages are real member-only routes and never touch Base44", () => {
  const app = source("src/App.jsx");
  assert.match(app, /path="\/campaigns" element=\{<MemberAccess><MyCampaigns \/><\/MemberAccess>\}/);
  assert.match(app, /path="\/campaigns\/:id\/edit" element=\{<MemberAccess><EditCampaign \/><\/MemberAccess>\}/);
  for (const name of ["MyCampaigns", "EditCampaign"]) {
    const page = source(`src/pages/${name}.jsx`);
    assert.doesNotMatch(page, /base44Client|base44\.functions|base44\.entities/, name);
    assert.doesNotMatch(page, /service_role|SUPABASE_SERVICE_ROLE_KEY/, name);
  }
});

test("reads are owner-scoped with explicit projections", async () => {
  const f = fakeClient();
  const list = await listOwnerCampaigns(f.client);
  assert.equal(list.length, 1);
  assert.ok(f.calls.some((c) => c.type === "eq" && c.table === "ifund_campaigns" && c.column === "owner_id" && c.value === OWNER));
  const select = f.calls.find((c) => c.type === "select" && c.table === "ifund_campaigns");
  assert.ok(select.columns.includes("owner_id") && !select.columns.includes("*"));

  const one = await loadOwnerCampaign(f.client, DRAFT_ID);
  assert.equal(one.id, DRAFT_ID);
  assert.ok(f.calls.some((c) => c.type === "eq" && c.column === "id" && c.value === DRAFT_ID));
});

test("another member's rows are rejected even if the network returns them", async () => {
  await assert.rejects(listOwnerCampaigns(fakeClient({ returnOtherOwner: true }).client), /could not be loaded/);
  await assert.rejects(loadOwnerCampaign(fakeClient({ rows: [campaign({ owner_id: OTHER })] }).client, DRAFT_ID), /not found for your account/);
});

test("an anonymous Supabase member is a valid owner but an unverified email is not", async () => {
  const f = fakeClient({ anonymousUser: true });
  const rows = await listOwnerCampaigns(f.client);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].owner_id, OWNER);
  assert.ok(f.calls.some(call => call.table === "ifund_profiles"));
});

test("an unverified email or inactive account cannot manage campaigns", async () => {
  await assert.rejects(listOwnerCampaigns(fakeClient({ unverifiedEmail: true }).client), /guest account or sign in/);
  await assert.rejects(listOwnerCampaigns(fakeClient({ profileActive: false }).client), /no longer available/);
  await assert.rejects(saveOwnerCampaign(fakeClient({ profileActive: false }).client, {}, { status: "draft" }), /no longer available/);
});

test("database errors are surfaced, never reported as success", async () => {
  await assert.rejects(listOwnerCampaigns(fakeClient({ failSelect: true }).client), /could not be loaded/);
  await assert.rejects(
    saveOwnerCampaign(fakeClient({ failInsert: true }).client, { title: "New", category: "community", goal_amount: "10" }, { status: "draft" }),
    /was not saved/,
  );
  await assert.rejects(setCampaignStatus(fakeClient({ failUpdate: true }).client, DRAFT_ID, "active"), /not saved/);
  await assert.rejects(deleteDraftCampaign(fakeClient({ failDelete: true }).client, DRAFT_ID), /Only an unpublished draft/);
});

test("creating a campaign sets owner_id from the verified session, never the form", async () => {
  const f = fakeClient({ rows: [] });
  const saved = await saveOwnerCampaign(f.client, {
    title: "New idea", summary: "", story: "", category: "community", goal_amount: "50", cover_image_url: "",
  }, { status: "draft" });
  assert.equal(f.lastInsert.owner_id, OWNER);
  assert.equal(f.lastInsert.status, "draft");
  assert.equal(saved.owner_id, OWNER);
  assert.equal("created_at" in f.lastInsert, false);
  assert.equal("updated_at" in f.lastInsert, false);
});

test("explicit creator publishing saves reviewed content and confirms the published receipt", async () => {
  const form = { ...campaign(), title: "Reviewed campaign", owner_id: OTHER };
  const create = fakeClient({ rows: [] });
  const published = await saveOwnerCampaign(create.client, form, { status: "active", expectedStatus: "draft" });
  assert.equal(published.status, "active");
  assert.equal(published.owner_id, OWNER);
  assert.equal(create.lastInsert.title, "Reviewed campaign");
  const existing = fakeClient();
  assert.equal((await saveOwnerCampaign(existing.client, form, { id: DRAFT_ID, status: "active", expectedStatus: "draft" })).id, DRAFT_ID);
  assert.equal(existing.lastUpdate.status, "active");
  assert.equal(existing.store.length, 1);
});

test("creator publishing refuses a campaign already changed before the write begins", async () => {
  for (const status of ["active", "paused"]) {
    const f = fakeClient({ rows: [campaign({ status })] });
    await assert.rejects(saveOwnerCampaign(f.client, campaign(), { id: DRAFT_ID, status: "active", expectedStatus: "draft" }), /changed in another session/);
    assert.equal(f.calls.some(c => c.type === "update"), false);
    assert.equal(f.store[0].status, status);
  }
});

test("saving or publishing requires confirmed current consent and valid content", async () => {
  for (const options of [{ legalAccepted: false }, { legalReadError: true }, { acceptanceOwner: OTHER }, { acceptanceVersion: "old" }]) {
    const f = fakeClient(options);
    await assert.rejects(saveOwnerCampaign(f.client, campaign(), { status: "active" }), /member agreement/);
    assert.equal(f.calls.some(c => c.type === "insert" || c.type === "update"), false);
  }
  const incomplete = fakeClient();
  await assert.rejects(saveOwnerCampaign(incomplete.client, { ...campaign(), story: "" }, { status: "active" }), /story before publishing/);
  assert.equal(incomplete.calls.some(c => c.type === "insert" || c.type === "update"), false);
  const draft = fakeClient({ rows: [] });
  assert.equal((await saveOwnerCampaign(draft.client, { title: "Work in progress", category: "animals" })).status, "draft");
});

test("creator publishing rejects unauthenticated, suspended and other-owner writes", async () => {
  for (const options of [{ authenticatedUserId: null }, { unverifiedEmail: true }, { profileActive: false }, { rows: [campaign({ owner_id: OTHER })] }]) {
    const f = fakeClient(options);
    await assert.rejects(saveOwnerCampaign(f.client, campaign(), { id: DRAFT_ID, status: "active", expectedStatus: "draft" }));
    assert.equal(f.calls.some(c => c.type === "insert" || c.type === "update"), false);
  }
});

test("a create receipt with an unexpected status is never reported as a publication", async () => {
  await assert.rejects(saveOwnerCampaign(fakeClient({ rows: [], insertStatusOverride: "draft" }).client, campaign(), { status: "active" }), /saved status could not be confirmed/);
});

test("publishing is refused client-side when the campaign is incomplete", async () => {
  const f = fakeClient({ rows: [campaign({ summary: "", story: "", goal_amount: 0 })] });
  // The first unmet publish requirement is reported; any of them is valid.
  await assert.rejects(setCampaignStatus(f.client, DRAFT_ID, "active"), /before publishing|greater than zero/i);
  assert.equal(f.calls.some((c) => c.type === "update"), false, "no write may be attempted");
});

test("a draft can be published and an active campaign can be paused", async () => {
  const publish = fakeClient();
  const published = await setCampaignStatus(publish.client, DRAFT_ID, "active");
  assert.equal(published.status, "active");
  assert.deepEqual(publish.lastUpdate, { status: "active" });

  const pause = fakeClient({ rows: [campaign({ id: ACTIVE_ID, status: "active" })] });
  const paused = await setCampaignStatus(pause.client, ACTIVE_ID, "paused");
  assert.equal(paused.status, "paused");

  const resume = fakeClient({ rows: [campaign({ id: ACTIVE_ID, status: "paused" })] });
  assert.equal((await setCampaignStatus(resume.client, ACTIVE_ID, "active")).status, "active");
});

test("illegal status transitions and unconfirmed status writes fail closed", async () => {
  const f = fakeClient({ rows: [campaign({ id: ACTIVE_ID, status: "active" })] });
  await assert.rejects(setCampaignStatus(f.client, ACTIVE_ID, "draft"), /cannot be set to/);
  // The database left the row in its previous state even though the client
  // allowed the transition; the write must not be reported as success.
  const stale = fakeClient({ rows: [campaign()], statusOverride: "draft" });
  await assert.rejects(setCampaignStatus(stale.client, DRAFT_ID, "active"), /changed in another session/);
  await assert.rejects(setCampaignStatus(f.client, "not-a-uuid", "active"), /Invalid campaign reference/);
});

test("saving edits keeps the stored status and refuses an unreachable transition", async () => {
  const f = fakeClient();
  const saved = await saveOwnerCampaign(f.client, {
    title: "Renamed", summary: "Updated", story: "Updated", category: "education", goal_amount: "900", cover_image_url: "",
  }, { id: DRAFT_ID, status: "draft" });
  assert.equal(saved.status, "draft");
  assert.equal(f.lastUpdate.status, "draft");

  const active = fakeClient({ rows: [campaign({ id: ACTIVE_ID, status: "active" })] });
  await assert.rejects(saveOwnerCampaign(active.client, { title: "x", category: "community", goal_amount: "1" }, { id: ACTIVE_ID, status: "draft" }), /cannot be saved as draft/);
});

test("only unpublished drafts can be deleted", async () => {
  const draft = fakeClient();
  assert.equal(await deleteDraftCampaign(draft.client, DRAFT_ID), DRAFT_ID);
  assert.ok(draft.calls.some((c) => c.type === "eq" && c.column === "status" && c.value === "draft"));

  const published = fakeClient({ rows: [campaign({ id: ACTIVE_ID, status: "active" })] });
  await assert.rejects(deleteDraftCampaign(published.client, ACTIVE_ID), /Only an unpublished draft/);
});

test("a session change mid-flight is not accepted as the original owner", async () => {
  await assert.rejects(listOwnerCampaigns(fakeClient({ changeAfterFirstUserCheck: true }).client), /account changed/);
});

test("every mutation carries the validated status as a compare-and-swap guard", async () => {
  const save = fakeClient();
  await saveOwnerCampaign(save.client, {
    title: "Renamed", summary: "Updated", story: "Updated", category: "community", goal_amount: "500", cover_image_url: "",
  }, { id: DRAFT_ID, status: "draft" });
  assert.ok(save.calls.some((c) => c.type === "eq" && c.table === "ifund_campaigns" && c.column === "status" && c.value === "draft"),
    "the save must filter on the status it validated");

  const status = fakeClient();
  await setCampaignStatus(status.client, DRAFT_ID, "active");
  assert.ok(status.calls.some((c) => c.type === "eq" && c.column === "status" && c.value === "draft"),
    "the transition must filter on the status it validated");
});

test("a stale draft save loses to a concurrent publish instead of reverting it", async () => {
  // Another tab publishes the campaign between this tab's read and its write.
  const f = fakeClient({ rows: [campaign()], raceStatusAfterRead: "active" });
  await assert.rejects(
    saveOwnerCampaign(f.client, {
      title: "Renamed", summary: "Updated", story: "Updated", category: "community", goal_amount: "500", cover_image_url: "",
    }, { id: DRAFT_ID, status: "draft" }),
    /changed in another session/,
  );
  // The concurrent publish must survive: the stale save must not have
  // reverted the status or overwritten the published content.
  assert.equal(f.store[0].status, "active");
  assert.equal(f.store[0].title, "Plaza lights");
});

test("a stale publish cannot be applied twice", async () => {
  // Two tabs both read 'draft' and both try to publish. The first wins; the
  // second's compare-and-swap matches no row and fails closed.
  const f = fakeClient({ rows: [campaign()], raceStatusAfterRead: "active" });
  await assert.rejects(setCampaignStatus(f.client, DRAFT_ID, "active"), /changed in another session/);
  assert.equal(f.store[0].status, "active");
});

test("a concurrent publish cannot be overwritten by a stale resume", async () => {
  // Another tab resumed the campaign to active between this tab's read and its
  // write, so this stale resume must fail closed.
  const f = fakeClient({ rows: [campaign({ id: ACTIVE_ID, status: "paused" })], raceStatusAfterRead: "active" });
  await assert.rejects(setCampaignStatus(f.client, ACTIVE_ID, "active"), /changed in another session/);
  assert.equal(f.store[0].status, "active");
});

test("a write that returns a different status than requested is rejected", async () => {
  const f = fakeClient({ rows: [campaign()], statusOverride: "paused" });
  await assert.rejects(setCampaignStatus(f.client, DRAFT_ID, "active"), /changed in another session/);
});

test("a stale save is reported as a conflict, not as a generic save failure", async () => {
  const f = fakeClient({ rows: [campaign()], raceStatusAfterRead: "paused" });
  await assert.rejects(
    saveOwnerCampaign(f.client, { title: "x", category: "community", goal_amount: "1" }, { id: DRAFT_ID, status: "draft" }),
    /changed in another session/,
  );
});

test("a conflict is distinguishable from a generic save failure", async () => {
  assert.equal(isCampaignConflict(new Error(CAMPAIGN_CONFLICT_MESSAGE)), true);
  assert.equal(isCampaignConflict(new Error("Your campaign changes were not saved.")), false);
  assert.equal(isCampaignConflict(undefined), false);

  const f = fakeClient({ rows: [campaign()], raceStatusAfterRead: "active" });
  const cause = await setCampaignStatus(f.client, DRAFT_ID, "active").then(() => null, (e) => e);
  assert.equal(isCampaignConflict(cause), true);

  const broken = fakeClient({ rows: [campaign()], failUpdate: true });
  const other = await setCampaignStatus(broken.client, DRAFT_ID, "active").then(() => null, (e) => e);
  assert.equal(isCampaignConflict(other), false, "a database error is not a concurrency conflict");
});

test("both management pages resync after a concurrency conflict", () => {
  for (const name of ["MyCampaigns", "EditCampaign"]) {
    const page = source(`src/pages/${name}.jsx`);
    assert.match(page, /isCampaignConflict/, `${name} must detect conflicts`);
    assert.match(page, /if \(isCampaignConflict\(cause\)\) load\(\);/, `${name} must reload on conflict`);
  }
});

test("the dashboard list keeps the verified transport and adds no funding totals", async () => {
  const f = fakeClient({ rows: [campaign(), campaign({ id: ACTIVE_ID, status: "active" })] });
  const rows = await listMyCampaigns(f.client);
  assert.equal(rows.length, 2);
  // Same verification path as every other owner read.
  assert.ok(f.calls.some((call) => call.table === "ifund_profiles"), "must verify the account lifecycle");
  assert.ok(f.calls.some((call) => call.type === "eq" && call.column === "owner_id" && call.value === OWNER));
  // Funding totals are unknown in this schema, so they stay null rather than 0.
  for (const row of rows) {
    assert.equal(row.raised_amount, null);
    assert.equal(row.donor_count, null);
  }
  await assert.rejects(listMyCampaigns(fakeClient({ unverifiedEmail: true }).client), /guest account or sign in/);
  await assert.rejects(listMyCampaigns(fakeClient({ profileActive: false }).client), /no longer available/);
  await assert.rejects(listMyCampaigns(fakeClient({ failSelect: true }).client), /could not be loaded/);
});

test("Dashboard no longer queries the campaign table inline", () => {
  const page = source("src/pages/Dashboard.jsx");
  assert.match(page, /import \{ listMyCampaigns \} from "@\/api\/ownerCampaigns"/);
  assert.match(page, /listMyCampaigns\(client\)/);
  assert.doesNotMatch(page, /from\("ifund_campaigns"\)/);
});
