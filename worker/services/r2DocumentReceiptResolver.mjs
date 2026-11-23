import { documentObjectKey } from './r2DocumentIdentity.mjs';

// Source-only. This RPC must independently authenticate the administrator's
// current session, reviewed request and owner before returning immutable data.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXT=new Set(['pdf','docx','xlsx','txt','md','csv']);
export function createAuthenticatedDocumentReceiptResolver({rpc}) {
  if(typeof rpc!=='function') throw Error('Authenticated receipt RPC is required');
  return async function resolveReceipt({documentId,ownerId,jwt}) {
    if(!UUID.test(documentId||'')||!UUID.test(ownerId||'')||
       typeof jwt!=='string'||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
      throw Error('Invalid receipt identity');
    const rows=await rpc('ifund_super_admin_private_document_receipt',
      {p_document_id:documentId,p_owner_id:ownerId},jwt);
    if(!Array.isArray(rows)||rows.length!==1) throw Error('Receipt unavailable or ambiguous');
    const row=rows[0];
    if(!row||row.id!==documentId||row.owner_id!==ownerId||
       !UUID.test(row.campaign_id||'')||row.object_store!=='r2'||
       typeof row.storage_path!=='string')
      throw Error('Immutable receipt is invalid');
    const extension=row.storage_path.split('.').at(-1);
    if(!EXT.has(extension)||row.storage_path!==documentObjectKey({
      ownerId,campaignId:row.campaign_id,documentId,extension
    })||typeof row.object_etag!=='string'||!row.object_etag.trim()||
       !/^[a-f0-9]{64}$/i.test(row.object_sha256||'')||
       !Number.isSafeInteger(row.file_size)||row.file_size<0||
       typeof row.object_verified_at!=='string'||
       !Number.isFinite(Date.parse(row.object_verified_at))||
       typeof row.deletion_requested_at!=='string'||
       !Number.isFinite(Date.parse(row.deletion_requested_at))||
       row.allow_agent_use!==false)
      throw Error('Immutable receipt is invalid');
    return Object.freeze({...row, document_id: row.id});
  };
}
