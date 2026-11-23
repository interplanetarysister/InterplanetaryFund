// Source-only fail-closed guard; the database must enforce these fencing tokens
// for every document writer and metadata finalizer before erasure is enabled.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/i;
export function assertErasureFence(fence, {documentId,ownerId,receipt}) {
  if(!fence || fence.document_id!==documentId || fence.owner_id!==ownerId ||
    !UUID.test(documentId||'') || !UUID.test(ownerId||'') ||
    !UUID.test(fence.fence_id||'') || !Number.isSafeInteger(fence.version) || fence.version<1 ||
    fence.state!=='deleting' || fence.writers_blocked!==true ||
    fence.object_etag!==receipt?.object_etag || fence.object_sha256!==receipt?.object_sha256 ||
    !SHA.test(fence.object_sha256||'') ||
    fence.storage_path!==receipt?.storage_path ||
    typeof fence.expires_at!=='string' || !Number.isFinite(Date.parse(fence.expires_at)) ||
    Date.parse(fence.expires_at)<=Date.now()+30000)
    throw Error('Durable private-document deletion fence not verified');
  return Object.freeze({fenceId:fence.fence_id,version:fence.version});
}
