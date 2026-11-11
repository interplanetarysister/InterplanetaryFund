import test from "node:test";
import assert from "node:assert/strict";
import { STEPS, FLOWS, blankRecord, parseLinks, validateRecord, readiness, makeReport } from "../src/lib/hackathonTracker.mjs";
test("every guided gate has a unique ID and known flow", () => {
  assert.equal(new Set(STEPS.map(s=>s.key)).size, STEPS.length);
  for (const s of STEPS) assert.ok(FLOWS.some(f=>f.id===s.flow));
});
test("unknown remains unknown; report does not infer verified checkout", () => {
  const stats=readiness({});
  assert.equal(stats.counts.unknown, STEPS.length);
  assert.equal(stats.reviewed,false);
  assert.match(makeReport({}), /NOT READY/);
});
test("completed step requires evidence and a test result", () => {
  const row={...blankRecord("capture-v2"),status:"completed"};
  assert.match(validateRecord(row),/require/);
  assert.equal(validateRecord({...row,evidence_links:["https://example.com/a"],test_result:"Provider receipt checked"}),"");
});
test("only HTTPS links, no duplicates or javascript",()=>{
  assert.deepEqual(parseLinks("https://example.com/a\nhttps://example.com/a"),["https://example.com/a"]);
  assert.throws(()=>parseLinks("javascript:alert(1)"),/HTTPS/);
  assert.throws(()=>parseLinks("http://localhost:3000"),/HTTPS/);
});
test("blocked check retains its blocker and next action in report",()=>{
  const x={...blankRecord("webhook-signature"),status:"blocked",blocker:"No signed event",next_action:"Run sandbox delivery test"};
  const report=makeReport({"webhook-signature":x});
  assert.match(report,/No signed event/);assert.match(report,/Run sandbox delivery test/);
});
