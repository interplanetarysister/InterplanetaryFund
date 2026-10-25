import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const json = (path) => JSON.parse(read(path));
const pub = json("base44/entities/HelpArticle.jsonc");
const draft = json("base44/entities/HelpDraft.jsonc");
const feedback = json("base44/entities/HelpFeedback.jsonc");
const app = read("src/App.jsx");
const help = read("src/pages/Help.jsx");
const detail = read("src/pages/HelpArticle.jsx");
const editor = read("src/pages/HelpAdmin.jsx");
const layout = read("src/components/Layout.jsx");
const consent = read("src/components/TermsAcceptance.jsx");

assert.deepEqual(pub.rls.read, {}, "Published articles must remain publicly readable.");
for (const action of ["create", "update", "delete"]) {
  assert.equal(pub.rls[action]?.user_condition?.role, "admin", "Public articles must be admin-managed.");
}
for (const action of ["create", "read", "update", "delete"]) {
  assert.equal(draft.rls[action]?.user_condition?.role, "admin", "Drafts must be private to administrators.");
}
assert.equal(feedback.rls.create["data.user_id"], "{{user.id}}");
assert.match(app, /path="\/help" element=\{<Help/);
assert.match(app, /path="\/help\/:slug" element=\{<HelpArticle/);
assert.match(app, /path="\/admin\/help" element=\{<HelpAdmin/);
assert.match(help, /base44\.entities\.HelpArticle\.list/);
assert.doesNotMatch(help, /base44\.entities\.HelpDraft/);
assert.match(detail, /base44\.entities\.HelpArticle\.filter/);
assert.match(detail, /base44\.entities\.HelpFeedback\.create/);
assert.match(editor, /base44\.entities\.HelpDraft\.create/);
assert.match(editor, /base44\.entities\.HelpArticle\.create/);
assert.match(editor, /!form\.answer\.trim\(\)/);
assert.match(layout, /helpPathForLocation\(pathname\)/);
assert.match(consent, /useLocation/);
assert.match(consent, /pathname\.startsWith\("\/help\/"\)/);
assert.match(help, /createSupportTicket/);
console.log("PASS: Public help, private drafts, admin publishing, contextual links, feedback and support wiring.");
