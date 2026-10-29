import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
export default function Connections() {
 const [rows,setRows]=useState([]);
 const [status,setStatus]=useState("loading");
 useEffect(()=>{let live=true;(async()=>{
  try {
   const client=authClient();
   const {data:{user}}=await client.auth.getUser();
   if(!user){if(live)setStatus("sign-in");return;}
   const {data,error}=await client.from("ifund_connections").select("id,provider,status,verified_at").eq("owner_id",user.id);
   if(error)throw error;
   if(live){setRows(data||[]);setStatus("ready");}
  } catch {if(live)setStatus("error");}
 })();return()=>{live=false};},[]);
 return <main className="mx-auto max-w-3xl p-6">
  <h1 className="text-3xl font-bold">Connections</h1>
  <p className="my-4">Review your independently verified platform connections. New provider connections are not enabled until consent and provider checks are complete.</p>
  {status==="loading"&&<p>Loading connections…</p>}
  {status==="sign-in"&&<Link to="/login">Sign in to view connections</Link>}
  {status==="error"&&<p role="alert">Connection records are unavailable.</p>}
  {status==="ready"&&(rows.length?<ul>{rows.map(x=><li key={x.id} className="my-3 rounded-xl border p-4">{x.provider}: {x.status}</li>)}</ul>:<p>No connections recorded.</p>)}
 </main>;
}
