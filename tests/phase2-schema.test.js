import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../supabase/migrations/pending/', import.meta.url);
const files = readdirSync(root)
  .filter((file) => /^phase2_ifund_(stage|finance|secrets)_\d+_\d+\.sql$/.test(file))
  .sort();
const statements = files.map((file) => readFileSync(join(root.pathname, file), 'utf8')).join('\n');
const tables = [...statements.matchAll(/CREATE TABLE IF NOT EXISTS (ifund_\w+\."[a-z0-9_]+")/g)].map((hit) => hit[1]);
const rls = [...statements.matchAll(/ALTER TABLE (ifund_\w+\."[a-z0-9_]+") ENABLE ROW LEVEL SECURITY/g)].map((hit) => hit[1]);
const denied = [...statements.matchAll(/CREATE POLICY "deny_clients_[^"]+" ON (ifund_\w+\."[a-z0-9_]+") FOR ALL TO anon, authenticated USING \(false\) WITH CHECK \(false\)/g)].map((hit) => hit[1]);

test('all 95 staged Base44 entity contracts exist without duplicates', () => {
  assert.equal(tables.length, 95);
  assert.equal(new Set(tables).size, 95);
});
test('all 95 staged entity tables have RLS enabled', () => {
  assert.deepEqual(new Set(rls), new Set(tables));
});
test('no staged entity exposes client policies while identity proof is incomplete', () => {
  assert.deepEqual(new Set(denied), new Set(tables));
  assert.doesNotMatch(statements, /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE)\s+ON\s+[^;]+\s+TO\s+(?:anon|authenticated)/i);
});
test('financial and vault schemas are distinct and private', () => {
  assert.ok(tables.some((name) => name.startsWith('ifund_finance.')));
  assert.ok(tables.some((name) => name.startsWith('ifund_secrets.')));
  assert.match(statements, /REVOKE ALL ON SCHEMA ifund_secrets FROM PUBLIC, anon, authenticated/);
  assert.match(statements, /REVOKE ALL ON SCHEMA ifund_finance FROM PUBLIC, anon, authenticated/);
});
