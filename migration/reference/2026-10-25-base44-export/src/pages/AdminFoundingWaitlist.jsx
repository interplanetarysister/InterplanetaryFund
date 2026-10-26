import React, {useEffect,useMemo,useState} from 'react';
import {base44} from '@/api/base44Client';
export default function AdminFoundingWaitlist(){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[busy,setBusy]=useState('');
 async function refresh(){
  setLoading(true);setError('');
  try {const data=await base44.entities.FoundingWaitlist.list('-created_date',500);setRows(Array.isArray(data)?data:[]);}
  catch(e){setError('Could not load the private founding-member queue.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{refresh()},[]);
 const results=useMemo(()=>rows.filter(r=>(filter==='all'||r.status===filter)&&
  [r.email,r.screen_name,r.interest].join(' ').toLowerCase().includes(query.toLowerCase())),[rows,filter,query]);
 async function change(row,status){
  if(!window.confirm('Change this member to '+status+'? This updates queue status only; it does not send invitations or grant access.'))return;
  setBusy(row.id);setError('');
  try{await base44.entities.FoundingWaitlist.update(row.id,{status});setRows(v=>v.map(x=>x.id===row.id?{...x,status}:x));}
  catch(e){setError('Could not change that status.');}finally{setBusy('');}
 }
 return <main className="mx-auto max-w-6xl p-5 text-foreground"><h1 className="text-2xl font-bold">Founding Members</h1>
 <p className="my-3 text-sm text-muted-foreground">Private queue. Marking someone invited or approved here does not send an email, create an account, or grant fundraising permissions.</p>
 <div className="flex flex-wrap gap-3 my-5"><input aria-label="Search members" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search email or screen name" className="min-h-11 min-w-52 flex-1 rounded-lg border border-border bg-background p-3"/><select aria-label="Filter status" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border border-border bg-background px-3"><option value="all">All members</option><option value="waiting">Waiting</option><option value="invited">Invited</option><option value="approved">Approved</option></select><button onClick={refresh} className="rounded-lg border border-border px-4 py-2">Refresh</button></div>
 <p className="mb-4 text-sm">{results.length} shown · {rows.length} loaded (up to 500)</p>
 {loading&&<p role="status">Loading members…</p>}{error&&<p role="alert">{error}</p>}
 <div className="space-y-3">{results.map(r=><article key={r.id} className="rounded-xl border border-border bg-card p-4">
  <div className="flex flex-wrap justify-between gap-3"><div className="break-all"><strong>{r.screen_name||r.email}</strong><p className="text-sm">{r.email}</p><p className="text-xs text-muted-foreground">{r.interest} · {r.joined_at?.slice(0,10)||'Unknown date'} · {r.marketing_opt_in?'News opt-in':'No news opt-in'}</p></div><span className="capitalize text-sm">{r.status}</span></div>
  <div className="mt-3 flex flex-wrap gap-2">{['waiting','invited','approved'].map(s=><button key={s} disabled={busy===r.id||r.status===s} onClick={()=>change(r,s)} className="min-h-10 rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40">Mark {s}</button>)}</div>
 </article>)}</div>
 </main>;
}
