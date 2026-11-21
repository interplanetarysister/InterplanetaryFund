import { verifyDocumentIdentity, verifyR2Head, verifyR2Absence } from './r2DocumentIdentity.mjs';

// Source-only: requires authenticated reviewed receipts and a durable lock.
// A normal R2 delete() is not conditional and must never substitute for CAS.
export function createR2ErasureAdapter({ bucket, resolveReceipt, lock, finalize }) {
  if (!bucket || typeof bucket.head !== 'function' ||
      typeof bucket.deleteIfMatch !== 'function' ||
      typeof resolveReceipt !== 'function' || typeof lock !== 'function' ||
      typeof finalize !== 'function') throw Error('R2 erasure dependencies unavailable');
  return async function erase({ documentId, ownerId, jwt }) {
    if (typeof jwt !== 'string' || !jwt.trim()) throw Error('Authenticated session required');
    return lock({ documentId, ownerId }, async () => {
      const receipt = await resolveReceipt({ documentId, ownerId, jwt });
      if (!receipt || receipt.id !== documentId || receipt.owner_id !== ownerId ||
          receipt.allow_agent_use !== false ||
          typeof receipt.deletion_requested_at !== 'string' ||
          !Number.isFinite(Date.parse(receipt.deletion_requested_at)))
        throw Error('Document erasure not authorized');
      const identity = verifyDocumentIdentity({ ...receipt, document_id: receipt.id }, ownerId);
      verifyR2Head(identity, await bucket.head(identity.key));
      const deleted = await bucket.deleteIfMatch(identity.key, identity.etag);
      if (deleted !== true) throw Error('Conditional R2 deletion not acknowledged');
      verifyR2Absence(await bucket.head(identity.key));
      // finalize must atomically compare immutable metadata, not just its ID.
      if (await finalize({ receipt, ownerId, jwt }) !== true)
        throw Error('Immutable metadata cleanup unconfirmed');
      return Object.freeze({ documentId, objectAbsent: true, metadataRemoved: true, accountDeleted: false });
    });
  };
}
