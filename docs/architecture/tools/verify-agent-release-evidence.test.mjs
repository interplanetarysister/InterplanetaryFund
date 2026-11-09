import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const validator=fileURLToPath(new URL('./verify-agent-release-evidence.mjs', import.meta.url));
const truthKeys=[
  'original_ui_preview_verified','original_assets_verified','original_routes_verified',
  'mobile_guest_drafting_verified','base44_preview_connection_verified',
  'auth_recovery_verified','supabase_rls_owner_isolation_verified',
  'payments_verified_only','withdrawal_owner_only_verified',
  'withdrawal_seven_percent_fee_verified','rollback_tested','user_production_approval'
];
const good=()=>({
  canonical_source_sha:'a'.repeat(40),implementation_sha:'b'.repeat(40),
  preview_urls:['https://example.pages.dev'],test_receipts:['https://github.com/example/receipt'],
  ...Object.fromEntries(truthKeys.map(k=>[k,true]))
});
function check(data, stage='production'){
  const dir=mkdtempSync(join(tmpdir(),'ifund-evidence-'));
  try{
    const file=join(dir,'evidence.json');
    writeFileSync(file,JSON.stringify(data));
    return spawnSync(process.execPath,[validator,...(stage==='preview'?['--preview']:[]),file],{encoding:'utf8'});
  }finally{rmSync(dir,{recursive:true,force:true})}
}
test('complete evidence schema can be evaluated without deploying',()=>{
  const result=check(good());
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/Independently verify/);
});
for(const field of truthKeys){
  test('release fails closed without '+field,()=>{
    const data=good();delete data[field];
    const result=check(data);
    assert.equal(result.status,1);
    assert.match(result.stderr,new RegExp(field));
  });
}
test('invalid SHA and missing test receipts block release',()=>{
  const data=good();data.implementation_sha='short';data.test_receipts=[];
  const result=check(data);
  assert.equal(result.status,1);
  assert.match(result.stderr,/implementation_sha/);
  assert.match(result.stderr,/test_receipts/);
});
test('unauthorized Base44 removal blocks release',()=>{
  const data=good();data.base44_dependencies_removed=true;
  const result=check(data);
  assert.equal(result.status,1);
  assert.match(result.stderr,/Base44 removal/);
});
test('production approval must be explicitly true',()=>{
  const data=good();data.user_production_approval=false;data.production_promotion_requested=true;
  const result=check(data);
  assert.equal(result.status,1);
  assert.match(result.stderr,/user_production_approval/);
});

test('preview readiness does not require financial or production approval fields',()=>{
  const data=good();
  for(const field of ['auth_recovery_verified','supabase_rls_owner_isolation_verified','payments_verified_only','withdrawal_owner_only_verified','withdrawal_seven_percent_fee_verified','rollback_tested','user_production_approval'])delete data[field];
  const result=check(data,'preview');
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/PREVIEW evidence schema complete/);
});
test('preview readiness fails without original Base44 connection proof',()=>{
  const data=good();delete data.base44_preview_connection_verified;
  const result=check(data,'preview');
  assert.equal(result.status,1);
  assert.match(result.stderr,/base44_preview_connection_verified/);
});
test('preview readiness refuses production promotion requests',()=>{
  const data=good();data.production_promotion_requested=true;
  const result=check(data,'preview');
  assert.equal(result.status,1);
  assert.match(result.stderr,/must not request production promotion/);
});
