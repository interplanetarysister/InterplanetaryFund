import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import vm from 'node:vm';

const root=dirname(fileURLToPath(import.meta.url));
const workerCode=readFileSync(resolve(root,'worker.js'),'utf8');
const preview='https://approved.interplanetaryfund-migration.pages.dev';
const production='https://interplanetaryfund.com';
let delegated=[];
function handler(){
  delegated=[];
  const script=workerCode
    .replace('export default {','const worker = {')
    .replace(
      'const {onRequest:sandboxPagesCheckout}=await import("../../apps/web/functions/api/paypal/sandbox/[[path]].js");',
      'const sandboxPagesCheckout=standInSandboxHandler;'
    )+'\nworker;';
  assert.notEqual(script,workerCode,'worker source must be transformed for VM');
  return vm.runInNewContext(script,{
    Request,Response,Headers,URL,TextEncoder,crypto:globalThis.crypto,
    standInSandboxHandler:async ({request,params})=>{
      delegated.push({url:request.url,route:params.path.join('/')});
      return Response.json({ok:true,mode:'sandbox'},{headers:{
        'set-cookie':'ifund_sandbox_order=test; HttpOnly; Secure; SameSite=Lax; Path=/api/paypal/sandbox; Max-Age=3600'
      }});
    },
  });
}
const sandbox={
  IFUND_PAYPAL_SANDBOX_ENABLED:'enabled',
  IFUND_SANDBOX_BROKER:{fetch:async()=>{}},
  PAYPAL_WEBHOOK_ID:'sandbox-webhook-test',
  SUPABASE_URL:'https://db.example.test',
};
const req=(origin,route,method='GET')=>new Request(origin+'/api/payments/'+route,{
  method,headers:{origin,'content-type':'application/json'},
  ...(method==='POST'?{body:'{}'}:{}),
});
test('disabled sandbox binding never delegates',async()=>{
  const worker=handler();
  const r=await worker.fetch(req(preview,'sandbox/orders','POST'),{...sandbox,IFUND_PAYPAL_SANDBOX_ENABLED:'disabled'});
  assert.equal(r.status,503);
  assert.equal(delegated.length,0);
});
test('production host cannot access sandbox checkout, even with bindings',async()=>{
  const worker=handler();
  const r=await worker.fetch(req(production,'sandbox/orders','POST'),sandbox);
  assert.equal(r.status,503);
  assert.equal(delegated.length,0);
});
test('missing internal sandbox broker denies checkout',async()=>{
  const worker=handler();
  const r=await worker.fetch(req(preview,'sandbox/orders','POST'),{...sandbox,IFUND_SANDBOX_BROKER:null});
  assert.equal(r.status,503);
  assert.equal(delegated.length,0);
});
test('unexpected route and method fail closed',async()=>{
  const worker=handler();
  assert.equal((await worker.fetch(req(preview,'sandbox/refund','POST'),sandbox)).status,404);
  assert.equal((await worker.fetch(req(preview,'sandbox/capture'),sandbox)).status,405);
  assert.equal(delegated.length,0);
});
test('preview sandbox orders delegate without using live OAuth or ledger',async()=>{
  const worker=handler();
  const r=await worker.fetch(req(preview,'sandbox/orders','POST'),sandbox);
  assert.equal(r.status,200);
  assert.deepEqual(delegated.map(x=>x.route),['orders']);
  assert.match(r.headers.get('set-cookie'),/Path=\/api\/payments\/sandbox(?:;|$)/);
  assert.doesNotMatch(r.headers.get('set-cookie'),/Path=\/api\/paypal\/sandbox(?:;|$)/);
});
test('preview sandbox SDK configuration is GET only',async()=>{
  const worker=handler();
  const r=await worker.fetch(req(preview,'sandbox/config'),sandbox);
  assert.equal(r.status,200);
  assert.deepEqual(delegated.map(x=>x.route),['config']);
  assert.equal((await worker.fetch(req(preview,'sandbox/config','POST'),sandbox)).status,405);
});
test('live health and live checkout client remain unchanged',async()=>{
  const worker=handler();
  const config={IFUND_PAYMENTS_ENABLED:'true',IFUND_PAYPAL_MODE:'live',PAYPAL_CLIENT_ID:'live-only-public-id'};
  const health=await worker.fetch(req(production,'health'),config);
  assert.equal(health.status,200);
  assert.equal((await health.json()).mode,'live');
  const c=await worker.fetch(req(production,'config'),config);
  assert.equal(c.status,200);
  assert.equal((await c.json()).environment,'live');
  assert.equal((await (await worker.fetch(req(production,'config'),config)).json()).client_id,'live-only-public-id');
  assert.equal(delegated.length,0);
});
