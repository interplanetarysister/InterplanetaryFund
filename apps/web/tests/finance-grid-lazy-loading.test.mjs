import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatUsdCents } from "../src/lib/formatUsdCents.mjs";

const read = path => readFileSync(new URL(path,import.meta.url),"utf8");

test("public Atlas and private finance pages load the large AG Grid bundle on demand",()=>{
  for(const path of ["../src/pages/Atlas.jsx","../src/pages/FinanceDashboard.jsx","../src/pages/AdminFinance.jsx"]){
    const source=read(path);
    assert.match(source,/lazy\(\(\) => import\("@\/components\/finance\/FinanceDataGrid"\)\)/,path);
    assert.match(source,/<Suspense fallback=\{<p role="status"/,path);
    assert.doesNotMatch(source,/^import FinanceDataGrid/m,path);
  }
  assert.match(read("../src/pages/FinanceDashboard.jsx"),/from "@\/lib\/formatUsdCents\.mjs"/);
  assert.match(read("../src/pages/AdminFinance.jsx"),/from "@\/lib\/formatUsdCents\.mjs"/);
  assert.match(read("../src/components/agents/OwnerRefundTrends.jsx"),/from "@\/lib\/formatUsdCents\.mjs"/);
});

test("verified currency formatter stays independent of visualization libraries",()=>{
  const source=read("../src/lib/formatUsdCents.mjs");
  assert.doesNotMatch(source,/ag-grid|react|document\.|window\./i);
  assert.equal(formatUsdCents(null),"Not reported");
  assert.equal(formatUsdCents(false),"Not reported");
  assert.equal(formatUsdCents("1e2"),"Not reported");
  assert.equal(formatUsdCents(0),"$0.00");
  assert.equal(formatUsdCents(101),"$1.01");
});
