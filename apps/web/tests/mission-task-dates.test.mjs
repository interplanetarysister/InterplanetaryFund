import test from "node:test";
import assert from "node:assert/strict";
import { localTaskDateToIso, taskDateInputValue, validateTaskDueAt } from "../src/lib/missionTaskDates.mjs";
test("empty input clears a deadline",()=>{assert.equal(localTaskDateToIso(""),null);assert.equal(validateTaskDueAt(null),null);assert.equal(taskDateInputValue(null),"");});
test("valid browser-local date round trips to a canonical UTC instant",()=>{const local="2026-12-15T14:35";const utc=localTaskDateToIso(local);assert.equal(taskDateInputValue(utc),local);assert.equal(validateTaskDueAt(utc),utc);});
test("invalid local inputs are rejected rather than normalized",()=>{for(const input of ["2026-02-30T10:00","2026-13-01T10:00","2026-01-01T25:00","2026-11-01","not a date"])assert.throws(()=>localTaskDateToIso(input));});
test("deadline API accepts only canonical UTC timestamps or explicit null",()=>{for(const value of ["2026-02-30T00:00:00.000Z","2026-11-01","2026-12-01T08:00:00+01:00",undefined,0])assert.throws(()=>validateTaskDueAt(value));});
