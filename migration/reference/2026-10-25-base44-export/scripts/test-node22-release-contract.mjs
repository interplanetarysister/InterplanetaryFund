import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyReleaseContract} from './verify-node22-release-contract.mjs';
function fixture() {
 const dir=mkdtempSync(join(tmpdir(),'node24-contract-'));
 mkdirSync(join(dir,'.github/workflows'),{recursive:true});
 writeFileSync(join(dir,'package.json'),JSON.stringify({engines:{node:'>=24.12.0'}}));
 writeFileSync(join(dir,'package-lock.json'),JSON.stringify({packages:{'':{engines:{node:'>=24.12.0'}}}}));
 writeFileSync(join(dir,'.node-version'),'24\n');
 writeFileSync(join(dir,'.nvmrc'),'24\n');
 writeFileSync(join(dir,'.github/workflows/check.yml'),"jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '24'\n");
 return dir;
}
function test(label,mutate,expected){
 const dir=fixture();
 try{mutate(dir);const errors=verifyReleaseContract(dir);assert.equal(expected(errors),true,label+': '+JSON.stringify(errors))}
 finally{rmSync(dir,{recursive:true,force:true})}
}
test('Node 24 release baseline supported',()=>{},errors=>errors.length===0);
test('outdated Node 22 lane rejected',d=>writeFileSync(join(d,'.github/workflows/check.yml'),"jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n"),errors=>errors.some(e=>e.includes('tested Node 24')));
test('engines upper bound rejected',d=>writeFileSync(join(d,'package.json'),JSON.stringify({engines:{node:'>=24.12.0 <26'}})),errors=>errors.some(e=>e.includes('engine')));
test('outdated Node 20 nvm rejected',d=>writeFileSync(join(d,'.nvmrc'),'20\n'),errors=>errors.some(e=>e.includes('.nvmrc')));
test('malformed metadata rejected',d=>writeFileSync(join(d,'package.json'),'{'),errors=>errors.some(e=>e.includes('malformed:')));
const source=readFileSync(new URL('./require-node22.mjs',import.meta.url),'utf8');
assert.match(source,/MINIMUM_NODE_MAJOR = 24/);
assert.match(source,/MINIMUM_NODE_MINOR = 12/);
assert.doesNotMatch(source,/TESTED_NODE_MAJORS/);
console.log('PASS: Node 24.12+ baseline negative tests');
