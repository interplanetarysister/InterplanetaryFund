import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(
  new URL('../supabase/migrations/20261025011400_initial.sql', import.meta.url),
  'utf8',
).toLowerCase();

test('nonfinancial preview tables enable owner-enforced RLS', () => {
  for (const name of ['ifund_profiles', 'ifund_campaigns', 'ifund_posts', 'ifund_connections']) {
    assert.match(schema, new RegExp('alter table public\\.' + name + ' enable row level security'));
  }
});
test('client users cannot set timestamp or arbitrary campaign and post columns', () => {
  assert.doesNotMatch(schema,/grant\s+(?:select,)?insert(?:,update)?(?:,delete)?\s+on\s+public\.ifund_(?:campaigns|posts|profiles)\s+to\s+authenticated/);
  assert.match(schema,/grant insert\(author_id,body\) on public\.ifund_posts to authenticated/);
  assert.match(schema,/grant insert\(owner_id,title,summary,story,category,goal_amount,cover_image_url,status\)/);
  assert.match(schema,/grant update\(title,summary,story,category,goal_amount,cover_image_url,status\)/);
  assert.match(schema,/grant insert\(id,handle,display_name\) on public\.ifund_profiles to authenticated/);
});
test('provider connections never have direct client write grants', () => {
  assert.match(schema,/grant select on public\.ifund_connections to authenticated/);
  assert.doesNotMatch(schema,/grant\s+(?:insert|update|delete).*?on\s+public\.ifund_connections/);
});
test('campaigns and posts survive attempted deletion of the owning auth user', () => {
  assert.match(schema,/owner_id uuid not null references auth\.users\(id\) on delete restrict/);
  assert.match(schema,/author_id uuid not null references auth\.users\(id\) on delete restrict/);
});

test('scoped column grants first revoke broad default table grants', () => {
  assert.match(schema, /revoke all privileges on table/);
  for (const table of ['ifund_profiles', 'ifund_campaigns', 'ifund_posts', 'ifund_connections']) {
    assert.match(schema, new RegExp('public\\.' + table));
  }
  assert.match(schema, /from public, anon, authenticated/);
  assert.ok(
    schema.indexOf('revoke all privileges on table') <
      schema.indexOf('grant insert(author_id,body) on public.ifund_posts'),
  );
});
