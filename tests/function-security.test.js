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

// These functions intentionally mutate state: one atomically consumes the
// tightly capped Studio AI quota; the other records immutable page-version
// snapshots from a database trigger. Keep this allowlist narrow and explicit.
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
]);

/** Every create [or replace] function header, with its body terminator. */
function functionHeaders() {
  const found = [];
  for (const file of SQL_FILES) {
    const text = readFileSync(file, "utf8");
    const pattern =
      /create\s+(?:or\s+replace\s+)?function\s+([a-zA-Z0-9_.]+)\s*\([^)]*\)/gi;
    for (const match of text.matchAll(pattern)) {
      const after = text.slice(match.index + match[0].length);
      const terminator = after.search(/\bas\s+\$\$/i);
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
  const offenders = functionHeaders().filter((fn) =>
    fn.definer && !/language\s+sql|\bstable\b/i.test(fn.header) &&
    !MUTATING_DEFINER_FUNCTIONS.has(fn.name),
  ).map((fn) => fn.file + ": " + fn.name);
  assert.deepEqual(offenders, [], "Mutating SECURITY DEFINER functions require explicit review");
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
    assert.ok(
      explicitRevoke || schemaRevoke,
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
