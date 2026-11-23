import { verifyDocumentIdentity, verifyR2Head, verifyR2Absence } from './r2DocumentIdentity.mjs';
import { assertErasureFence } from './r2ErasureFence.mjs';

// Source-only. The lock provider MUST persist a writer-honored fence and
// serialize every upload/replacement/delete for this key. No standard R2
// binding supports deleteIfMatch; this adapter remains unavailable until
// an independently verified conditional-delete provider is installed.
export function createR2ErasureAdapter({ bucket, resolveReceipt, lock, finalize }) {
  if (!bucket || typeof bucket.head !== 'function' ||
      typeof bucket.deleteIfMatch !== 'function' ||
      typeof resolveReceipt !== 'function' || typeof lock !== 'function' ||
      typeof finalize !== 'function') throw Error('R2 erasure dependencies unavailable');
  return async function erase({ documentId, ownerId, jwt }) {
    if (typeof jwt !== 'string' || !jwt.trim()) throw Error('Authenticated session required');
    return lock({ documentId, ownerId }, async fence => {
      const receipt = await resolveReceipt({ documentId, ownerId, jwt });
      if (!receipt || receipt.id !== documentId || receipt.owner_id !== ownerId ||
          receipt.allow_agent_use !== false ||
          typeof receipt.deletion_requested_at !== 'string' ||
          !Number.isFinite(Date.parse(receipt.deletion_requested_at)))
        throw Error('Document erasure not authorized');
      const identity = verifyDocumentIdentity({ ...receipt, document_id: receipt.id }, ownerId);
      const token = assertErasureFence(fence, { documentId, ownerId, receipt });
      verifyR2Head(identity, await bucket.head(identity.key));
      // Conditional delete is intentionally not replaceable by bucket.delete().
      const deleted = await bucket.deleteIfMatch(identity.key, identity.etag, token);
      if (deleted !== true) throw Error('Conditional R2 deletion not acknowledged');
      verifyR2Absence(await bucket.head(identity.key));
      // Finalization must CAS both immutable metadata and the SAME durable fence.
      if (await finalize({ receipt, ownerId, jwt, fenceId: token.fenceId, fenceVersion: token.version }) !== true)
        throw Error('Immutable metadata cleanup unconfirmed');
      return Object.freeze({ documentId, objectAbsent: true, metadataRemoved: true, accountDeleted: false });
    });
  };
}
