import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const migration=read("../../../supabase/migrations/20261113_ifund_explicit_marketing_consent.sql");
const page=read("../src/pages/MarketingPreferences.jsx");
const profile=read("../src/pages/Profile.jsx");
const app=read("../src/App.jsx");
test("marketing permissions require explicit independent opt-in",()=>{
  assert.match(migration,/outreach_opt_in boolean not null default false/);
  assert.match(migration,/No migration converts existing email_updates=true into marketing consent/);
  assert.match(migration,/auth\.uid\(\)/);
  assert.match(migration,/ifund_current_account_is_active\(\)/);
  assert.match(migration,/p_opt_in is null then raise exception/);
  assert.match(migration,/if p_opt_in is null then/);
  assert.match(migration,/revoke all on public\.ifund_marketing_consent from public,anon,authenticated/);
  assert.match(migration,/revoke all on function public\.ifund_set_marketing_consent\(boolean\) from public,anon/);
  assert.doesNotMatch(migration,/update public\.ifund_profiles[\s\S]*comm_prefs/);
});
test("owner controls are gated and cannot silently submit consent",()=>{
  assert.match(app,/path="\/preferences" element=\{<MemberAccess><MarketingPreferences \/><\/MemberAccess>\}/);
  assert.match(page,/rpc\("ifund_my_marketing_consent"\)/);
  assert.match(page,/rpc\("ifund_set_marketing_consent"/);
  assert.match(page,/disabled=\{busy\|\|state\.optIn===state\.original\}/);
  assert.match(page,/No marketing permission is inferred from existing notification settings/);
  assert.match(profile,/Communication preferences/);
});
