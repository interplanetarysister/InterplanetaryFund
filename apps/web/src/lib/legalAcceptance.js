import { TERMS_VERSION } from "@/lib/legalPolicy";

async function currentUser(client){
 const {data,error}=await client.auth.getUser();
 if(error||!data?.user?.id)throw new Error("Sign in to review the IFund user agreement.");
 return data.user.id;
}

// The database, not browser storage, is the acceptance authority.
export async function legalAcceptanceStatus(client){
 const owner=await currentUser(client);
 const {data,error}=await client.from("ifund_legal_acceptances")
  .select("owner_id,terms_version,explicit_consent,accepted_at")
  .eq("owner_id",owner).eq("terms_version",TERMS_VERSION).maybeSingle();
 if(error)throw new Error("We could not verify your agreement. Please retry.");
 if(data && (data.owner_id!==owner||data.terms_version!==TERMS_VERSION))
  throw new Error("Agreement owner verification failed.");
 return {accepted:!!(data?.explicit_consent===true && data?.accepted_at),
  terms_version:TERMS_VERSION};
}
export async function acceptLegalAgreement(client,{explicit_consent}={}){
 if(explicit_consent!==true)throw new Error("Review and affirmatively accept the IFund user agreement.");
 const owner=await currentUser(client);
 const {data,error}=await client.from("ifund_legal_acceptances")
  .insert({owner_id:owner,terms_version:TERMS_VERSION,explicit_consent:true})
  .select("owner_id,terms_version,explicit_consent,accepted_at").maybeSingle();
 if(error && error.code!=="23505")throw new Error("Agreement could not be saved. Please try again.");
 // Even if this version already existed, require a fresh verified read.
 const verified=await legalAcceptanceStatus(client);
 if(!verified.accepted)throw new Error("Agreement acceptance was not confirmed.");
 return verified;
}
