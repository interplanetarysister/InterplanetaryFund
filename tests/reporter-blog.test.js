import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../src/App.jsx");
const api = read("../src/lib/blogs.js");
const migration = read("../supabase/migrations/20261030175218_ifund_blog_migration_foundation_20261030.sql");

test("Reporter pages are routed by the active website entry point", () => {
  assert.match(app, /import Blogs from "\.\/pages\/Blogs"/);
  assert.match(app, /path="\/blogs" element={<Blogs \/>}/);
  assert.match(app, /path="\/blogs\/:id" element={<BlogArticle \/>}/);
  assert.match(app, /path="\/my-blog" element={<MyBlog user={user} \/>}/);
});

test("public Reporter queries expose published entries only", () => {
  assert.match(api, /from\("ifund_blog_entries"\)/);
  assert.match(api, /eq\("status", "published"\)/);
  assert.match(api, /eq\("id", String\(id\)\)/);
  assert.doesNotMatch(api, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("Reporter schema preserves legacy IDs and uses owner-scoped RLS", () => {
  assert.match(migration, /legacy_owner_user_id text not null/);
  assert.match(migration, /legacy_created_by_id text/);
  assert.match(migration, /alter table public\.ifund_blogs enable row level security/);
  assert.match(migration, /alter table public\.ifund_blog_entries enable row level security/);
  assert.match(migration, /owner_auth_user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /status = 'published' or owner_auth_user_id/);
});
