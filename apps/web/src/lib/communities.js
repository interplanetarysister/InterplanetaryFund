import {authClient} from "@/api/auth";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const communityTypes=Object.freeze({
 neighborhood:"Neighborhood",city:"City",school:"School",faith:"Faith",
 volunteer:"Volunteer",business:"Business",organization:"Organization",
 professional:"Professional",interest:"Shared Interest",emergency:"Emergency Response",other:"Other"
});
export async function loadPublicCommunity(id){
 if(!UUID.test(id||""))return null;
 const {data,error}=await authClient().from("ifund_communities")
  .select("id,name,description,type,location,cover_image_url,public_approved")
  .eq("id",id).eq("public_approved",true).maybeSingle();
 if(error)throw Error("Community could not be loaded.");
 if(!data||data.public_approved!==true)return null;
 return data;
}
export async function loadListedCommunityMembers(id){
 if(!UUID.test(id||""))return [];
 const {data,error}=await authClient().from("ifund_community_memberships")
  .select("id,community_id,role,public_display_name,public_listing_opt_in")
  .eq("community_id",id).eq("public_listing_opt_in",true).limit(100);
 if(error||!Array.isArray(data))throw Error("Community members could not be loaded.");
 return data.filter(x=>x.community_id===id&&x.public_listing_opt_in===true);
}
export async function loadMyCommunityMembership(id){
 if(!UUID.test(id||""))return null;
 const client=authClient(),{data:auth,error:authError}=await client.auth.getUser();
 if(authError||!auth?.user?.id)return null;
 const {data,error}=await client.from("ifund_community_memberships")
  .select("id,community_id,user_id,role")
  .eq("community_id",id).eq("user_id",auth.user.id).maybeSingle();
 if(error)throw Error("Your community membership could not be verified.");
 return data?.user_id===auth.user.id?data:null;
}
