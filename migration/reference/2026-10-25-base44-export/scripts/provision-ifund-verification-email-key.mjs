#!/usr/bin/env node
// One-time operator action: generate the verification-mail AES key in memory
// and send it to Base44's project-secret store. Never print, log, commit,
// put into command arguments, or add plaintext keys to a tracked file.
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const appId = '6a67a778342a8fe05ee79cba';
const name = 'IFUND_VERIFICATION_EMAIL_KEY';
const cli = process.env.IFUND_BASE44_CLI || 'base44';

function call(args, input) {
  const result = spawnSync(cli, args, {
    input, encoding: 'utf8', maxBuffer: 250_000,
    timeout: 120_000, stdio: ['pipe', 'pipe', 'pipe']
  });
  return { ok: !result.error && result.status === 0, stdout: result.stdout || '' };
}
function present(text) {
  // Full CLI output is deliberately never displayed; only existence is checked.
  // Base44 secrets list returns secret names, never their contents.
  return text.includes(name);
}
const flags = ['--app-id', appId, '--json'];
const before = call(['secrets','list',...flags]);
if (!before.ok) {
  console.error('Cannot verify Base44 secrets. Sign in with the Base44 CLI first. No key was generated or changed.');
  process.exit(2);
}
if (present(before.stdout)) {
  console.log(name + ' is already configured in Base44. No key changed.');
  process.exit(0);
}
const key = randomBytes(32);
const input = Buffer.from(name + '=' + key.toString('base64') + '\n', 'utf8');
key.fill(0);
const privateDir = mkdtempSync(join(tmpdir(), 'ifund-provision-'));
const envFile = join(privateDir, '.secret');
let saved;
try {
  // CLI expects a readable env file. Create with owner-only permissions under
  // an OS temp directory, then erase and unlink immediately after use.
  writeFileSync(envFile, input, {mode:0o600,flag:'wx'});
  saved = call(['secrets','set','--env-file',envFile,...flags]);
} finally {
  try {writeFileSync(envFile, Buffer.alloc(input.length,0),{mode:0o600});} catch {}
  input.fill(0);
  rmSync(privateDir,{recursive:true,force:true});
}
if (!saved.ok) {
  console.error('Base44 did not confirm the protected secret was saved. No value was printed. Check the Base44 dashboard.');
  process.exit(3);
}
const after = call(['secrets','list',...flags]);
if (!after.ok || !present(after.stdout)) {
  console.error('Base44 accepted a secret write, but its name could not be verified. Check the dashboard; do not rerun blindly.');
  process.exit(4);
}
console.log('Configured ' + name + ' in Base44 protected secrets. Value was not displayed or committed.');
