import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";
import { resolveVerifiedEmailUser } from "@/lib/verifiedEmailUser";

// UI/navigation state only. Protected server actions must independently validate
// JWT identity, role and row ownership through the Worker and Supabase RLS.
export default function useVerifiedUser(){
  const [state,setState]=useState({phase:"loading",user:null});
  useEffect(()=>{
    let mounted=true;
    let subscription;
    const verify=async()=>{
      try{
        const user=await resolveVerifiedEmailUser(authClient().auth);
        if(mounted)setState({phase:"ready",user});
      }catch{
        if(mounted)setState({phase:"error",user:null});
      }
    };
    try{
      const client=authClient();
      const {data}=client.auth.onAuthStateChange(event=>{
        if(!mounted)return;
        if(event==="SIGNED_OUT")setState({phase:"ready",user:null});
        if(["SIGNED_IN","TOKEN_REFRESHED","USER_UPDATED","INITIAL_SESSION"].includes(event)){
          // Avoid awaiting Auth APIs inside Supabase's auth event callback.
          Promise.resolve().then(verify);
        }
      });
      subscription=data?.subscription;
      Promise.resolve().then(verify);
    }catch{
      if(mounted)setState({phase:"error",user:null});
    }
    return()=>{mounted=false;subscription?.unsubscribe();};
  },[]);
  return state;
}
