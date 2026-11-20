// Server-only R2 receipt reader. This module has no public route and cannot mutate objects.
// The caller must independently authorize the authenticated owner and campaign in Supabase.
import { verifyDocumentIdentity, verifyR2Head } from "./r2DocumentIdentity.mjs";

export function requireCampaignR2(env) {
  const bucket = env?.IFUND_CAMPAIGN_MEDIA;
  if (!bucket || typeof bucket.head !== "function" || typeof bucket.get !== "function")
    throw Error("Private document R2 binding is unavailable");
  return bucket;
}

export async function verifiedPrivateDocumentHead({ env, row, ownerId }) {
  const receipt = verifyDocumentIdentity(row, ownerId);
  const head = await requireCampaignR2(env).head(receipt.key);
  // Missing objects are not valid upload receipts. A null HEAD is only
  // meaningful for a separately authorized, serialized deletion flow.
  verifyR2Head(receipt, normalizeR2Head(head));
  return receipt;
}

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeR2Head(head) {
  if (!head || typeof head !== "object") return head;
  const checksum = head.checksums?.sha256;
  let sha256 = checksum;
  if (checksum instanceof ArrayBuffer) sha256 = bytesToHex(new Uint8Array(checksum));
  else if (ArrayBuffer.isView(checksum))
    sha256 = bytesToHex(new Uint8Array(checksum.buffer, checksum.byteOffset, checksum.byteLength));
  return { httpEtag: head.httpEtag, size: head.size, checksums: { sha256 } };
}

export async function verifiedPrivateDocumentRead({ env, row, ownerId }) {
  const receipt = await verifiedPrivateDocumentHead({ env, row, ownerId });
  const object = await requireCampaignR2(env).get(receipt.key);
  if (!object || !object.body) throw Error("Private document bytes unavailable");
  verifyR2Head(receipt, normalizeR2Head(object));
  return object;
}
