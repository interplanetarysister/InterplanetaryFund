import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../workers/ifund-payments/worker.js';
const paths=['/api/payments/capture-order','/api/payments/subscriptions/confirm','/api/payments/subscriptions/cancel'];
for (const path of paths) {
 test('rejects unapproved origin before payment work: '+path,async()=>{
  for (const allowed of [undefined,'',' , ','https://interplanetaryfund.com']) {
   for (const origin of [undefined,'https://other.example']) {
    const request=new Request('https://interplanetaryfund.com'+path,{method:'POST',headers:origin?{origin}:{},body:'{}'});
    const reply=await worker.fetch(request,{IFUND_ALLOWED_ORIGINS:allowed});
    assert.equal(reply.status,403);
    assert.equal((await reply.json()).error,'origin_not_allowed');
   }
  }
 });
}
test('approved origin still requires payment enablement and member authentication',async()=>{
 for (const path of paths) {
  const request=new Request('https://interplanetaryfund.com'+path,{method:'POST',headers:{origin:'https://interplanetaryfund.com'},body:'{}'});
  const reply=await worker.fetch(request,{IFUND_ALLOWED_ORIGINS:'https://interplanetaryfund.com'});
  assert.ok([401,503].includes(reply.status));
  assert.equal(reply.headers.get('access-control-allow-origin'),'https://interplanetaryfund.com');
 }
});
