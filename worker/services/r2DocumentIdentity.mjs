// R2 private document identity contract. Validation only: no deletion side effects.
// A separate authenticated, serialized server adapter must enforce these checks.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const EXT = new Set(["pdf","docx","xlsx","txt","md","csv"]);
export const MAX_PRIVATE_DOCUMENT_DELETE_BATCH = 10;
export function documentObjectKey({ownerId,campaignId,documentId,extension}){
 if(![ownerId,campaignId,documentId].every(v=>typeof v==="string"&&UUID.test(v))||
    !EXT.has(extension))throw Error("Invalid private document identity");
 return `private/campaign-documents/${ownerId}/${campaignId}/${documentId}.${extension}`;
}
export function verifyDocumentIdentity(row,ownerId){
 if(!row||typeof row!=="object"||!UUID.test(ownerId||"")||
    !UUID.test(row.document_id||"")||!UUID.test(row.campaign_id||"")||
    typeof row.storage_path!=="string")throw Error("Unverifiable private document metadata");
 const match=/^private\/campaign-documents\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.([a-z0-9]+)$/.exec(row.storage_path);
 if(!match||match[1]!==ownerId||match[2]!==row.campaign_id||
    match[3]!==row.document_id||!EXT.has(match[4])||
    documentObjectKey({ownerId,campaignId:row.campaign_id,documentId:row.document_id,extension:match[4]})!==row.storage_path||
    typeof row.object_etag!=="string"||!row.object_etag.trim()||
    !SHA256.test(row.object_sha256||"")||
    !Number.isSafeInteger(row.file_size)||row.file_size<0||
    !row.object_verified_at||!Number.isFinite(Date.parse(row.object_verified_at)))
   throw Error("Private document identity or verified receipt mismatch");
 return Object.freeze({key:row.storage_path,etag:row.object_etag,sha256:row.object_sha256,size:row.file_size});
}
export function verifyR2Head(receipt,head){
 if(!receipt||!head||typeof head!=="object"||
    head.httpEtag!==receipt.etag||head.size!==receipt.size||
    typeof head.checksums?.sha256!=="string"||
    head.checksums.sha256.toLowerCase()!==receipt.sha256.toLowerCase())
   throw Error("R2 object identity cannot be independently confirmed");
 return true;
}
export function verifyR2Absence(headAfterDelete){
 // A null result from a successful R2 head() call proves object absence.
 // Exceptions, HTTP errors and ambiguous responses MUST fail closed.
 if(headAfterDelete!==null)throw Error("R2 HEAD absence not verified");
 return true;
}
export function boundedDocumentBatch(rows){
 if(!Array.isArray(rows)||rows.length>100)throw Error("Invalid document inventory");
 return rows.slice(0,MAX_PRIVATE_DOCUMENT_DELETE_BATCH);
}
