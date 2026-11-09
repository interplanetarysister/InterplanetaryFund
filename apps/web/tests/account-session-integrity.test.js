import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connectionStatusLabel } from '../src/lib/connectionPresentation.js';
const read = name => readFileSync(new URL('../src/pages/' + name, import.meta.url),'utf8');
test('sign-out errors prevent a false success redirect',()=>{
  assert.match(read('Dashboard.jsx'),/if \(error\) throw error/);
});
test('unverified providers are not shown as connected',()=>{
  for(const status of ['connected','pending','error','verification_required',undefined])
    assert.equal(connectionStatusLabel({status,verified_at:new Date().toISOString()}),'Verification required');
  assert.equal(connectionStatusLabel({status:'disconnected'}),'Disconnected');
});
