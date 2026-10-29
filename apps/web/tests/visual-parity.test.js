import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path,import.meta.url),"utf8");
test("original Interplanetary Fund visual identity is retained",()=>{
 const home=read("../src/pages/Home.jsx");
 const layout=read("../src/components/Layout.jsx");
 const css=read("../src/index.css");
 assert.match(home,/BrandLogo/);
 assert.match(home,/LegalFooter/);
 assert.match(layout,/MobileBottomNav/);
 assert.match(layout,/BrandLogo/);
 assert.match(css,/styles-ifund-studio\.css/);
 assert.match(css,/Fraunces/);
});
test("original home and navigation remain in the independent app",()=>{
 const app=read("../src/App.jsx");
 assert.match(app,/pages\/Home/);
 assert.match(app,/components\/Layout/);
});
