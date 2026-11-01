import fs from "node:fs";

const files = ["src/pages/Login.jsx", "src/pages/Register.jsx", "src/pages/ResetPassword.jsx"];
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  if (/setError\([^\n]*(?:err|error|e)\.message/.test(src)) {
    throw new Error(`${file}: raw auth error reaches UI`);
  }
  if (!src.includes("safeAuthErrorMessage")) {
    throw new Error(`${file}: safe auth boundary missing`);
  }
}
const helper = fs.readFileSync("src/lib/safe-auth-error.js", "utf8");
if (/\.message|String\s*\(/.test(helper)) {
  throw new Error("safe auth helper must not inspect raw exceptions");
}
console.log("Auth-page safe diagnostics contract passed.");
