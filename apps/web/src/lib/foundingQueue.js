// Original FoundingWaitlist admin-only queue, never a browser signup API.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS="id,email,screen_name,interest,marketing_opt_in,referral_code,referred_by,status,joined_at";
const STATUSES=new Set(["waiting","invited","approved"]);
async function adminId(client){
 const {data,error}=await client.auth.getUser();
 const user=data?.user;
 if(error||!UUID.test(user?.id||"")||
   !["admin","super_admin"].includes(user?.app_metadata?.role))
  throw new Error("Verified administrator session is required to view the founding queue.");
 return user.id;
}
export async function listFoundingWaitlist(client){
 await adminId(client);
 const {data,error}=await client.from("ifund_founding_waitlist")
  .select(COLUMNS).order("joined_at",{ascending:false}).limit(500);
 if(error||!Array.isArray(data))throw new Error("Could not load the private founding-member queue.");
 return data;
}
export async function setFoundingStatus(client,id,status){
 await adminId(client);
 if(!UUID.test(id||"")||!STATUSES.has(status))
  throw new Error("Invalid founding-member status update.");
 const {data,error}=await client.from("ifund_founding_waitlist")
  .update({status}).eq("id",id)
  .select("id,status").maybeSingle();
 if(error||!data||data.id!==id||data.status!==status)
  throw new Error("Founding member status was not confirmed.");
 return data;
}
