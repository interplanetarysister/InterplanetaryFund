import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const read = path => readFileSync(new URL(path,import.meta.url),"utf8");
const initial = read("../supabase/migrations/20261113_ifund_prepublication_quality_and_agent_review.sql")
  .split("-- Suggestions are private owner-scoped")[0];
const updated = read("../supabase/migrations/20261113_ifund_prepublication_whitespace_alignment.sql");
const review = read("../supabase/migrations/20261113_ifund_editorial_campaignwide_discussions.sql");

test("revised server publication gate rejects whitespace-only padding on new publication",async t=>{
 const db=new PGlite();
 t.after(()=>db.close());
 await db.exec("create table public.ifund_campaigns(id integer primary key,status text,story text);");
 await db.exec("insert into public.ifund_campaigns values(1,'active','Legacy'),(2,'draft','Short');");
 await db.exec(initial);
 await db.exec(updated);
 await assert.rejects(
   db.query("update public.ifund_campaigns set story=$1,status='active' where id=2",
     ["A".repeat(3499)+"\n\n\t\r"]),
   /full-length story/
 );
 await db.query("update public.ifund_campaigns set story=$1,status='active' where id=2",
   ["A".repeat(3500)+"\n\t"]);
 assert.equal((await db.query("select status from public.ifund_campaigns where id=2")).rows[0].status,"active");
 await db.query("update public.ifund_campaigns set story='Edited legacy short story' where id=1");
 assert.equal((await db.query("select status from public.ifund_campaigns where id=1")).rows[0].status,"active");
});

test("private editorial queue protects ownership and records real owner feedback separately from rule prompts",()=>{
 for(const fragment of [
  "ifund_current_account_is_active()",
  "u.is_anonymous is false",
  "u.email_confirmed_at is not null",
  "r.id=p_review_id and r.owner_id=v_owner for update",
  "rule_based_next_step",
  "owner_comment",
  "grant execute on function public.ifund_add_editorial_review_comment(uuid,text) to authenticated"
 ]) assert.ok(review.includes(fragment),fragment);
 assert.ok(!review.includes("grant select on public.ifund_editorial_agent_reviews to anon"));
 assert.ok(review.includes("review_status='owner_action_needed'"));
});
