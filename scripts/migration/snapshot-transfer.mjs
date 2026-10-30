import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ORIGIN = 'tzehxfikoslihnclhxuz';
const TABLES = Object.freeze({ content: 'content_snapshots', source: 'source_snapshots' });
export const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');

/** Preserve PostgreSQL's JSONB text verbatim, including large numbers and scale. */
export function validateSnapshots(rows) {
  if (!Array.isArray(rows)) throw new Error('Expected an array of snapshots.');
  const seen = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        typeof row.entity_type !== 'string' || !/^[A-Za-z][A-Za-z0-9_.]{0,127}$/.test(row.entity_type) ||
        typeof row.source_id !== 'string' || !row.source_id || row.source_id.length > 254 ||
        typeof row.payload_text !== 'string' || !/^[a-f0-9]{64}$/.test(row.payload_sha256 || '')) {
      throw new Error('Invalid snapshot metadata.');
    }
    const id = JSON.stringify([row.entity_type, row.source_id]);
    if (seen.has(id)) throw new Error('Duplicate snapshot identity.');
    seen.add(id);
    // Parse only to validate the document. Never stringify this parsed value:
    // JavaScript numbers cannot preserve every PostgreSQL JSONB numeric value.
    const value = JSON.parse(row.payload_text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Snapshot payload must be a JSON object.');
    }
    if (sha256(row.payload_text) !== row.payload_sha256) {
      throw new Error('Snapshot payload digest mismatch.');
    }
    if (row.source_owner_id != null && typeof row.source_owner_id !== 'string') {
      throw new Error('Invalid source owner reference.');
    }
    if (row.original_payload_sha256 != null &&
        !/^[a-f0-9]{64}$/.test(row.original_payload_sha256)) {
      throw new Error('Invalid historical source digest.');
    }
    if (row.source_updated_at != null &&
        (typeof row.source_updated_at !== 'string' || !Number.isFinite(Date.parse(row.source_updated_at)))) {
      throw new Error('Invalid source timestamp.');
    }
  }
  return rows;
}

function quotedJson(value) {
  const json = JSON.stringify(value);
  let tag = '$ifund_transfer$';
  while (json.includes(tag)) tag = tag.replace(/\$$/, 'x$');
  return tag + json + tag + '::jsonb';
}

/** SQL is limited to existing private tables, 100 rows at a time, no overwrites. */
export function buildTransferSql(rows, kind) {
  const table = TABLES[kind];
  if (!table) throw new Error('Unsupported snapshot destination.');
  validateSnapshots(rows);
  if (rows.length < 1 || rows.length > 100) throw new Error('Batch must contain 1–100 snapshots.');
  const data = rows.map(row => ({
    entity_type: row.entity_type,
    source_id: row.source_id,
    payload_text: row.payload_text,
    payload_sha256: row.payload_sha256,
    ...(kind === 'source' ? {
      source_owner_id: row.source_owner_id ?? null,
      source_updated_at: row.source_updated_at ?? null,
      original_payload_sha256: row.original_payload_sha256 ?? null,
    } : {}),
  }));
  const fields = kind === 'source'
    ? ', source_owner_id, source_updated_at, original_payload_sha256' : '';
  const typedFields = kind === 'source'
    ? ', source_owner_id text, source_updated_at timestamptz, original_payload_sha256 text' : '';
  return `-- Private migration data: never commit or log this generated SQL.\n` +
    `WITH incoming AS (\n` +
    `  SELECT * FROM jsonb_to_recordset(${quotedJson(data)})\n` +
    `  AS x(entity_type text, source_id text, payload_text text, payload_sha256 text${typedFields})\n` +
    `), inserted AS (\n` +
    `  INSERT INTO ifund_transfer.${table}\n` +
    `    (entity_type, source_id, source_payload, source_digest_sha256, origin_project_ref, source_verified${fields})\n` +
    `  SELECT entity_type, source_id, payload_text::jsonb, payload_sha256, '${ORIGIN}', false${fields}\n` +
    `  FROM incoming\n` +
    `  WHERE encode(extensions.digest(payload_text, 'sha256'), 'hex') = payload_sha256\n` +
    `  ON CONFLICT (entity_type, source_id) DO NOTHING RETURNING 1\n` +
    `) SELECT (SELECT count(*) FROM incoming) AS expected,\n` +
    `  (SELECT count(*) FROM inserted) AS inserted,\n` +
    `  (SELECT count(*) FROM incoming WHERE encode(extensions.digest(payload_text, 'sha256'), 'hex') <> payload_sha256) AS transport_mismatches;\n`;
}

/** Compare actual re-read payloads; a copied digest alone proves nothing. */
export function verifyTransfer(sourceRows, destinationRows) {
  validateSnapshots(sourceRows);
  validateSnapshots(destinationRows);
  const expected = new Map(sourceRows.map(row => [JSON.stringify([row.entity_type, row.source_id]), row]));
  const actual = new Map(destinationRows.map(row => [JSON.stringify([row.entity_type, row.source_id]), row]));
  let missing = 0, changed = 0, unexpected = 0;
  for (const [id, source] of expected) {
    const destination = actual.get(id);
    if (!destination) missing++;
    else if (destination.payload_text !== source.payload_text) changed++;
  }
  for (const id of actual.keys()) if (!expected.has(id)) unexpected++;
  return { expected: expected.size, present: actual.size, missing, changed, unexpected,
    ok: missing === 0 && changed === 0 && unexpected === 0 };
}

async function readJsonl(path) {
  return (await readFile(path, 'utf8')).split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
}

async function main(args) {
  if (args.length !== 3 || !['content', 'source', 'verify'].includes(args[0])) {
    throw new Error('Usage: snapshot-transfer.mjs content|source INPUT.jsonl OUTPUT.sql; or verify SOURCE.jsonl DESTINATION.jsonl');
  }
  const [kind, input, output] = args;
  const rows = validateSnapshots(await readJsonl(input));
  if (kind === 'verify') {
    const result = verifyTransfer(rows, await readJsonl(output));
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (!rows.length) throw new Error('No snapshots supplied.');
  let sql = 'BEGIN;\n';
  for (let offset = 0; offset < rows.length; offset += 100) {
    sql += buildTransferSql(rows.slice(offset, offset + 100), kind);
  }
  sql += 'COMMIT;\n';
  // Never overwrite an input/export or an existing SQL file. Private mode on creation.
  await writeFile(output, sql, { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ snapshots: rows.length, batches: Math.ceil(rows.length / 100), sqlWritten: true }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(() => {
    // Parser/provider errors may contain private row contents: keep diagnostics generic.
    console.error('Snapshot transfer failed. Check input metadata, digests, arguments, and output path.');
    process.exitCode = 1;
  });
}
