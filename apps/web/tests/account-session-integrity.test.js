import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL('../src/pages/' + name, import.meta.url),'utf8');
test('sign-out errors prevent a false success redirect',()=>{
  assert.match(read('Dashboard.jsx'),/if \(error\) throw error/);
});
test('unverified providers are not shown as connected',()=>{
  assert.match(read('Connections.jsx'),/pending verification/);
});
