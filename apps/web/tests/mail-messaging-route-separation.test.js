import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = relative => readFileSync(new URL("../"+(relative.startsWith("apps/web/") ? relative.slice(9) : relative),import.meta.url),"utf8");

test("Mail and Messaging are separate authenticated routes with the legacy Inbox route preserved",()=>{
 const app=read("apps/web/src/App.jsx");
 assert.match(app,/path="\/mail" element=\{<MemberAccess><Inbox\s*\/><\/MemberAccess>\}/);
 assert.match(app,/path="\/messaging" element=\{<MemberAccess><Messaging\s*\/><\/MemberAccess>\}/);
 assert.match(app,/path="\/inbox" element=\{<MemberAccess><Inbox\s*\/><\/MemberAccess>\}/);
 // Sprint 6 (2026-11-25): /communications folds into the tabbed Agents page;
 // the legacy route stays a MemberAccess-guarded redirect, so ECHO outreach
 // remains a separate destination from Mail and agent Messaging.
 assert.match(app,/path="\/communications" element=\{<MemberAccess><LegacyAgentsRedirect tab="communications" \/><\/MemberAccess>\}/);
});
test("navigation distinguishes Mail, agent Messaging and campaign outreach",()=>{
 const source=read("apps/web/src/components/Layout.jsx");
 assert.match(source,/to: "\/mail", label: "Mail", icon: MailOpen/);
 assert.match(source,/to: "\/messaging", label: "Messaging", icon: MessageSquare/);
 assert.match(source,/to: "\/communications", label: "ECHO Outreach"/);
 assert.doesNotMatch(source,/to: "\/inbox", label: "Inbox"/);
});
test("Mail is owner-scoped and does not accidentally expose the admin agent room",()=>{
 const page=read("apps/web/src/pages/Inbox.jsx");
 const service=read("apps/web/src/lib/inbox.js");
 assert.match(page,/>Mail<\/h1>/);
 assert.match(page,/to="\/messaging"/);
 assert.doesNotMatch(page,/AgentOperationsRoom/);
 assert.match(service,/\.eq\("owner_id", owner\)/);
});
test("Messaging uses real existing agent icons and separate guarded operations room",()=>{
 const page=read("apps/web/src/pages/Messaging.jsx");
 const room=read("apps/web/src/components/agents/AgentOperationsRoom.jsx");
 assert.match(page,/AgentIdentityIcon identity=\{id\}/);
 assert.match(page,/AgentOperationsRoom key=\{user.id\} user=\{user\}/);
 assert.match(page,/window.dispatchEvent\(new CustomEvent\("ifund-open-agent"/);
 assert.match(page,/to="\/mail"/);
 assert.match(room,/ifund_current_user_is_verified_admin/);
 assert.match(room,/ifund_agent_operations_messages/);
 assert.doesNotMatch(page,/ifund_inbox_items/);
});
test("Messaging actions use readable iFund wording and touch-sized links",()=>{
 const page=read("apps/web/src/pages/Messaging.jsx");
 assert.match(page,/Talk with your iFund agents/);
 assert.match(page,/inline-flex min-h-11 items-center font-semibold text-cyan-500 underline/);
 assert.match(page,/text-sm text-muted-foreground/);
 assert.doesNotMatch(page,/Talk with your IFund agents/);
});
