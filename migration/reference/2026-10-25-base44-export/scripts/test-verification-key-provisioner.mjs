import { mkdtempSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const folder = mkdtempSync(join(tmpdir(), 'ifund-provision-test-'));
try {
  const mock = join(folder, 'mock-base44');
  const script = `#!/usr/bin/env node
const fs=require('node:fs');
const [cmd,subcmd]=process.argv.slice(2);
const marker=process.env.MOCK_KEY_MARKER;
if(cmd==='secrets' && subcmd==='list') {
  process.stdout.write(JSON.stringify({secrets:fs.existsSync(marker)?[{name:'IFUND_VERIFICATION_EMAIL_KEY'}]:[]}));
  process.exit(0);
}
if(cmd==='secrets' && subcmd==='set') {
  let data='';
  const i=process.argv.indexOf('--env-file');
  try {data=fs.readFileSync(process.argv[i+1],'utf8').trim();} catch(e) {process.exit(9);}
  const firstEqual=data.indexOf('=');
  const entry=[data.slice(0,firstEqual),data.slice(firstEqual+1)];
  const decodedSize=Buffer.from(entry[1],'base64').length;
  if(entry.length!==2 || entry[0]!=='IFUND_VERIFICATION_EMAIL_KEY' || decodedSize!==32) process.exit(2);
  fs.writeFileSync(marker,'configured');
  process.stdout.write('{"ok":true}');
  process.exit(0);
}
process.exit(4);
`;
  writeFileSync(mock, script, {mode:0o700});
  chmodSync(mock,0o700);
  const marker = join(folder,'set.marker');
  const env = {...process.env,IFUND_BASE44_CLI:mock,MOCK_KEY_MARKER:marker};
  const run = () => spawnSync(process.execPath,['scripts/provision-ifund-verification-email-key.mjs'],{encoding:'utf8',env});
  const first=run();
  assert.equal(first.status,0,first.stderr);
  assert.equal(readFileSync(marker,'utf8'),'configured');
  assert.match(first.stdout,/Configured IFUND_VERIFICATION_EMAIL_KEY/);
  assert.doesNotMatch(first.stdout,/=[A-Za-z0-9+/]{30}/);
  const again=run();
  assert.equal(again.status,0,again.stderr);
  assert.match(again.stdout,/already configured/);
  console.log('PASS: Base44 key provisioner creates one 256-bit secret without leaking or rotating it.');
} finally {rmSync(folder,{recursive:true,force:true});}
