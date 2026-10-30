export async function verifyAccountLifecycle(client,user){
  if(!user?.id)return {ok:false,status:401,message:"This account is no longer available."};
  try{
    const {data,error}=await client.from("ifund_profiles")
      .select("account_status,account_deletion_pending").eq("id",user.id).maybeSingle();
    if(error)return {ok:false,status:503,message:"Account status could not be verified."};
    if(!data)return {ok:false,status:401,message:"This account is no longer available."};
    if(typeof data.account_status!=="string"||typeof data.account_deletion_pending!=="boolean")
      return {ok:false,status:503,message:"Account status could not be verified."};
    if(data.account_deletion_pending)
      return {ok:false,status:403,message:"This account is scheduled for deletion and can no longer be used."};
    if(data.account_status!=="active")
      return {ok:false,status:403,message:"This account is no longer available."};
    return {ok:true};
  }catch{return {ok:false,status:503,message:"Account status could not be verified."};}
}