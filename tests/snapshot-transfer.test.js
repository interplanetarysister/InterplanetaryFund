import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sha256, validateSnapshots, buildTransferSql, verifyTransfer } from '../scripts/migration/snapshot-transfer.mjs';

const row = (source_id = 'legacy-1', payload_text = '{"amount": 123.4500, "large": 9007199254740993}') =>
  ({ entity_type: 'Recommendation', source_id, payload_text, payload_sha256: sha256(payload_text) });

test('numeric scale and integers above JavaScript safe range survive SQL transport verbatim', () => {
  const input = row();
  const sql = buildTransferSql([input], 'content');
  const match = sql.match(/jsonb_to_recordset\((\$[^$]+\$)([\s\S]*?)\1::jsonb\)/);
  assert.equal(JSON.parse(match[2])[0].payload_text, input.payload_text);
  assert.match(sql, /payload_text::jsonb/);
  assert.match(sql, /ON CONFLICT \(entity_type, source_id\) DO NOTHING/);
  assert.match(sql, /false/);
  assert.doesNotMatch(sql, /DO UPDATE|public\.|auth\.users/);
});

test('quotes, SQL-looking text, backslashes and the dollar delimiter remain inert JSON data', () => {
  const input = row("legacy'); DROP TABLE users;--", JSON.stringify({ text: "$ifund_transfer$ ' \\ \n ☄️" }));
  const sql = buildTransferSql([input], 'source');
  const match = sql.match(/jsonb_to_recordset\((\$[^$]+\$)([\s\S]*?)\1::jsonb\)/);
  const transported = JSON.parse(match[2])[0];
  assert.equal(transported.source_id, input.source_id);
  assert.equal(transported.payload_text, input.payload_text);
  assert.notEqual(match[1], '$ifund_transfer$');
});

test('a digest copied alongside a corrupted payload is rejected', () => {
  assert.throws(() => validateSnapshots([{ ...row(), payload_text: '{"amount":0}' }]), /digest mismatch/);
});

test('duplicate IDs fail while equal IDs in distinct entities remain separate', () => {
  assert.throws(() => validateSnapshots([row(), row()]), /Duplicate/);
  assert.equal(validateSnapshots([row(), { ...row(), entity_type: 'SocialPost' }]).length, 2);
});

test('destination, metadata, payload type, digest and batch limits fail closed', () => {
  assert.throws(() => buildTransferSql([row()], 'public.campaigns'), /Unsupported/);
  for (const value of [null, [], 'plain text', {}, { ...row(), entity_type: 'Bad);--' },
    { ...row(), original_payload_sha256: 'wrong' }, { ...row(), source_updated_at: 'not-a-date' },
    { ...row(), source_owner_id: {} }, row('id', '[]')]) {
    assert.throws(() => validateSnapshots([value]));
  }
  assert.throws(() => buildTransferSql([], 'source'), /1–100/);
  assert.throws(() => buildTransferSql(Array.from({ length: 101 }, (_, i) => row(String(i))), 'source'), /1–100/);
});

test('verification detects missing, changed, unexpected and duplicate destination rows', () => {
  assert.deepEqual(verifyTransfer([row()], [row()]),
    { expected: 1, present: 1, missing: 0, changed: 0, unexpected: 0, ok: true });
  assert.equal(verifyTransfer([row()], []).missing, 1);
  assert.equal(verifyTransfer([row()], [row('legacy-1', '{"amount": 1}')]).changed, 1);
  assert.equal(verifyTransfer([], [row()]).unexpected, 1);
  assert.throws(() => verifyTransfer([row()], [row(), row()]), /Duplicate/);
});

test('CLI emits private 100-row batches, refuses overwrite, and never prints raw records', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ifund-transfer-'));
  try {
    const input = join(dir, 'source.jsonl'), output = join(dir, 'copy.sql');
    const rows = Array.from({ length: 201 }, (_, i) => row(String(i), '{"private":"do-not-print@example.invalid"}'));
    await writeFile(input, rows.map(row => JSON.stringify(row)).join('\n'));
    const run = () => spawnSync(process.execPath, ['scripts/migration/snapshot-transfer.mjs', 'content', input, output], { encoding: 'utf8' });
    const first = run();
    assert.equal(first.status, 0);
    assert.deepEqual(JSON.parse(first.stdout), { snapshots: 201, batches: 3, sqlWritten: true });
    assert.doesNotMatch(first.stdout + first.stderr, /do-not-print/);
    assert.equal((await readFile(output, 'utf8')).match(/ON CONFLICT/g).length, 3);
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    assert.equal(run().status, 1);
    const verify = spawnSync(process.execPath, ['scripts/migration/snapshot-transfer.mjs', 'verify', input, input], { encoding: 'utf8' });
    assert.equal(verify.status, 0);
    assert.equal(JSON.parse(verify.stdout).ok, true);
    await writeFile(input, '{"private":"do-not-print@example.invalid"}\n');
    const failed = run();
    assert.equal(failed.status, 1);
    assert.doesNotMatch(failed.stdout + failed.stderr, /do-not-print/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
