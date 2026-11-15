import test from 'node:test';
import assert from 'node:assert/strict';
import {replyEventKey} from './teamContext.js';
const base='12345678-1234-4234-8234-123456789abc';
test('same request always produces the same distinct reply key',()=>{
 assert.equal(replyEventKey(base),replyEventKey(base));
 assert.notEqual(replyEventKey(base),base);
});
test('different UUID variant and version bits never collide',()=>{
 const variants=['8234','9234','a234','b234'];
 const keys=[];
 for(const version of ['1234','4234','5234']) for(const variant of variants){
  const key='12345678-1234-'+version+'-'+variant+'-123456789abc';
  keys.push(replyEventKey(key));
 }
 assert.equal(new Set(keys).size,keys.length);
});
test('reply event key is a valid UUID',()=>{
 assert.match(replyEventKey(base),/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});
