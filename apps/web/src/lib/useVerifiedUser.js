import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";

// Canonical verified session state. This is for navigation/UI only; never
// substitute it for server-side JWT validation or row-level security.
export default function useVerifiedUser(){
  const [state,setState]=useState({phase:"loading",user:null});
  useEffect(()=>{
    let mounted=true;
    let subscription;
    const verify=async()=>{
      try{
        const client=authClient();
        const {data,error}=await client.auth.getUser();
        if(mounted)setState(error?
          {phase:"error",user:null}:
          {phase:"ready",user:data?.user||null});
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
          // Supabase recommends avoiding awaited Auth queries inside listeners.
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
