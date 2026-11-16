import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{connectionCatalog,connectionProvider,connectionMethods,connectionActionInput,memberConnectionLink}from'../worker/connections/catalog.js';
const uid='11111111-1111-4111-8111-111111111111';
test('all source provider identities and logos are preserved without claiming working integrations',()=>{
 const catalog=connectionCatalog();assert.equal(catalog.length,43);assert.equal(new Set(catalog.map(p=>p.id)).size,43);assert.equal(connectionProvider('custom').logo,null);assert.equal(memberConnectionLink('one_drive'),'/connections?connect=one_drive');assert.throws(()=>memberConnectionLink('arbitrary-provider'));
 const manifest=JSON.parse(readFileSync(new URL('../docs/agents/inventory/provider-assets.json',import.meta.url)));assert.equal(manifest.assets.length,42);for(const a of manifest.assets){const actual=readFileSync(new URL('../'+a.path,import.meta.url));assert.equal(createHash('sha256').update(actual).digest('hex'),a.sha256);}
});
test('source OAuth hints and saved configuration are not evidence of account or action permission',()=>{
 for(const registration of[null,{provider:'github',status:'saved'},{provider:'github',status:'verified',valid_until:'2020-01-01'}]){const result=connectionMethods('github',registration);assert.equal(result.status,'setup_required');assert.equal(result.financial_authority,false);assert.equal(result.account_creation_verified,false);assert.deepEqual(result.capabilities,[]);}
});
test('managed commands reject self-granted authority, arbitrary providers and missing repair targets',()=>{
 const input={operation_id:uid,provider:'github',action:'connect'};assert.equal(connectionActionInput(input).provider,'github');for(const patch of[{owner_id:uid},{action:'withdraw'},{provider:'unknown'},{action:'repair'},{admin:true},{environment:'production'}])assert.throws(()=>connectionActionInput({...input,...patch}));
});
