import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewedR2Inventory } from './r2ReviewedInventory.mjs';

const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const campaign='33333333-3333-4333-8333-333333333333';
const doc='44444444-4444-4444-8444-444444444444';
const requestId='55555555-5555-4555-8555-555555555555';
const timestamp='2026-11-20T00:00:00Z';
const row={
  document_id:doc,campaign_id:campaign,
  storage_path:`private/campaign-documents/${owner}/${campaign}/${doc}.pdf`,
  object_store:'r2',owner_id:owner,
  deletion_requested_at:timestamp,object_etag:'"etag"',
  object_sha256:'a'.repeat(64),file_size:10
};
const receipt={
  ...row,id:doc,owner_id:owner,allow_agent_use:false,
  object_verified_at:timestamp
};
const reviewed=[{request_id:requestId,review_ready:true}];
const requests=[{request_id:requestId,request_status:'reviewing',requested_user_id:owner}];
const run=({queue=reviewed,deletions=requests,rows=[row],receiptFor=()=>receipt,jwt='session'}={})=>{
  const called=[];
  return reviewedR2Inventory({
    requestId,jwt,
    rpc:async(name,args,token)=>{
      assert.equal(token,jwt);
      called.push(name);
      if(name==='ifund_super_admin_private_document_reviewed_queue'){
        assert.deepEqual(args,{});
        return queue;
      }
      if(name==='ifund_super_admin_account_deletion_queue'){
        assert.deepEqual(args,{p_limit:200});
        return deletions;
      }
      if(name==='ifund_super_admin_private_document_inventory'){
        assert.deepEqual(args,{p_request_id:requestId,p_limit:10});
        return rows;
      }
      throw Error('Unexpected RPC: '+name);
    },
    resolveReceipt:async({documentId,ownerId,jwt:token})=>{
      assert.equal(ownerId,owner);
      assert.equal(token,jwt);
      return receiptFor(documentId);
    }
  }).then(result=>{
    assert.deepEqual(called,[
      'ifund_super_admin_private_document_reviewed_queue',
      'ifund_super_admin_account_deletion_queue',
      'ifund_super_admin_private_document_inventory'
    ]);
    return result;
  });
};
test('reviewed exact owner inventory accepted',async()=>{
  const result=await run();
  assert.equal(result.length,1);
  assert.equal(result[0].object_verified_at,timestamp);
});
test('empty inventory accepted only after authenticated review',async()=>assert.deepEqual(await run({rows:[]}),[]));
test('missing review denied',async()=>assert.rejects(run({queue:[]})));
test('false review denied',async()=>assert.rejects(run({queue:[{request_id:requestId,review_ready:false}]})));
test('duplicate review denied',async()=>assert.rejects(run({queue:[...reviewed,...reviewed]})));
test('missing deletion request denied',async()=>assert.rejects(run({deletions:[]})));
test('wrong deletion request status denied',async()=>assert.rejects(run({deletions:[{...requests[0],request_status:'pending'}]})));
test('cross-owner inventory denied',async()=>assert.rejects(run({rows:[{...row,storage_path:row.storage_path.replace(owner,other)}]})));
test('cross-owner receipt denied',async()=>assert.rejects(run({receiptFor:()=>({...receipt,owner_id:other})})));
test('stale immutable receipt denied',async()=>assert.rejects(run({receiptFor:()=>({...receipt,object_etag:'old'})})));
test('missing immutable receipt denied',async()=>assert.rejects(run({receiptFor:()=>null})));
test('missing deletion timestamp denied',async()=>assert.rejects(run({rows:[{...row,deletion_requested_at:null}]})));
test('agent-consented receipt denied',async()=>assert.rejects(run({receiptFor:()=>({...receipt,allow_agent_use:true})})));
test('duplicate document denied',async()=>assert.rejects(run({rows:[row,row]})));
test('oversized inventory denied',async()=>assert.rejects(run({rows:Array(101).fill(row)})));
test('ten-row batch returns all ten documents',async()=>{
  // The inventory binds receipt work to ten objects: more than ten rows are
  // rejected outright (see 'oversized inventory denied'), never truncated.
  const rows=Array.from({length:10},(_,i)=>{
    const id=(i+1).toString(16).padStart(12,'0');
    return {...row,document_id:`44444444-4444-4444-8444-${id}`,storage_path:row.storage_path.replace(doc,`44444444-4444-4444-8444-${id}`)};
  });
  const result=await run({rows,receiptFor:id=>({...receipt,id,storage_path:rows.find(r=>r.document_id===id)?.storage_path})});
  assert.equal(result.length,10);
  assert.equal(result[9].document_id,rows[9].document_id);
});
test('unauthenticated request denied before RPC',async()=>{
  await assert.rejects(reviewedR2Inventory({requestId,jwt:'',rpc:()=>{throw Error('must not run')},resolveReceipt:()=>receipt}));
});
