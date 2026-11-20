// Authenticated immutable receipt resolver. Never substitutes R2 HEAD or inventory
// fields for the database's verified receipt; unavailable RPC fails closed.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createAuthenticatedDocumentReceiptResolver({rpc}) {
  if(typeof rpc!=='function') throw Error('Authenticated receipt RPC is required');
  return async function resolveReceipt({documentId,ownerId,jwt}) {
    if(!UUID.test(documentId||'')||!UUID.test(ownerId||'')||
       typeof jwt!=='string'||!jwt.trim()) throw Error('Invalid receipt identity');
    // This RPC must verify the administrator session and review authorization
    // internally. It must return exactly one immutable metadata receipt.
    const rows=await rpc('ifund_super_admin_private_document_receipt',
      {p_document_id:documentId,p_owner_id:ownerId},jwt);
    if(!Array.isArray(rows)||rows.length!==1) throw Error('Receipt unavailable or ambiguous');
    const row=rows[0];
    if(!row||row.id!==documentId||row.owner_id!==ownerId||
       !UUID.test(row.campaign_id||'')||
       typeof row.storage_path!=='string'||!row.storage_path.startsWith(
         'private/campaign-documents/'+ownerId+'/'+row.campaign_id+'/'+documentId+'.')||
       typeof row.object_etag!=='string'||!row.object_etag.trim()||
       !/^[a-f0-9]{64}$/i.test(row.object_sha256||'')||
       !Number.isSafeInteger(row.file_size)||row.file_size<0||
       !row.object_verified_at||!Number.isFinite(Date.parse(row.object_verified_at))||
       row.object_store!=='r2')
      throw Error('Immutable receipt is invalid');
    return Object.freeze({...row});
  };
}
