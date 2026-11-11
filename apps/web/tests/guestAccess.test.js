import test from "node:test";
import assert from "node:assert/strict";
import { guestIdentity, memberIdentity, payoutIdentity, enterGuestMode, hasGuestNotice } from "../src/lib/guestAccess.js";
function store() {const d=new Map();return {getItem:k=>d.get(k)||null,setItem:(k,v)=>d.set(k,v)};}
const anon={id:"1",is_anonymous:true,email_confirmed_at:null};
const full={id:"2",is_anonymous:false,email_confirmed_at:"2026-11-10"};
test("anonymous identity may browse but cannot become an email content creator or withdraw",()=>{
  assert.equal(memberIdentity(anon),false);
  assert.equal(payoutIdentity(anon),false);
  assert.equal(payoutIdentity(full),true);
  assert.equal(memberIdentity({id:"3",email_confirmed_at:null}),false);
});
test("anonymous signup saves agreement before account-mode success",async()=>{
 const s=store();let recorded=false;
 const auth={getUser:async()=>({data:{user:null},error:null}),signInAnonymously:async()=>({data:{user:anon,session:{access_token:"jwt"}},error:null})};
 const result=await enterGuestMode({auth,client:{},store:s,version:"v4",record:async(_db,user)=>{assert.equal(user.id,anon.id);recorded=true;}});
 assert.deepEqual({mode:result.mode,recorded}, {mode:"account",recorded:true});
 assert.equal(hasGuestNotice(s,"v4"),false);
});
test("disabled anonymous signup still opens browser-only draft without fabricating a cloud account",async()=>{
 const s=store();const auth={getUser:async()=>({data:{user:null},error:null}),signInAnonymously:async()=>({error:{message:"Anonymous sign-ins are disabled"}})};
 const result=await enterGuestMode({auth,client:{},store:s,version:"v4",record:async()=>{throw Error("not called")}});
 assert.equal(result.mode,"local");
 assert.equal(hasGuestNotice(s,"v4"),true);
});
test("unconfirmed email identity is not treated as verified or replaced by anonymous account",async()=>{
 const s=store();let called=false;const auth={getUser:async()=>({data:{user:{id:"9",email_confirmed_at:null}},error:null}),signInAnonymously:async()=>{called=true}};
 const result=await enterGuestMode({auth,client:{},store:s,version:"v4",record:async()=>{throw Error("not called")}});
 assert.equal(result.mode,"local");assert.equal(called,false);
});
test("failed consent receipt after successful anonymous auth is not a silent success",async()=>{
 const s=store();const auth={getUser:async()=>({data:{user:anon},error:null}),signInAnonymously:async()=>({data:{user:anon,session:{access_token:"jwt"}},error:null})};
 await assert.rejects(enterGuestMode({auth,client:{},store:s,version:"v4",record:async()=>{throw Error("denied")}}));
 assert.equal(hasGuestNotice(s,"v4"),false);
});

test("first-visit AuthSessionMissingError uses the no-login guest path",async()=>{
  const s=store();const auth={getUser:async()=>({data:{user:null},error:{name:"AuthSessionMissingError",message:"Auth session missing!"}}),signInAnonymously:async()=>({error:{message:"Anonymous sign-ins are disabled"}})};
  const result=await enterGuestMode({auth,client:{},store:s,version:"v4",record:async()=>{throw Error("not called")}});
  assert.equal(result.mode,"local");assert.equal(hasGuestNotice(s,"v4"),true);
});
