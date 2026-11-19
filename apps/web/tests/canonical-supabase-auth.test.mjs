import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isCanonicalSupabaseUrl, CANONICAL_SUPABASE_ORIGIN } from "../src/lib/canonicalSupabaseUrl.mjs";

test("browser authentication permits only the exact canonical HTTPS project", () => {
  assert.equal(isCanonicalSupabaseUrl(CANONICAL_SUPABASE_ORIGIN), true);
  assert.equal(isCanonicalSupabaseUrl(CANONICAL_SUPABASE_ORIGIN + "/"), true);
  for (const url of [
    "http://ssibsfmtodgximseeqsv.supabase.co",
    "https://another-project.supabase.co",
    "https://ssibsfmtodgximseeqsv.supabase.co.evil.example",
    "https://user:password@ssibsfmtodgximseeqsv.supabase.co",
    "https://ssibsfmtodgximseeqsv.supabase.co/auth/v1",
    "https://ssibsfmtodgximseeqsv.supabase.co/?q=1",
    "https://ssibsfmtodgximseeqsv.supabase.co/#secret",
    "ftp://ssibsfmtodgximseeqsv.supabase.co",
    "",
    null,
    undefined,
  ]) assert.equal(isCanonicalSupabaseUrl(url), false, String(url));
});

test("web browser client gates Supabase creation on the central canonical origin helper", () => {
  const source = readFileSync(new URL("../src/api/auth.js", import.meta.url), "utf8");
  assert.match(source, /import \{ isCanonicalSupabaseUrl \} from "\.\.\/lib\/canonicalSupabaseUrl\.mjs"/);
  assert.match(source, /!isCanonicalSupabaseUrl\(url\)/);
  assert.doesNotMatch(source, /\.hostname !== REF/);
});
