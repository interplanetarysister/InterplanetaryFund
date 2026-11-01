import {authClient} from "@/api/auth";

// Source: src/pages/GlobalGlobe.jsx and CampaignGlobe.jsx.
// Only owner-consented, publicly active, valid geographic coordinates are
// offered to the 3D renderer. No approximate/guessed location or donor totals.
export async function listGlobeCampaigns(){
 const client=authClient();
 const {data,error}=await client.from("ifund_campaigns")
  .select("id,title,summary,category,cover_image_url,status,location,location_lat,location_lng,globe_visible")
  .eq("status","active").eq("globe_visible",true)
  .order("created_at",{ascending:false}).limit(200);
 if(error)throw Error("Verified globe data is currently unavailable.");
 if(!Array.isArray(data))throw Error("Unexpected globe data response.");
 return data.filter(c=>
    c.status==="active"&&c.globe_visible===true&&
    c.location_lat!==null&&c.location_lng!==null&&
    Number.isFinite(Number(c.location_lat))&&Number.isFinite(Number(c.location_lng))&&
    Math.abs(Number(c.location_lat))<=90&&Math.abs(Number(c.location_lng))<=180
  ).map(c=>({
   id:c.id,title:c.title,summary:c.summary,category:c.category,
   cover_image_url:c.cover_image_url,location:c.location||"",
   location_lat:Number(c.location_lat),location_lng:Number(c.location_lng),
   status:"active",goal_amount:null,raised_amount:null,donor_count:null,
  }));
}
