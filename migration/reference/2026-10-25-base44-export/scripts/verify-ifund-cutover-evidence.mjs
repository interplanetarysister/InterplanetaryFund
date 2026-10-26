import fs from 'node:fs';
const checks=[
 ['workflow inventory',fs.existsSync('host/workflows/manifest.json')],
 ['workflow activation evidence',false],
 ['independent workflow execution with idempotency',false],
 ['independent workforce execution and memory',false],
 ['independent authentication and campaign storage',false],
 ['payment/webhook ledger parity',false],
 ['live DNS and route parity',false],
 ['live end-to-end acceptance tests',false],
];
for(const [name,pass] of checks)console.log(`${pass?'PASS':'BLOCKED'}: ${name}`);
if(checks.some(x=>!x[1])){console.error('CUTOVER NOT VERIFIED: preserve existing live origin and avoid duplicate execution');process.exitCode=1}
