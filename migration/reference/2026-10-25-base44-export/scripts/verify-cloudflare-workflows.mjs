import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const m=JSON.parse(fs.readFileSync('host/workflows/manifest.json'));assert.equal(m.execution,'disabled');assert.equal(m.workflows.length,17);
for(const w of m.workflows){const a=fs.readFileSync('base44/workflows/'+w.file),b=fs.readFileSync('host/workflows/source/'+w.file);assert.deepEqual(a,b);assert.equal(crypto.createHash('sha256').update(a).digest('hex'),w.sha256);}
console.log('PASS: 17 workflow definitions preserved byte-for-byte; execution disabled');
