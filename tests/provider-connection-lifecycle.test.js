import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const member = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const migrations = [
  '20261109131024_ifund_provider_oauth_vault_20261109.sql',
  '20261109140000_ifund_provider_oauth_expiry_audit.sql',
  '20261111090000_ifund_connection_lifecycle.sql',
];

test('disconnect removes only the member’s grant and prevents stale OAuth writes', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table public.ifund_profiles (
        id uuid primary key, account_status text, account_deletion_pending boolean
      );
      create function public.ifund_current_account_is_active() returns boolean language sql stable
        as $$ select exists (select 1 from public.ifund_profiles
          where id = auth.uid() and account_status = 'active' and account_deletion_pending is false) $$;
      create table public.ifund_connections (
        owner_id uuid, provider text, status text, verified_at timestamptz,
        primary key (owner_id, provider)
      );
      insert into auth.users values ('${member}'), ('${other}');
      insert into public.ifund_profiles values ('${member}','active',false), ('${other}','active',false);
    `);
    for (const migration of migrations) {
      await db.exec(await readFile(new URL('../supabase/migrations/' + migration, import.meta.url), 'utf8'));
    }
    async function store(owner, authorizedAt, event = 'connected') {
      const result = await db.query(`select public.ifund_store_provider_connection_v3(
        $1,'google','subject','{}'::jsonb,'{}',null,null,1::smallint,$2,$3
      ) as saved`, [owner, event, authorizedAt]);
      return result.rows[0].saved;
    }
    const earlier = '2026-01-01T00:00:00Z';
    assert.equal(await store(member, earlier), true);
    assert.equal(await store(other, earlier), true);
    const { rows: [saved] } = await db.query('select updated_at::text as version from public.ifund_provider_tokens where owner_id=$1', [member]);
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${member}';`);
    assert.equal((await db.query("select public.ifund_disconnect_provider('google') as removed")).rows[0].removed, true);
    await assert.rejects(db.query("select public.ifund_disconnect_provider('unknown')"), { code: '42501' });
    await assert.rejects(store(member, earlier), { code: '42501' });
    await db.exec('reset role');
    assert.equal(await store(member, earlier), false);
    assert.equal(await store(member, saved.version, 'refreshed'), false);
    assert.deepEqual((await db.query('select owner_id from public.ifund_provider_tokens')).rows, [{ owner_id: other }]);
    assert.equal((await db.query('select status from public.ifund_connections where owner_id=$1', [member])).rows[0].status, 'disconnected');
    const { rows: [timestamp] } = await db.query('select clock_timestamp()::text as fresh');
    assert.equal(await store(member, timestamp.fresh), true);
  } finally {
    await db.close();
  }
});
