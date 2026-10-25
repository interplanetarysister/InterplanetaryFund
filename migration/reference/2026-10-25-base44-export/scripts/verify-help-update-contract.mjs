import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const contract = JSON.parse(fs.readFileSync("docs/HELP_UPDATE_CONTRACT.json","utf8"));
const guides = fs.readFileSync("src/lib/connectionHelpGuides.js","utf8");
const page = fs.readFileSync("src/pages/Help.jsx","utf8");
const detail = fs.readFileSync("src/pages/HelpArticle.jsx","utf8");
assert.match(page,/CONNECTION_HELP_GUIDES/, "Help index must show built-in guides");
assert.match(detail,/connectionHelpGuide/, "Help articles must resolve built-in guides");
for(const workflow of contract.workflows) {
  assert(guides.includes('slug: "' + workflow.help_slug + '"'),
    'Missing Help article for workflow: ' + workflow.workflow);
  for(const [path,old] of Object.entries(workflow.tracked_files)) {
    const actual=crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
    assert.equal(actual, old,
      "The process changed for "+workflow.workflow+". Update Help article and refresh reviewed hash: "+path);
  }
}
console.log("PASS: connection, permissions, password and verification workflows have reviewed Help instructions.");
