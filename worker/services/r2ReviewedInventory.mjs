import { verifyDocumentIdentity, boundedDocumentBatch } from './r2DocumentIdentity.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const valid = value => typeof value === 'string' && UUID.test(value);

// Read-only authorization preflight. No erasure or R2 mutation is performed here.
export async function reviewedR2Inventory({ requestId, jwt, rpc, ownerId }) {
  if (!valid(requestId) || !valid(ownerId) || typeof jwt !== 'string' || !jwt.trim() || typeof rpc !== 'function')
    throw Error('Invalid authenticated inventory request');
  // The RPC transport must bind jwt to the caller's session and must never use a
  // service-role token as a substitute for the caller's administrator identity.
  const queue = await rpc('ifund_super_admin_private_document_reviewed_queue', {}, jwt);
  if (!Array.isArray(queue) || !queue.some(r => r?.request_id === requestId && r.review_ready === true))
    throw Error('Private document review is not authorized');
  const rows = await rpc('ifund_super_admin_private_document_inventory', { p_request_id: requestId, p_limit: 100 }, jwt);
  if (!Array.isArray(rows) || rows.length > 100) throw Error('Invalid private document inventory');
  for (const row of rows) verifyDocumentIdentity(row, ownerId);
  return boundedDocumentBatch(rows);
}
