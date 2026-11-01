import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";
import { resolveVerifiedEmailUser } from "@/lib/verifiedEmailUser";
import { verifyAccountLifecycle } from "@/lib/accountLifecycle";

// UI/navigation state only. Protected server actions must independently validate
// JWT identity, role and row ownership through the Worker and Supabase RLS.
export default function useVerifiedUser(){
  const [state,setState]=useState({phase:"loading",user:null});
  useEffect(()=>{
    let mounted=true;
    let subscription;
    const blockedRef={current:null};
    const verify=async()=>{
      try{
        const client=authClient();
        const user=await resolveVerifiedEmailUser(client.auth);
        if(!user){if(mounted)setState({phase:"ready",user:null});return;}
        const lifecycle=await verifyAccountLifecycle(client,user);
        if(!lifecycle.ok){
          if(lifecycle.status===401||lifecycle.status===403){
            blockedRef.current=lifecycle.message;
            if(mounted)setState({phase:"blocked",user:null,message:lifecycle.message});
            await client.auth.signOut().catch(()=>{});
            if(mounted)setState({phase:"blocked",user:null,message:lifecycle.message});
            return;
          }
          throw new Error(lifecycle.message||"Account status could not be verified.");
        }
        blockedRef.current=null;
        if(mounted)setState({phase:"ready",user});
      }catch{
        if(mounted)setState({phase:"error",user:null});
      }
    };
    try{
      const client=authClient();
      const {data}=client.auth.onAuthStateChange(event=>{
        if(!mounted)return;
        if(event==="SIGNED_OUT"){const message=blockedRef.current;setState(message?{phase:"blocked",user:null,message}:{phase:"ready",user:null});}
        if(["SIGNED_IN","TOKEN_REFRESHED","USER_UPDATED","INITIAL_SESSION"].includes(event)){
          blockedRef.current=null;
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
