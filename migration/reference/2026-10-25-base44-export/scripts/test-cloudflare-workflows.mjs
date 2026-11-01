import assert from 'node:assert/strict';import worker from '../host/workflows/worker.js';
const call=(path,method='GET')=>worker.fetch(new Request('https://ifund.invalid'+path,{method}));
let r=await call('/health');assert.equal(r.status,200);let v=await r.json();assert.equal(v.workflow_count,17);assert.equal(v.ready,false);
r=await call('/v1/workflows/catalog');assert.equal(r.status,200);v=await r.json();assert.equal(v.workflows.length,17);
r=await call('/v1/workflows/execute','POST');assert.equal(r.status,503);v=await r.json();assert.equal(v.executed,false);
console.log('PASS: workflow catalog preserves all 17 entries; execution is disabled');
