import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";
const owner="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222",campaign="33333333-3333-4333-8333-333333333333",id="44444444-4444-4444-8444-444444444444";
const path=owner+"/"+campaign+"/"+id+".pdf";
async function fixture(){
 const db=new PGlite();
 await db.exec(`
  create role anon;create role authenticated;create schema auth;create schema storage;
  grant usage on schema auth,storage to anon,authenticated;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('sub',current_setting('request.jwt.claim.sub',true),'is_anonymous',false) $$;
  create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
  create table public.ifund_profiles(id uuid primary key,account_status text,account_deletion_pending boolean);
  create table public.ifund_campaigns(id uuid primary key,owner_id uuid);
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(
    id uuid primary key default gen_random_uuid(),bucket_id text,name text,
    metadata jsonb not null default '{"size":1000}'::jsonb
  );
  alter table storage.objects enable row level security;
  grant select,insert,delete on storage.objects to authenticated;
  create function storage.foldername(path text) returns text[] language sql immutable as $$
    select (string_to_array(path,'/'))[1:(array_length(string_to_array(path,'/'),1)-1)] $$;
 `);
 await db.exec(readFileSync(new URL("../supabase/migrations/20261115095000_ifund_campaign_private_documents.sql",import.meta.url),"utf8"));
 await db.query("insert into auth.users values($1,now()),($2,now())",[owner,other]);
 await db.query("insert into public.ifund_profiles values($1,'active',false),($2,'active',false)",[owner,other]);
 await db.query("insert into public.ifund_campaigns values($1,$2)",[campaign,owner]);
 return db;
}
async function as(db,uid,role="authenticated"){
 await db.exec("reset role");
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid||""]);
 await db.exec("set role "+role);
}
async function insert(db){
 const count=await db.query("select count(*)::int n from storage.objects where bucket_id='ifund-campaign-documents' and name=$1",[path]);
 if(count.rows[0].n===0)await db.query("insert into storage.objects(bucket_id,name) values('ifund-campaign-documents',$1)",[path]);
 return db.query(`insert into public.ifund_campaign_documents
  (id,owner_id,campaign_id,storage_path,file_name,media_type,file_size,agent_summary)
  values($1,$2,$3,$4,'budget.pdf','application/pdf',1000,'Owner-reviewed campaign budget and intended uses')`,[id,owner,campaign,path]);
}
test("owner can attach and select private files, other user cannot",async()=>{
 const db=await fixture();try{
  await as(db,owner);await insert(db);
  assert.equal((await db.query("select count(*)::int n from public.ifund_campaign_documents")).rows[0].n,1);
  await as(db,other);
  assert.equal((await db.query("select count(*)::int n from public.ifund_campaign_documents")).rows[0].n,0);
  await assert.rejects(insert(db),/row-level security|permission denied/);
  await as(db,null,"anon");
  await assert.rejects(db.query("select * from public.ifund_campaign_documents"),/permission denied/);
 }finally{await db.close();}
});
test("opt-in summaries are hidden until allowed, then hidden when revoked",async()=>{
 const db=await fixture();try{
  await as(db,owner);await insert(db);
  let result=await db.query("select public.ifund_campaign_agent_document_briefs($1) b",[campaign]);
  assert.deepEqual(result.rows[0].b,[]);
  await db.query("update public.ifund_campaign_documents set allow_agent_use=true,owner_excerpt=$2 where id=$1",[id,"Organizer-provided estimate of $2,900 in equipment costs."]);
  result=await db.query("select public.ifund_campaign_agent_document_briefs($1) b",[campaign]);
  assert.equal(result.rows[0].b.length,1);
  assert.match(result.rows[0].b[0].owner_excerpt,/2,900/);
  await db.query("update public.ifund_campaign_documents set allow_agent_use=false where id=$1",[id]);
  result=await db.query("select public.ifund_campaign_agent_document_briefs($1) b",[campaign]);
  assert.deepEqual(result.rows[0].b,[]);
 }finally{await db.close();}
});
test("owner-scoped storage policies and orphan prevention",async()=>{
 const db=await fixture();try{
  await as(db,other);
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('ifund-campaign-documents',$1)",[path]),/row-level security/);
  await as(db,owner);
  // The verified owner may read the pending upload to clean up a failed
  // metadata write. Another user cannot list or remove that private object.
  await db.query("insert into storage.objects(bucket_id,name) values('ifund-campaign-documents',$1)",[path]);
  assert.equal((await db.query("select count(*)::int n from storage.objects")).rows[0].n,1);
  await as(db,other);
  assert.equal((await db.query("select count(*)::int n from storage.objects")).rows[0].n,0);
  await as(db,owner);
  await db.query(`insert into public.ifund_campaign_documents
    (id,owner_id,campaign_id,storage_path,file_name,media_type,file_size,agent_summary)
    values($1,$2,$3,$4,'budget.pdf','application/pdf',1000,
    'Owner-reviewed budget and intended cost breakdown')`,[id,owner,campaign,path]);
  assert.equal((await db.query("select count(*)::int n from storage.objects")).rows[0].n,1);
  await db.exec("reset role");
  await assert.rejects(db.query("delete from public.ifund_campaigns where id=$1",[campaign]),/Remove private campaign documents/);
 }finally{await db.close();}
});

test("metadata size must match finalized private Storage object",async()=>{
  const db=await fixture();
  try{
    await as(db,owner);
    await db.query("insert into storage.objects(bucket_id,name,metadata) values('ifund-campaign-documents',$1,$2)",[
      path,{size:3400}
    ]);
    await assert.rejects(db.query(`insert into public.ifund_campaign_documents
      (id,owner_id,campaign_id,storage_path,file_name,media_type,file_size)
      values($1,$2,$3,$4,'budget.pdf','application/pdf',1)`,[id,owner,campaign,path]),/Verified private upload size is required/);
    const count=await db.query("select count(*)::int n from public.ifund_campaign_documents");
    assert.equal(count.rows[0].n,0);
  }finally{await db.close();}
});

test("owner deletion intent immediately revokes agent excerpts and is irreversible",async()=>{
 const db=await fixture();
 try {
  await as(db,owner);
  await insert(db);
  await db.query("update public.ifund_campaign_documents set allow_agent_use=true where id=$1",[id]);
  assert.equal((await db.query("select jsonb_array_length(public.ifund_campaign_agent_document_briefs($1)) n",[campaign])).rows[0].n,1);
  const marked=await db.query("update public.ifund_campaign_documents set allow_agent_use=false,deletion_requested_at=now() where id=$1 returning deletion_requested_at",[id]);
  assert.ok(marked.rows[0].deletion_requested_at);
  assert.equal((await db.query("select jsonb_array_length(public.ifund_campaign_agent_document_briefs($1)) n",[campaign])).rows[0].n,0);
  await assert.rejects(db.query("update public.ifund_campaign_documents set deletion_requested_at=null,allow_agent_use=true where id=$1",[id]),/Document deletion already requested|check constraint/);
  await as(db,other);
  assert.equal((await db.query("select count(*)::int n from public.ifund_campaign_documents")).rows[0].n,0);
 } finally {await db.close();}
});
test("owner may finish metadata erasure only after moving document into pending deletion",async()=>{
 const db=await fixture();
 try {
  await as(db,owner);await insert(db);
  await db.query("update public.ifund_campaign_documents set allow_agent_use=false,deletion_requested_at=now() where id=$1",[id]);
  await db.query("delete from storage.objects where name=$1",[path]);
  const removed=await db.query("delete from public.ifund_campaign_documents where id=$1 returning id",[id]);
  assert.equal(removed.rows[0].id,id);
  assert.equal((await db.query("select count(*)::int n from public.ifund_campaign_documents")).rows[0].n,0);
 } finally {await db.close();}
});

test("orphaned private Storage bytes prevent campaign deletion without metadata",async()=>{
 const db=await fixture();
 try {
  await as(db,owner);
  await db.query("insert into storage.objects(bucket_id,name,metadata) values('ifund-campaign-documents',$1,$2)",[path,{size:1000}]);
  await db.exec("reset role");
  await assert.rejects(
    db.query("delete from public.ifund_campaigns where id=$1",[campaign]),
    /Remove private campaign documents/
  );
  assert.equal((await db.query("select count(*)::int n from public.ifund_campaigns where id=$1",[campaign])).rows[0].n,1);
 } finally {await db.close();}
});

test("metadata deletion fails closed until the private Storage object is erased",async()=>{
 const db=await fixture();
 try {
  await as(db,owner);
  await insert(db);
  await db.query("update public.ifund_campaign_documents set allow_agent_use=false,deletion_requested_at=now() where id=$1",[id]);
  await assert.rejects(
    db.query("delete from public.ifund_campaign_documents where id=$1",[id]),
    /Remove private Storage object before document metadata/
  );
  assert.equal((await db.query("select count(*)::int n from public.ifund_campaign_documents where id=$1",[id])).rows[0].n,1);
  await as(db,other);
  // PostgreSQL RLS hides the other owner's row from DELETE. A successful
  // statement affecting zero rows is a denial, not an authorization bypass.
  const denied=await db.query("delete from storage.objects where name=$1 returning id",[path]);
  assert.equal(denied.rows.length,0);
  await as(db,owner);
  assert.equal((await db.query("select count(*)::int n from storage.objects where name=$1",[path])).rows[0].n,1);
  await db.query("delete from storage.objects where name=$1",[path]);
  assert.equal((await db.query("delete from public.ifund_campaign_documents where id=$1 returning id",[id])).rows[0].id,id);
 } finally { await db.close(); }
});
