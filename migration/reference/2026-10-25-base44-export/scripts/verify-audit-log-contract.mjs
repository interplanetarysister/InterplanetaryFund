import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const audit = read('base44/shared/auditLog.ts');
const page = read('src/pages/AuditLogAdmin.jsx');
const app = read('src/App.jsx');
const layout = read('src/components/Layout.jsx');

assert.match(audit, /SECRET_KEY/);
assert.match(audit, /\[redacted\]/);
assert.match(audit, /scrubMetadata\(entry\.metadata/);
assert.doesNotMatch(audit, /e && e\.message \? e\.message : e/);
assert.match(page, /AuditLog\.list\("-created_date", 500\)/);
assert.match(page, /Financial activity only/);
assert.doesNotMatch(page, /row\.metadata/);
assert.match(app, /<Route element=\{<AdminRoute \/>\}>/);
assert.match(app, /path="\/admin\/audit" element=\{<AuditLogAdmin \/>\}/);
assert.match(layout, /to: "\/admin\/audit", label: "Audit Log"/);
assert.match(layout, /to\.startsWith\("\/admin\/"\)/);

console.log('admin financial audit log contract: PASS');
