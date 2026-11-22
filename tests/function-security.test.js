// Function security guard.
//
// SECURITY DEFINER functions must pin search_path. Stateful definer functions
// are permitted only through a narrow, explicit allowlist and remain subject to
// the pinned-path and explicit-revoke checks below.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function walkSql(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkSql(full, out);
    else if (entry.name.endsWith(".sql")) out.push(full);
  }
  return out;
}

const SQL_FILES = walkSql(join(repoRoot, "supabase"));

// These reviewed functions may be volatile or mutate state. Keep this list
// narrow and explicit: it never exempts a migration, schema, pinned search path
// or PUBLIC-execute revocation. Source review is not production acceptance.
const MUTATING_DEFINER_FUNCTIONS = new Set([
  // Owner JWT plus private Worker key; no direct table or financial authority.
  "ifund_workforce_runtime.begin_story",
  "ifund_workforce_runtime.started",
  "ifund_workforce_runtime.finish",
  "ifund_workforce_runtime.cancel_queued",
  "public.ifund_studio_consume_ai_quota",
  "ifund_private.ifund_studio_capture_page_version",
  // Story contracts reviewed independently in PR #210. These private functions
  // enforce confirmed identity, current membership/consent, owner scope and
  // leases or revisions. Executable Postgres tests cover their denial paths;
  // none grants publication, campaign mutation or financial authority.
  "ifund_story_runtime.begin_request",
  "ifund_story_runtime.finish_request",
  "ifund_story_runtime.cancel_draft",
  "ifund_story_runtime.select_suggestion",
  "ifund_story_runtime.revise_wording",
  "ifund_story_runtime.save_preferences",
  "ifund_story_runtime.clear_preferences",
  // Private trigger for existing verified-donation rollups.
  "private.ifund_sync_funding_totals",
  "private.ifund_finalize_paypal_capture",
  "private.ifund_record_verified_paypal_refund",
  "private.ifund_register_paypal_order",
  // The member functions derive the caller from auth.uid() and require current
  // terms plus an active, verified account. Editorial writes also check the
  // owning blog and verified publisher role or member entitlement.
  "public.ifund_save_my_profile",
  "public.ifund_set_my_avatar",
  "public.ifund_create_member_blog",
  "public.ifund_save_blog_story",
  // OAuth token writes are service-role-only and persist ciphertext, never
  // browser-supplied connection claims. The member disconnect routine derives
  // auth.uid(), checks active membership and serializes owner/provider changes.
  // provider-connection-lifecycle.test.js executes the grants, owner isolation,
  // disconnect barrier and stale-refresh denial against PostgreSQL.
  "public.ifund_store_provider_connection",
  "public.ifund_store_provider_connection_v2",
  "public.ifund_store_provider_connection_v3",
  "public.ifund_disconnect_provider",
  // Atomic, authenticated and rate-capped free image quota from the separately tested pending migration.
  "public.ifund_ai_image_consume_free_quota",
  // Existing privileged mutations discovered by the repository-wide definer scan.
  // Each is an exact function name, never a wildcard migration exemption.
  // The separate test below must independently prove explicit PUBLIC revocation;
  // owner/member, admin, or service-role checks remain enforced in the function.
  // Financial RPCs require verified provider/ledger evidence before payout release.
  "private.ifund_apply_verified_paypal_reversal",
  "public.ifund_request_withdrawal",
  "public.ifund_cancel_withdrawal_request",
  "public.ifund_connect_paypal_payout_to_verified_email",
  "public.ifund_disconnect_paypal_payout_destination",
  "public.ifund_internal_prepare_paypal_payout",
  "public.ifund_internal_record_payout_submission",
  "public.ifund_internal_record_payout_submission_outcome",
  "public.ifund_internal_record_payout_state",
  "public.ifund_social_like",
  "public.ifund_social_report",
  "public.ifund_social_review",
  "public.ifund_social_friend",
  "public.ifund_social_reply",
  "public.ifund_social_archive_like",
  "public.ifund_social_archive_report",
  "public.ifund_social_archive_review",
  "public.ifund_social_archive_reply",
  "public.ifund_save_my_social_draft",
  "public.ifund_clear_my_social_draft",
  "public.ifund_echo_send_opted_in_update",
  "public.ifund_save_message_template",
  "public.ifund_delete_message_template",
  "public.ifund_queue_editorial_agent_review",
  "public.ifund_add_editorial_review_comment",
  "public.ifund_record_editorial_worker_turn",
  "public.ifund_claim_editorial_agent_reviews",
  "public.ifund_set_marketing_consent",
  "public.ifund_create_growth_experiment",
  "public.ifund_close_growth_experiment",
  "public.ifund_audit_marketing_consent_change",
  "public.ifund_create_support_ticket",
  "public.ifund_super_admin_close_support_ticket",
  "public.ifund_set_nexus_brief_preferences",
  "public.ifund_dispatch_nexus_briefs",
  "public.ifund_acknowledge_editorial_review",
  "public.ifund_set_opportunity_watch",
  "public.ifund_opportunity_watch_source_update",
  "public.ifund_set_story_voice_preferences",
  "public.ifund_add_support_reply",
  // Confirmed active owner only; public links are not OAuth grants. Executable
  // owner/stranger/anonymous cases live in connections-security.test.js.
  "public.ifund_save_public_link",
  "public.ifund_remove_public_link",
  "public.ifund_set_share_choice",
  "public.ifund_set_connection_assistance",
  // Owner-derived conversation state. Writes attesting an agent require the
  // private Worker credential; corrections/deletions cannot affect strangers.
  // team-context-db.test.js executes those boundaries and replay denials.
  "public.ifund_team_record_user",
  "public.ifund_team_record_agent",
  "public.ifund_team_erase",
  "public.ifund_team_correct",
  // Trigger-only functions: no browser EXECUTE grant. Quota, receipt, owner,
  // revocation and orphan guards execute in campaign-documents-db.test.js.
  "public.ifund_campaign_documents_guard",
  "public.ifund_campaign_document_deletion_guard",
  "public.ifund_campaign_document_metadata_delete_guard",
  "public.ifund_campaign_documents_prevent_orphans",
  // Review is a separate super-admin operation bound to an active session.
  // Inventory and preflight are read-only PL/pgSQL routines whose default
  // volatility also requires review here. No function erases an account or
  // marks deletion complete; private-document-erasure.test.js covers gates.
  "public.ifund_super_admin_review_private_document_cleanup",
  "public.ifund_super_admin_private_document_inventory",
  "public.ifund_admin_account_erasure_preflight",
  // Deletion initiation is owner-derived and idempotent, including an
  // authenticated anonymous guest; it grants no direct erasure authority.
  // The queue checks the verified super-admin role before any cross-user read.
  "public.ifund_request_account_deletion",
  "public.ifund_super_admin_account_deletion_queue",
  // Owner-derived, bounded content-block preferences; no financial effect.
  // Blocking needs an active confirmed account and a published organizer;
  // unblocking remains available without an active membership requirement.
  // Owner-only verified signup trial/code issuance, one-time referral claim,
  // and trigger-only published-campaign qualification. No paid-plan grant.
  // Fifteen-item trial AI content counter is owner scoped; manual tools are not charged.
  "public.ifund_trial_ai_generation_reserve",
  "public.ifund_trial_ai_generation_complete",
  "public.ifund_trial_ai_generation_release",
  "public.ifund_trial_ai_generation_status",
  "public.ifund_agent_referral_status",
  "public.ifund_claim_campaign_referral",
  "public.ifund_credit_published_referral",
  "public.ifund_mobile_block_organizer",
  "public.ifund_mobile_unblock_organizer",
  // Restored specialist contracts were matched against all 55 hosted function
  // bodies before source integration. Their executable *-agent-db tests cover
  // owner/lifecycle/entitlement denial, leases, receipt replay and atomic bulk
  // changes. Delivery also rechecks the reviewed audience and current opt-out;
  // provider connection requests cannot execute OAuth, publishing or payments.
  "ifund_strategy_runtime.begin_request",
  "ifund_strategy_runtime.finish_request",
  "ifund_strategy_runtime.bulk_update",
  "ifund_growth_runtime.begin_request",
  "ifund_growth_runtime.finish_request",
  "ifund_growth_runtime.bulk_update",
  "ifund_communications_runtime.save_draft",
  "ifund_communications_runtime.save_owner",
  "ifund_communications_runtime.begin_request",
  "ifund_communications_runtime.finish_request",
  "ifund_communications_runtime.cancel",
  "ifund_communications_runtime.prepare_send",
  "ifund_communications_runtime.send",
  "ifund_connections_runtime.grant_help",
  "ifund_connections_runtime.request_action",
  "ifund_connections_runtime.change_selected",
  "ifund_connections_runtime.campaign_deleted",
  // Operations-room and recent tooling definers, each reviewed with its
  // migration authors. These are admin/owner/worker-scoped: verified
  // identities, active accounts and confirmed terms or super-admin checks.
  // None grants publication, campaign mutation or financial authority, and
  // PUBLIC execute is revoked or granted to `authenticated` only where the
  // migration audit guard convention requires it.
  "public.ifund_guard_managed_campaign_content",
  "public.ifund_creator_mandate_sync_campaign_draft",
  "public.ifund_reserve_agent_question",
  "public.ifund_complete_agent_question",
  "public.ifund_release_agent_question",
  "public.ifund_notification_delivery_selfcheck",
  "public.ifund_schedule_inapp_reminder",
  "public.ifund_cancel_inapp_reminder",
  "public.ifund_dispatch_inapp_reminders",
  "public.ifund_set_campaign_email_option",
  "public.ifund_receive_paid_campaign_email",
  "public.ifund_set_campaign_email_campaign",
  "public.ifund_begin_campaign_email_checkout",
  "public.ifund_admin_review_outreach_candidate",
  "public.ifund_cancel_account_deletion",
  // What-If Mission definers (Nov 20, upstream migrations): owner-scoped
  // reviewed-plan writes with optimistic-revision guards, owner-verified
  // campaign bridges, owner-scoped audit triggers and tentative resource
  // bookmarks; none is financial, cross-owner or publication-authorizing, and
  // the upstream migrations revoke PUBLIC execute for these definers.
  "public.ifund_mission_save_reviewed_plan",
  "public.ifund_mission_link_owned_campaign",
  "public.ifund_mission_audit_change",
  "public.ifund_mission_bookmark_verified_resource",
  // Operations-room background runtime (Nov 20, upstream migrations):
  // token-gated bot claims against the private room, with a hard daily
  // claim cap, plus run completion and failure. Revoked from public.
  "public.ifund_ops_bot_claim",
  "public.ifund_ops_bot_complete",
  "public.ifund_ops_bot_fail",
]);

/** Every create [or replace] function header, with its body terminator. */
function functionHeaders(
  files = SQL_FILES,
  readSql = (file) => readFileSync(file, "utf8"),
) {
  const found = [];
  for (const file of files) {
    const text = readSql(file);
    const pattern =
      /create\s+(?:or\s+replace\s+)?function\s+([a-zA-Z0-9_.]+)\s*\([^)]*\)/gi;
    for (const match of text.matchAll(pattern)) {
      const after = text.slice(match.index + match[0].length);
      // Migrations also use $fn$, $ifund$ and other named dollar quotes.
      // Never let a body's SQL or comments masquerade as header attributes.
      const terminator = after.search(/\bas\s+\$(?:[a-z_][a-z0-9_]*)?\$/i);
      const header =
        terminator === -1 ? after.slice(0, 800) : after.slice(0, terminator);
      found.push({
        name: match[1],
        file: file.slice(repoRoot.length),
        header,
        definer: /security\s+definer/i.test(header),
        pinned: /set\s+search_path/i.test(header),
        source: text,
        offset: match.index,
      });
    }
  }
  return found;
}

test("named dollar quotes cannot hide an unpinned volatile definer behind body text", () => {
  for (const quote of ["$$", "$fn$", "$ifund$", "$team_correct$"]) {
    const [fn] = functionHeaders(
      [join(repoRoot, "fixture.sql")],
      () => `
      create function public.unreviewed() returns void
      language plpgsql security definer as ${quote}
      begin
        -- stable; set search_path = ''; these are not header attributes.
        null;
      end ${quote};
    `,
    );
    assert.equal(fn.definer, true);
    assert.equal(fn.pinned, false);
    assert.doesNotMatch(fn.header, /\bstable\b/i);
    assert.equal(MUTATING_DEFINER_FUNCTIONS.has(fn.name), false);
  }
});

test("the migration set defines functions at all", () => {
  const functions = functionHeaders();
  assert.ok(
    functions.length >= 3,
    "expected to find functions, found " + functions.length,
  );
});

test("every SECURITY DEFINER function pins its search_path", () => {
  const offenders = functionHeaders()
    .filter((f) => f.definer && !f.pinned)
    .map((f) => f.file + ": " + f.name);
  assert.deepEqual(
    offenders,
    [],
    "these SECURITY DEFINER functions resolve names through the caller's search_path:\n  " +
      offenders.join("\n  "),
  );
});

test("SECURITY DEFINER functions are read-only unless explicitly allowlisted", () => {
  const offenders = functionHeaders()
    .filter(
      (fn) =>
        fn.definer &&
        !/language\s+sql|\bstable\b/i.test(fn.header) &&
        !MUTATING_DEFINER_FUNCTIONS.has(fn.name),
    )
    .map((fn) => fn.file + ": " + fn.name);
  assert.deepEqual(
    offenders,
    [],
    "Mutating SECURITY DEFINER functions require explicit review",
  );
});

test("execute on a definer function is revoked from public before being granted", () => {
  const grants = SQL_FILES.map((f) => readFileSync(f, "utf8")).join("\n");
  for (const fn of functionHeaders().filter((f) => f.definer)) {
    const bare = fn.name.replace(/^[a-zA-Z0-9_]+\./, "");
    const explicitRevoke = new RegExp(
      "revoke\\s+all\\s+on\\s+function\\s+(?:[a-zA-Z0-9_]+\\.)?" +
        bare +
        "\\s*\\(",
      "i",
    ).test(grants);
    const schema = fn.name.includes(".") ? fn.name.split(".")[0] : "public";
    // A schema-wide revoke must follow this definition in the same migration.
    // A revoke in an earlier migration cannot protect a future new function.
    const schemaRevoke = new RegExp(
      "revoke\\s+all\\s+on\\s+all\\s+functions\\s+in\\s+schema\\s+" +
        schema +
        "\\s+from\\s+[^;]*\\bpublic\\b",
      "i",
    ).test(fn.source.slice(fn.offset));
    // Some established social RPCs are revoked through a bounded dynamic
    // list in one DO block. Accept it only when the exact signature occurs
    // in that list and the block executes revoke before grant.
    const groupedRevoke = [
      ...grants.matchAll(
        /revoke\s+all\s+on\s+function\s+([^;]+?)\s+from\s+[^;]+;/gi,
      ),
    ].some((match) => new RegExp("\\b" + bare + "\\s*\\(", "i").test(match[1]));
    const dynamicRevoke =
      fn.source.includes("'" + bare + "(") &&
      /foreach f in array array\[/i.test(fn.source) &&
      /execute\s+'revoke all on function public\.'\s*\|\|\s*f\s*\|\|\s*' from public,anon,authenticated'/i.test(
        fn.source,
      );
    assert.ok(
      explicitRevoke || groupedRevoke || schemaRevoke || dynamicRevoke,
      fn.name +
        " is SECURITY DEFINER but never has execute revoked from public",
    );
  }
});

test("functions this repository calls but does not define are recorded", () => {
  const defined = new Set(
    functionHeaders().map((f) => f.name.split(".").pop().toLowerCase()),
  );
  const called = new Set();
  for (const file of SQL_FILES) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(
      /(?:from|join)\s+(?:public\.)?(ifund_[a-z_]+)\s*\(/gi,
    )) {
      called.add(m[1].toLowerCase());
    }
  }
  const undocumented = [...called].filter((c) => !defined.has(c));
  const doc = readFileSync(
    join(repoRoot, "docs/migration/BLOCKERS.md"),
    "utf8",
  );
  for (const name of undocumented) {
    assert.ok(
      doc.includes(name),
      name +
        " is called but not defined in any migration, and is not recorded in BLOCKERS.md",
    );
  }
  assert.ok(
    undocumented.length <= 1,
    "expected at most 1 externally-defined function dependency, found " +
      undocumented.length +
      ": " +
      undocumented.join(", "),
  );
});
