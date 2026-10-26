import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../base44/functions/generateCampaignCover/entry.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function make({authenticated=true,result={url:'https://media.base44.com/g/cover.png'},error=false}={}) {
  const exports={};
  const sdk={auth:{me:async()=>authenticated?{id:'user'}:null},
    integrations:{Core:{GenerateImage:async({prompt})=>{if(error)throw Error('provider unavailable');return result;}}}};
  new Function('require','exports','Response','console',js)(
    name => {
      if (name.includes('base44/sdk')) return {createClientFromRequest:()=>sdk};
      if (name.endsWith('accountGuard.ts')) return {
        assertActiveAccount:async()=>authenticated
          ? {ok:true,user:{id:'user'}} : {ok:false,status:401,error:'Authentication required'},
      };
      if (name.endsWith('ifundSignatureStyle.ts')) return {IFUND_SIGNATURE_STYLE:'IFund cosmic graphic-novel signature style'};
      throw Error('Unknown import '+name);
    },exports,Response,{error:()=>{}}
  );
  return exports.default;
}
const req=prompt=>({json:async()=>({prompt})});
{
 const res=await make()(req('A hopeful illustrated community portrait'));
 assert.equal(res.status,200);
 assert.equal((await res.json()).url,'https://media.base44.com/g/cover.png');
}
{
 const res=await make({authenticated:false})(req('hello'));
 assert.equal(res.status,401);
}
{
 const res=await make({result:{images:[{url:'https://media.base44.com/g/other.webp'}]}})(req('hello'));
 assert.equal(res.status,200);
}
{
 const res=await make({result:{url:'javascript:alert(1)'}})(req('hello'));
 assert.equal(res.status,502);
}
{
 const res=await make({result:{}})(req('hello'));
 assert.equal(res.status,502);
}
{
 const res=await make({error:true})(req('hello'));
 assert.equal(res.status,503);
}
{
 const res=await make()(req(''));
 assert.equal(res.status,400);
}
console.log('PASS: 7 generated cover endpoint cases (success, response variants, authentication, malformed provider response, exception).');
