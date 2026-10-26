import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("administrator UI uses server-authoritative provider verification endpoint",()=>{
  const ui=readFileSync(new URL("../src/pages/Automations.jsx",import.meta.url),"utf8");
  const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
  assert.ok(ui.includes('user?.app_metadata?.role === "admin"'));
  assert.ok(ui.includes('user?.app_metadata?.role === "super_admin"'));
  assert.ok(ui.includes('db?.auth?.getSession()'));
  assert.ok(ui.includes('"/api/admin/integrations/health"'));
  assert.ok(ui.includes('active_financial_operations !== false'));
  assert.ok(app.includes("<Automations user={user} />"));
  assert.ok(!ui.includes("SUPABASE_SECRET_KEY"));
  assert.ok(!ui.includes("PAYPAL_CLIENT_SECRET"));
});
