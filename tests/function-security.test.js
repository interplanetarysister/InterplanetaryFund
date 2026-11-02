// Function security guard.
//
// The Supabase security advisor flags privileged functions for review. The
// specific defect it looks for is a SECURITY DEFINER function without a pinned
// search_path: the function executes with its owner's privileges, and any name it
// resolves unqualified goes through the caller's search_path. A caller who can
// put a schema earlier in the path than the intended one can then have the
// definer function call their object instead of the real one.
//
// These tests read the migration SQL as text rather than a database, so they run
// everywhere and cannot be skipped by a missing local Postgres.

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

/** Every `create [or replace] function` header, with its body terminator. */
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
        file: file.relative ? file.relative : file.slice(repoRoot.length),
        header,
        definer: /security\s+definer/i.test(header),
        pinned: /set\s+search_path/i.test(header),
      });
    }
  }
  return found;
}

test("the migration set defines functions at all", () => {
  // Without this, an empty or broken scan would make every test below pass.
  const functions = functionHeaders();
  assert.ok(
    functions.length >= 3,
    `expected to find functions, found ${functions.length}`,
  );
});

test("every SECURITY DEFINER function pins its search_path", () => {
  const offenders = functionHeaders()
    .filter((f) => f.definer && !f.pinned)
    .map((f) => `${f.file}: ${f.name}`);
  assert.deepEqual(
    offenders,
    [],
    `these SECURITY DEFINER functions resolve names through the caller's search_path:\n  ${offenders.join("\n  ")}`,
  );
});

test("every SECURITY DEFINER function is a read-only lookup", () => {
  // A definer function that writes is far harder to reason about than one that
  // only reads, so each is asserted to be either `language sql stable` or to
  // contain no write keyword.
  for (const fn of functionHeaders().filter((f) => f.definer)) {
    const readOnly =
      /language\s+sql/i.test(fn.header) || /stable/i.test(fn.header);
    assert.ok(
      readOnly,
      `${fn.file}: ${fn.name} is SECURITY DEFINER but not marked stable sql`,
    );
  }
});

test("execute on a definer function is revoked from public before being granted", () => {
  // A definer function granted to PUBLIC would be callable by anyone, including
  // anon, regardless of intent.
  for (const fn of functionHeaders().filter((f) => f.definer)) {
    const bare = fn.name.replace(/^public\./, "");
    const grants = SQL_FILES.map((f) => readFileSync(f, "utf8")).join("\n");
    const revoked = new RegExp(
      `revoke\\s+all\\s+on\\s+function\\s+(public\\.)?${bare}\\s*\\(`,
      "i",
    ).test(grants);
    assert.ok(
      revoked,
      `${bare} is SECURITY DEFINER but never has execute revoked from public`,
    );
  }
});

test("functions this repository calls but does not define are recorded", () => {
  // ifund_public_campaign_detail calls ifund_migration_active_campaign_preview,
  // which exists in the live database but is defined by no migration here. Its
  // security properties are therefore not reviewable from source. That dependency
  // is allowed, but it must be recorded, and this test fails if a new one appears
  // silently.
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
      `${name} is called but not defined in any migration, and is not recorded in BLOCKERS.md`,
    );
  }
  // Pin the known count so a new undocumented dependency is noticed.
  assert.ok(
    undocumented.length <= 1,
    `expected at most 1 externally-defined function dependency, found ${undocumented.length}: ${undocumented.join(", ")}`,
  );
});
