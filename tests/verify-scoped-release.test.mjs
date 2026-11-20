import test from 'node:test';
import assert from 'node:assert/strict';
import {assess,verifyGitScope} from '../scripts/verify-scoped-release.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const A='a'.repeat(40),B='b'.repeat(40);
function fixture(files=['apps/web/src/styles/landing.css']) {return {commit_sha:A,changed_files:files,evidence:{local_tests:{passed:true,commit_sha:A,reference:'local-node-output-1'},security_regressions:{passed:true,commit_sha:A,reference:'negative-suite-1'},role_browser_qa:{passed:true,commit_sha:A,reference:'role-browser-1'},preview_qa:{passed:true,commit_sha:A,reference:'preview-browser-1'},preview_deployment:{id:'cf-preview-123',status:'success',commit_sha:A},independent_reviewer:{identity:'independent-qa',approved:true,reference:'qa-record-1'},outstanding_critical_defects:0}}}
test('eligible for narrowly scoped styling only with complete proof',()=>assert.equal(assess(fixture()).eligible,true));
test('missing role browser QA cannot be bypassed',()=>{const x=fixture();delete x.evidence.role_browser_qa;assert.equal(assess(x).eligible,false)});
test('wrong SHA on positive tests fails',()=>{const x=fixture();x.evidence.local_tests.commit_sha=B;assert.equal(assess(x).eligible,false)});
test('wrong preview SHA fails',()=>{const x=fixture();x.evidence.preview_deployment.commit_sha=B;assert.equal(assess(x).eligible,false)});
test('failed preview fails',()=>{const x=fixture();x.evidence.preview_deployment.status='failure';assert.equal(assess(x).eligible,false)});
test('missing independent QA fails',()=>{const x=fixture();x.evidence.independent_reviewer.approved=false;assert.equal(assess(x).eligible,false)});
test('unresolved critical defects fail',()=>{const x=fixture();x.evidence.outstanding_critical_defects=1;assert.equal(assess(x).eligible,false)});
test('financial code always requires full gate',()=>assert.equal(assess(fixture(['workers/ifund-payments/worker.js'])).eligible,false));
test('authorization files always require full gate',()=>assert.equal(assess(fixture(['apps/web/src/lib/auth.js'])).eligible,false));
test('route registration always requires full gate',()=>assert.equal(assess(fixture(['apps/web/src/App.jsx'])).eligible,false));
test('unknown extension fails',()=>assert.equal(assess(fixture(['apps/web/src/components/Random.bin'])).eligible,false));
test('path traversal fails',()=>assert.equal(assess(fixture(['apps/web/src/styles/../../unsafe.css'])).eligible,false));
test('no evidence fails',()=>{const x=fixture();delete x.evidence;assert.equal(assess(x).eligible,false)});
test('duplicate path fails',()=>assert.equal(assess(fixture(['apps/web/src/styles/a.css','apps/web/src/styles/a.css'])).eligible,false));
test('negative suite failure prevents release',()=>{const x=fixture();x.evidence.security_regressions.passed=false;assert.equal(assess(x).eligible,false)});
test('docs involving security architecture require full gate',()=>assert.equal(assess(fixture(['docs/architecture/FINANCIAL_RULES.md'])).eligible,false));
test('login page requires full gate',()=>assert.equal(assess(fixture(['apps/web/src/pages/Login.jsx'])).eligible,false));
test('campaign creator requires full gate',()=>assert.equal(assess(fixture(['apps/web/src/pages/CreateCampaign.jsx'])).eligible,false));

test('CLI rejects unverified base commit and absent checkout',()=>{
 const x=fixture();x.base_sha=B;
 assert.ok(verifyGitScope(x,{cwd:'/nonexistent-path-for-ifund-qa'}).length);
});
test('CLI independently verifies exact Git diff, refuses omitted changed files and dirty checkout',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'ifund-release-git-'));
 const run=(...args)=>spawnSync('git',args,{cwd,encoding:'utf8'});
 try {
  assert.equal(run('init','-q').status,0);
  assert.equal(run('config','user.email','qa@example.invalid').status,0);
  assert.equal(run('config','user.name','iFund QA').status,0);
  writeFileSync(join(cwd,'one.css'),'one');
  run('add','.');run('commit','-qm','first');
  const base=run('rev-parse','HEAD').stdout.trim();
  writeFileSync(join(cwd,'one.css'),'two');
  run('add','.');run('commit','-qm','second');
  const commit=run('rev-parse','HEAD').stdout.trim();
  const x=fixture(['one.css']);x.base_sha=base;x.commit_sha=commit;
  assert.deepEqual(verifyGitScope(x,{cwd}),[]);
  x.changed_files=[];
  assert.match(verifyGitScope(x,{cwd}).join(),/disagree/);
  x.changed_files=['one.css'];
  writeFileSync(join(cwd,'untracked'),'dirty');
  assert.match(verifyGitScope(x,{cwd}).join(),/dirty/);
 } finally {rmSync(cwd,{recursive:true,force:true});}
});

test('CLI refuses incomplete evidence at runtime without a real checkout',()=>{
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/verify-scoped-release.mjs',import.meta.url)),'missing.json'],{encoding:'utf8'});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/FAIL CLOSED/);
});
test('CLI rejects out-of-scope fixture in temporary git checkout',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'ifund-release-cli-'));
 const run=(...args)=>spawnSync('git',args,{cwd,encoding:'utf8'});
 try {
  run('init','-q');run('config','user.email','qa@example.invalid');run('config','user.name','iFund QA');
  writeFileSync(join(cwd,'landing.css'),'one');run('add','.');run('commit','-qm','base');
  const base=run('rev-parse','HEAD').stdout.trim();
  writeFileSync(join(cwd,'landing.css'),'two');run('add','.');run('commit','-qm','new');
  const commit=run('rev-parse','HEAD').stdout.trim();
  const x=fixture(['landing.css']); x.base_sha=base;x.commit_sha=commit;
  for(const k of ['local_tests','security_regressions','role_browser_qa','preview_qa']) x.evidence[k].commit_sha=commit;
  x.evidence.preview_deployment.commit_sha=commit;
  // Synthetic tests should not authorize a real deployment. This verifies execution mechanics only.
  // landing.css is not an accepted production scope; eligibility must be denied.
  writeFileSync(join(cwd,'evidence.json'),JSON.stringify(x));
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/verify-scoped-release.mjs',import.meta.url)),'evidence.json'],{cwd,encoding:'utf8'});
  assert.notEqual(result.status,0);
  assert.match(result.stdout,/Full release\/security gate required/);
 } finally {rmSync(cwd,{recursive:true,force:true});}
});
test('CLI permits fully proved narrow fixture and rejects omitted changed files',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'ifund-release-proof-repo-'));
 const proof=mkdtempSync(join(tmpdir(),'ifund-release-proof-outside-'));
 const run=(...args)=>spawnSync('git',args,{cwd,encoding:'utf8'});
 try {
  run('init','-q');run('config','user.email','qa@example.invalid');run('config','user.name','iFund QA');
  mkdirSync(join(cwd,'apps/web/src/styles'),{recursive:true});
  const style=join(cwd,'apps/web/src/styles/landing.css');
  writeFileSync(style,'one');run('add','.');run('commit','-qm','base');
  const base=run('rev-parse','HEAD').stdout.trim();
  writeFileSync(style,'two');run('add','.');run('commit','-qm','release');
  const commit=run('rev-parse','HEAD').stdout.trim();
  const x=fixture();x.base_sha=base;x.commit_sha=commit;
  for(const k of ['local_tests','security_regressions','role_browser_qa','preview_qa'])x.evidence[k].commit_sha=commit;
  x.evidence.preview_deployment.commit_sha=commit;
  const file=join(proof,'evidence.json');writeFileSync(file,JSON.stringify(x));
  const script=fileURLToPath(new URL('../scripts/verify-scoped-release.mjs',import.meta.url));
  const pass=spawnSync(process.execPath,[script,file],{cwd,encoding:'utf8'});
  assert.equal(pass.status,0,pass.stderr+' '+pass.stdout);
  assert.match(pass.stdout,/"eligible": true/);
  x.changed_files=[];writeFileSync(file,JSON.stringify(x));
  const deny=spawnSync(process.execPath,[script,file],{cwd,encoding:'utf8'});
  assert.notEqual(deny.status,0);
  assert.match(deny.stdout,/disagree with committed Git diff/);
 } finally {rmSync(cwd,{recursive:true,force:true});rmSync(proof,{recursive:true,force:true});}
});
