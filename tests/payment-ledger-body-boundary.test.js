import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../supabase/functions/ifund-payment-ledger/index.ts',import.meta.url),'utf8');
function harness(){
 const signed=[];
 const context=vm.createContext({Response,Request,Headers,URL,TextEncoder,TextDecoder,Uint8Array,atob,
  Deno:{env:{get:()=>''},serve(){}},
  crypto:{subtle:{importKey:async()=>({}),verify:async(_algorithm,_key,_signature,bytes)=>{signed.push(new TextDecoder().decode(bytes));return true;}}}});
 vm.runInContext(source,context);
 return {run:req=>context.verifiedBody(req),signed};
}
function streamed(chunks,extraHeaders={}){
 let cancelled=false,read=0;
 return {get cancelled(){return cancelled;},get read(){return read;},request:{
  headers:new Headers({'x-ifund-timestamp':String(Math.floor(Date.now()/1000)),'x-ifund-signature':'AA',...extraHeaders}),
  body:new ReadableStream({pull(controller){if(read<chunks.length)controller.enqueue(chunks[read++]);else controller.close();},cancel(){cancelled=true;}},{highWaterMark:0})}};
}
test('Edge rejects declared oversized signed bodies without consuming the stream',async()=>{
 const h=harness(),s=streamed([new Uint8Array(4)],{'content-length':'65537'});
 await assert.rejects(h.run(s.request),/too large/);assert.equal(s.read,0);assert.equal(h.signed.length,0);
});
test('Edge counts streaming bytes despite understated length and cancels before verification',async()=>{
 const h=harness(),s=streamed([new Uint8Array(65536),new Uint8Array(1),new Uint8Array(1)],{'content-length':'1'});
 await assert.rejects(h.run(s.request),/too large/);assert.equal(s.cancelled,true);assert.equal(s.read,2);assert.equal(h.signed.length,0);
});
test('Edge rejects multibyte overflow and invalid UTF-8 before signature verification',async()=>{
 for(const chunks of [[new TextEncoder().encode('é'.repeat(32769))],[new Uint8Array([0xc3,0x28])]]){
  const h=harness(),s=streamed(chunks);await assert.rejects(h.run(s.request));assert.equal(h.signed.length,0);
 }
});
test('Edge verifies the exact original signed JSON bytes, including whitespace and Unicode',async()=>{
 const raw=' { "op": "synthetic", "data": "é" }\n',bytes=new TextEncoder().encode(raw),h=harness();
 const s=streamed([bytes.slice(0,29),bytes.slice(29)]);
 assert.equal(JSON.stringify(await h.run(s.request)),JSON.stringify({op:'synthetic',data:'é'}));
 assert.equal(h.signed[0],s.request.headers.get('x-ifund-timestamp')+'\n'+raw);
});
