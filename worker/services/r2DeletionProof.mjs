// Server-only, non-mutating R2 deletion preflight. Not an endpoint.
import { verifyDocumentIdentity, verifyR2Head, verifyR2Absence } from './r2DocumentIdentity.mjs';
export async function provePrivateR2Object({bucket,row,ownerId}) {
 if(!bucket||typeof bucket.head!=='function')throw Error('R2 binding unavailable');
 const receipt=verifyDocumentIdentity(row,ownerId);
 const head=await bucket.head(receipt.key);
 if(!head)throw Error('R2 object missing before deletion');
 const digest=head.checksums?.sha256;
 const hex=digest instanceof ArrayBuffer?Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join(''):digest;
 verifyR2Head(receipt,{...head,checksums:{sha256:hex}});
 return Object.freeze({key:receipt.key,ownerId,etag:receipt.etag,sha256:receipt.sha256});
}
export async function provePrivateR2Absence({bucket,row,ownerId}) {
 if(!bucket||typeof bucket.head!=='function')throw Error('R2 binding unavailable');
 const receipt=verifyDocumentIdentity(row,ownerId);
 verifyR2Absence(await bucket.head(receipt.key));
 return Object.freeze({key:receipt.key,absent:true});
}
