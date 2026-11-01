import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CURRENT_TERMS_VERSION } from "../worker/legalConsent.js";

const sql = readFileSync(new URL("../supabase/migrations/pending/20261101_ifund_campaign_terms_rls.sql", import.meta.url), "utf8");
test("unapplied migration replaces all three permissive campaign write policies", () => {
  for (const [name, verb] of [
    ["ifund_campaigns_insert", "INSERT"],
    ["ifund_campaigns_update", "UPDATE"],
    ["ifund_campaigns_delete", "DELETE"],
  ]) {
    assert.match(sql, new RegExp("DROP POLICY IF EXISTS " + name + " ON public\\.ifund_campaigns", "i"));
    assert.match(sql, new RegExp("CREATE POLICY " + name + " ON public\\.ifund_campaigns\\s+FOR " + verb + " TO authenticated", "i"));
  }
  assert.match(sql, /ALTER|CREATE POLICY/i);
  assert.doesNotMatch(sql, /GRANT\s+(?:ALL|INSERT|UPDATE|DELETE).*service_role/i);
});
test("every campaign write predicate checks owner, lifecycle and current explicit Terms", () => {
  const policies = sql.split(/CREATE POLICY ifund_campaigns_(?:insert|update|delete) ON public\.ifund_campaigns/i).slice(1);
  assert.equal(policies.length, 3);
  for (const policy of policies) {
    assert.match(policy, /owner_id = \(SELECT auth\.uid\(\)\)/);
    assert.match(policy, /ifund_current_account_is_active\(\)/);
    assert.match(policy, /FROM public\.ifund_legal_acceptances a/);
    assert.match(policy, /a\.explicit_consent IS TRUE/);
    assert.ok(policy.includes("a.terms_version = '" + CURRENT_TERMS_VERSION + "'"));
  }
  assert.match(policies[2], /status = 'draft'/);
  assert.match(policies[1], /WITH CHECK/);
});

test("preflight fails closed on extra permissive write policies and unprotected acceptance rows", () => {
  assert.match(sql, /c\.relname='ifund_legal_acceptances' AND c\.relrowsecurity/);
  assert.match(sql, /FROM pg_policies p/);
  assert.match(sql, /p\.schemaname='public'/);
  assert.match(sql, /p\.tablename='ifund_campaigns'/);
  assert.match(sql, /p\.permissive='PERMISSIVE'/);
  assert.match(sql, /p\.cmd IN \('ALL', 'INSERT', 'UPDATE', 'DELETE'\)/);
  assert.match(sql, /p\.policyname NOT IN/);
  assert.match(sql, /RAISE EXCEPTION 'Unexpected permissive campaign write policy/);
  assert.match(sql, /RAISE EXCEPTION 'Legal acceptance RLS must be enabled/);
});
