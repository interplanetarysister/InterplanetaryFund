import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const editor=readFileSync(new URL("../src/pages/CreateCampaign.jsx",import.meta.url),"utf8");
const storage=readFileSync(new URL("../src/lib/browserCampaignDraft.js",import.meta.url),"utf8");

test("guest copy cleanup requires explicit owner click and truthful feedback",()=>{
 assert.match(editor,/function retryGuestCopyCleanup\(\)/);
 assert.match(editor,/onClick=\{retryGuestCopyCleanup\}/);
 assert.match(editor,/guestCopyRetained && <button/);
 assert.match(editor,/if \(!ownerId \|\| ownerTransitionPending \|\| disabled\) return/);
 assert.match(editor,/The owner draft or guest draft has changed since import/);
 assert.match(editor,/Private information may remain accessible to another guest/);
});

test("import implementation fails closed on silent storage writes and deletion",()=>{
 assert.match(storage,/storage\.getItem\(destination\) !== expected/);
 assert.match(storage,/storage\.getItem\(guest\.source\) !== null/);
 assert.match(storage,/existing && existing !== expected/);
 assert.match(storage,/status: "imported_guest_retained"/);
});
