import { verifyDocumentIdentity, boundedDocumentBatch } from './r2DocumentIdentity.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const valid = value => typeof value === 'string' && UUID.test(value);

// Read-only preflight. rpc MUST forward the administrator's JWT, never substitute
// a service-role bearer. resolveReceipt MUST read authenticated immutable metadata,
// not derive missing receipt fields from the inventory or R2 HEAD response.
export async function reviewedR2Inventory({ requestId, jwt, rpc, resolveReceipt }) {
  if (!valid(requestId) || typeof jwt !== 'string' || !jwt.trim() ||
      typeof rpc !== 'function' || typeof resolveReceipt !== 'function')
    throw Error('Invalid authenticated inventory request');
  const queue = await rpc('ifund_super_admin_private_document_reviewed_queue', {}, jwt);
  if (!Array.isArray(queue) ||
      queue.filter(r => r?.request_id === requestId).length !== 1 ||
      queue.find(r => r?.request_id === requestId)?.review_ready !== true)
    throw Error('Private document review is not authorized');
  const requests = await rpc('ifund_super_admin_account_deletion_queue', { p_limit: 200 }, jwt);
  if (!Array.isArray(requests)) throw Error('Invalid authenticated deletion queue');
  const matching = requests.filter(r => r?.request_id === requestId);
  if (matching.length !== 1 || matching[0].request_status !== 'reviewing' ||
      !valid(matching[0].requested_user_id))
    throw Error('Deletion request owner cannot be authenticated');
  const ownerId = matching[0].requested_user_id;
  const rows = await rpc('ifund_super_admin_private_document_inventory',
    { p_request_id: requestId, p_limit: 100 }, jwt);
  if (!Array.isArray(rows) || rows.length > 100) throw Error('Invalid private document inventory');
  const verified = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row || !valid(row.document_id) || seen.has(row.document_id) ||
        typeof row.storage_path !== 'string' || seen.has(row.storage_path) ||
        typeof row.deletion_requested_at !== 'string' ||
        !Number.isFinite(Date.parse(row.deletion_requested_at)))
      throw Error('Duplicate or invalid document inventory identity');
    seen.add(row.document_id);
    seen.add(row.storage_path);
    const receipt = await resolveReceipt({ documentId: row.document_id, ownerId, jwt });
    if (!receipt || receipt.id !== row.document_id || receipt.owner_id !== ownerId ||
        receipt.object_store !== 'r2' ||
        receipt.storage_path !== row.storage_path ||
        receipt.object_etag !== row.object_etag ||
        receipt.object_sha256 !== row.object_sha256 ||
        receipt.file_size !== row.file_size ||
        receipt.campaign_id !== row.campaign_id ||
        receipt.deletion_requested_at !== row.deletion_requested_at ||
        receipt.allow_agent_use !== false)
      throw Error('Authenticated immutable metadata receipt mismatch');
    verifyDocumentIdentity({ ...row, object_verified_at: receipt.object_verified_at }, ownerId);
    verified.push(Object.freeze({ ...row, object_verified_at: receipt.object_verified_at }));
  }
  return boundedDocumentBatch(verified);
}
