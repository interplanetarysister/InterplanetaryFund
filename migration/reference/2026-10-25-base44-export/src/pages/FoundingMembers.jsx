import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import BrandLogo from '@/components/brand/BrandLogo';
import LegalFooter from '@/components/LegalFooter';

export default function FoundingMembers(){
  const [params]=useSearchParams();
  const [email,setEmail]=useState('');
  const [screen,setScreen]=useState('');
  const [interest,setInterest]=useState('both');
  const [marketing,setMarketing]=useState(false);
  const [consent,setConsent]=useState(false);
  const [website,setWebsite]=useState('');
  const [state,setState]=useState({loading:false,success:false,message:'',link:''});
  async function submit(e){
    e.preventDefault();
    if(state.loading)return;
    setState(s=>({...s,loading:true,message:''}));
    try{
      const response=await base44.functions.invoke('joinFoundingWaitlist',{
        email,screen_name:screen,interest,marketing_opt_in:marketing,consent,
        website,ref:params.get('ref')||''
      });
      const data=response?.data||response;
      if(!data?.ok)throw Error(data?.error||'Could not join. Try again.');
      setState({loading:false,success:true,message:data.message||'Thanks for joining!',
        link:data.referral_code?window.location.origin+'/founding-members?ref='+encodeURIComponent(data.referral_code):''});
    }catch(e){
      setState({loading:false,success:false,message:e?.response?.data?.error||e?.message||'Please try again.',link:''});
    }
  }
  const field='mt-2 w-full min-h-12 rounded-xl border border-border bg-background p-3 text-foreground';
  return <div className="ifund-public min-h-dvh bg-background text-foreground">
    <main className="mx-auto max-w-xl px-5 py-10 sm:py-20">
      <div className="mb-8 flex justify-center"><Link to="/" aria-label="InterplanetaryFund home"><BrandLogo size="sm"/></Link></div>
      <section className="rounded-3xl border border-cyan-500/30 bg-card p-5 shadow-xl sm:p-9">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[.2em] text-cyan-500">Founding Members · Early access</p>
        <h1 className="text-center font-display text-3xl font-bold sm:text-4xl">What if you were here from the beginning?</h1>
        <p className="my-5 text-center text-muted-foreground">Be part of the first InterplanetaryFund community. Joining is free. Tell us how you'd like to use IFund, and we'll keep you informed about early access.</p>
        {!state.success?<form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">Your email <input required type="email" autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className={field}/></label>
          <label className="block text-sm font-medium">Screen name (optional) <input autoComplete="nickname" maxLength={50} value={screen} onChange={e=>setScreen(e.target.value)} className={field}/></label>
          <label className="block text-sm font-medium">What would you like to do?<select value={interest} onChange={e=>setInterest(e.target.value)} className={field}><option value="both">Support and fundraise</option><option value="support">Support causes and ideas</option><option value="fundraise">Create a fundraiser</option></select></label>
          <div className="absolute -left-[9999px]" aria-hidden="true"><label>Website <input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label></div>
          <label className="flex items-start gap-3 text-sm text-muted-foreground"><input className="mt-1" type="checkbox" checked={marketing} onChange={e=>setMarketing(e.target.checked)}/><span>Also email me optional news and platform announcements. I can opt out anytime.</span></label>
          <label className="flex items-start gap-3 text-sm text-muted-foreground"><input className="mt-1" type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I agree to IFund storing my signup information for early-access administration. Read the <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>.</span></label>
          <button disabled={state.loading||!consent} type="submit" className="min-h-12 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{state.loading?'Adding you…':'Join the founding community'}</button>
        </form>:<div className="rounded-2xl border border-cyan-400/40 bg-cyan-500/10 p-5 text-center"><h2 className="text-lg font-semibold">Thanks for joining!</h2><p className="mt-2 text-sm">Your request has been received. Check back for updates and invitations.</p></div>}
        {state.message&&<p className="mt-5 text-center text-sm" role="status">{state.message}</p>}
        {state.link&&<div className="mt-6 space-y-3"><p className="text-center text-sm">Invite a friend to discover IFund. Sharing doesn't guarantee priority or acceptance.</p><label className="block text-sm">Your sharing link<input readOnly value={state.link} className={field}/></label><button type="button" onClick={()=>navigator.clipboard?.writeText(state.link)} className="min-h-11 w-full rounded-xl border border-border px-4 py-2 text-sm">Copy sharing link</button></div>}
        <p className="mt-6 text-center text-xs text-muted-foreground">No charge to join. No guaranteed donations, priority, or approval. Existing IFund accounts remain available.</p>
        <p className="mt-3 text-center text-xs"><Link className="underline" to="/help">Need help?</Link></p>
      </section>
      <p className="mt-6 text-center text-sm"><Link className="underline" to="/">Back to home</Link></p>
    </main><LegalFooter/>
  </div>;
}
