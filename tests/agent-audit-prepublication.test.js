import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../supabase/migrations/20261113_ifund_prepublication_quality_and_agent_review.sql",import.meta.url),"utf8");
const publicationGate = migration.split("-- Suggestions are private owner-scoped")[0];

test("prepublication gate blocks new short stories and grandfathers active campaigns",async t=>{
 const db = new PGlite();
 t.after(()=>db.close());
 await db.exec("create table public.ifund_campaigns (id integer primary key,status text,story text);");
 await db.exec("insert into public.ifund_campaigns values (1,'active','Preexisting short story'),(2,'draft','Draft short story');");
 await db.exec(publicationGate);
 // Historical active campaigns retain edit capability without being unpublished.
 await db.query("update public.ifund_campaigns set story='Edited legacy campaign' where id=1");
 assert.equal((await db.query("select status from public.ifund_campaigns where id=1")).rows[0].status,"active");
 await assert.rejects(db.query("update public.ifund_campaigns set status='active' where id=2"),/full-length story/);
 await assert.rejects(db.query("insert into public.ifund_campaigns values(3,'active','Short')"),/full-length story/);
 await db.query("update public.ifund_campaigns set story=$1 where id=2",["A".repeat(3500)]);
 await db.query("update public.ifund_campaigns set status='active' where id=2");
 assert.equal((await db.query("select status from public.ifund_campaigns where id=2")).rows[0].status,"active");
 await db.query("update public.ifund_campaigns set status='paused',story='Short again' where id=2");
 await assert.rejects(db.query("update public.ifund_campaigns set status='active' where id=2"),/full-length story/);
});
