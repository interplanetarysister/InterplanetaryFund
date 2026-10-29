import {Link,Navigate,useLocation} from "react-router-dom";
import useVerifiedUser from "@/lib/useVerifiedUser";

// UI guard only: independent backend handlers and Supabase RLS must also
// verify JWT identity, authorization and ownership for EVERY protected action.
export default function RequireAccess({access="member",children}){
 const location=useLocation();
 const state=useVerifiedUser();
 if(access==="public")return children;
 if(state.phase==="loading")return <main role="status" className="mx-auto max-w-3xl p-8">Verifying account access…</main>;
 if(state.phase==="error")return <main role="alert" className="mx-auto max-w-3xl p-8">Account verification is unavailable. No protected information was loaded.</main>;
 if(!state.user){
   const returnTo=location.pathname+location.search+location.hash;
   return <Navigate replace to={"/login?returnTo="+encodeURIComponent(returnTo)}/>;
 }
 if(access==="admin"||access==="specially protected administration"){
   const role=state.user.app_metadata?.role;
   if(role!=="admin"&&role!=="super_admin")
     return <main className="mx-auto max-w-3xl p-8">
       <h1 className="text-2xl font-semibold">Access restricted</h1>
       <p>This page requires independently verified administrative permissions.</p>
       <Link to="/dashboard" className="underline">Dashboard</Link>
     </main>;
 }
 return children;
}
