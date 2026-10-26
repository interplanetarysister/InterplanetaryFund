import { readFileSync } from "node:fs";
const file = new URL("../docs/migration/role-platform-evidence.json", import.meta.url);
const data = JSON.parse(readFileSync(file, "utf8"));
const requiredRoleNames = ["visitor","member","admin","super_admin"];
const errors = [];
if (data.pages.length !== 58 || new Set(data.pages.map((p)=>p.path)).size !== 58) {
  errors.push("Expected 58 distinct original IFund routes.");
}
for (const page of data.pages) {
  if (page.release_status !== "verified") {
    errors.push(page.path + ": not verified for release");
    continue;
  }
  for (const screen of data.required_screens) {
    if (!page.proof?.visual?.[screen]) errors.push(page.path + ": missing "+screen+" visual evidence");
  }
  for (const role of requiredRoleNames) {
    if (!page.proof?.role_matrix?.[role]) errors.push(page.path + ": missing role evidence "+role);
  }
  for (const field of ["functional","persistence","source_assets","reviewer_approval"]) {
    if (!page.proof?.[field]) errors.push(page.path + ": missing "+field+" proof");
  }
}
const verified = data.pages.filter(x=>x.release_status==="verified").length;
console.log("IFund parity: " + verified + "/58 verified, " + errors.length + " missing checks.");
if (process.argv.includes("--summary")) {
  console.log(data.pages.filter(x=>x.release_status!=="verified").map(x=>x.path).join("\n"));
} else if (errors.length) {
  console.error(errors.slice(0,75).join("\n"));
  process.exitCode = 1;
}
