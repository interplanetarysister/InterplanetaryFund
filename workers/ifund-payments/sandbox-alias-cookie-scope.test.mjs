import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const source=readFileSync(resolve(here,'../../apps/web/functions/api/payments/sandbox/[[path]].js'),'utf8');
const importLine='import {onRequest as sandboxCheckout} from "../../paypal/sandbox/[[path]].js";';
assert.ok(source.includes(importLine),'sandbox alias import must match tested source');
const executable=source.replace(importLine,'const sandboxCheckout = globalThis.__sandboxCheckout;');
const moduleUrl='data:text/javascript;base64,'+Buffer.from(executable).toString('base64');
const {onRequest}=await import(moduleUrl);

const preview='https://test.interplanetaryfund-migration.pages.dev';
const cookie='session=synthetic; HttpOnly; Secure; Path=/api/paypal/sandbox; SameSite=Lax';
const request=(host,route,method='POST')=>new Request(host+'/api/payments/sandbox/'+route,{method});
async function invoke(route,{method='POST',host=preview,withCookie=true}={}){
  globalThis.__sandboxCheckout=async()=>new Response('synthetic',{headers:withCookie?{'set-cookie':cookie}:{}});
  return onRequest({request:request(host,route,method),params:{path:[route]}});
}
test('order creation rewrites sandbox cookie path',async()=>{
  const result=await invoke('orders');
  assert.ok(result.headers.get('set-cookie').includes('Path=/api/payments/sandbox;'));
});
test('capture response never rewrites sandbox cookie',async()=>{
  const result=await invoke('capture');
  assert.equal(result.headers.get('set-cookie'),cookie);
});
test('webhook response never rewrites sandbox cookie',async()=>{
  const result=await invoke('webhook');
  assert.equal(result.headers.get('set-cookie'),cookie);
});
test('GET order response never rewrites cookie',async()=>{
  const result=await invoke('orders',{method:'GET'});
  assert.equal(result.headers.get('set-cookie'),cookie);
});
test('production host rejects without invoking sandbox handler',async()=>{
  let invoked=false;
  globalThis.__sandboxCheckout=async()=>{invoked=true;return new Response('unsafe')};
  const result=await onRequest({request:request('https://interplanetaryfund.com','orders'),params:{path:['orders']}});
  assert.equal(result.status,403);
  assert.equal(invoked,false);
});
test('missing cookie remains absent',async()=>{
  const result=await invoke('orders',{withCookie:false});
  assert.equal(result.headers.get('set-cookie'),null);
});
