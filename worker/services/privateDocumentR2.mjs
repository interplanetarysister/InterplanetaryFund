// R2-only, fail-closed private document object adapter. Caller must verify
// reviewed deletion request, authenticated owner, and revoke document consent.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/i;
const ETAG=/^[a-f0-9]{32,64}$/i;
const EXT=/^(pdf|docx|xlsx|txt|md|csv)$/i;
export function canonicalDocumentKey(row,owner){
 if(!UUID.test(owner??'')||!UUID.test(row?.document_id??'')||!UUID.test(row?.campaign_id??''))throw Error('Invalid document identity');
 const path=String(row.storage_path??'');
 const expected=`private/campaign-documents/${owner}/${row.campaign_id}/${row.document_id}.`;
 if(!path.startsWith(expected)||!EXT.test(path.slice(expected.length)))throw Error('Noncanonical document key');
 if(!SHA.test(row.object_sha256??'')||!ETAG.test(String(row.object_etag??'').replace(/^"|"$/g,''))||!row.object_verified_at)throw Error('Missing immutable object receipt');
 return path;
}
const etag=value=>String(value??'').replace(/^"|"$/g,'').toLowerCase();
export async function removeVerifiedR2Document({bucket,row,owner}){
 if(!bucket||typeof bucket.head!=='function'||typeof bucket.delete!=='function')throw Error('R2 binding unavailable');
 const key=canonicalDocumentKey(row,owner);
 const before=await bucket.head(key);
 if(!before)throw Error('Object missing before authorized deletion; reconcile metadata');
 if(etag(before.httpEtag??before.etag)!==etag(row.object_etag))throw Error('R2 etag differs from immutable receipt');
 const sha=before.customMetadata?.sha256??before.customMetadata?.object_sha256;
 if(!sha||sha.toLowerCase()!==row.object_sha256.toLowerCase())throw Error('R2 SHA256 receipt unavailable or mismatched');
 if(Number(before.size)!==Number(row.file_size))throw Error('R2 size differs from immutable receipt');
 await bucket.delete(key);
 if(await bucket.head(key))throw Error('R2 HEAD did not confirm absence');
 return Object.freeze({key,document_id:row.document_id,object_etag:row.object_etag,object_sha256:row.object_sha256,absent:true});
}
