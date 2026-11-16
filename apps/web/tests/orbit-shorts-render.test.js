import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { videoFromUrl } from "../src/lib/videoLinks.js";
const root=fileURLToPath(new URL("../",import.meta.url));
let components;
test.before(async()=>{
 const cache=path.join(root,"node_modules/.cache");mkdirSync(cache,{recursive:true});
 const output=path.join(mkdtempSync(path.join(cache,"ifund-shorts-")),"render.mjs");
 await build({entryPoints:[path.join(root,"src/pages/OrbitShorts.jsx")],outfile:output,bundle:true,format:"esm",jsx:"automatic",platform:"browser",alias:{"@":path.join(root,"src")},external:["react","react-dom","react/jsx-runtime","react-router","react-router-dom"],define:{"import.meta.env":"{}"},logLevel:"silent"});
 components=await import(pathToFileURL(output).href);
});
const render=element=>renderToStaticMarkup(createElement(MemoryRouter,null,element));
const item={id:"campaign-public",title:"Public <campaign>",description:"A public story",href:"/campaign/11111111-1111-4111-8111-111111111111",kind:"Campaign",video:videoFromUrl("https://youtu.be/dQw4w9WgXcQ")};
test("public short card requires explicit player choice and provides accessible alternatives",()=>{
 const html=render(createElement(components.ShortsCard,{item,index:0,count:2,onMove(){}}));
 assert.match(html,/Load YouTube video/);assert.match(html,/Nothing plays until/);
 assert.doesNotMatch(html,/<iframe|<video|autoplay=/i);
 assert.match(html,/aria-roledescription="video carousel"/);
 assert.match(html,/Public &lt;campaign&gt;/);
 assert.match(html,/disabled=""[^>]*>Previous/);
 assert.match(html,/Full campaign story/);assert.match(html,/Open on YouTube/);
 assert.match(html,/rel="noopener noreferrer"/);assert.match(html,/referrerPolicy="no-referrer"/i);
});
test("last short disables next without hiding the original public post",()=>{
 const post={...item,id:"post-public",kind:"Community",href:"/social/post/archive-public-1"};
 const html=render(createElement(components.ShortsCard,{item:post,index:1,count:2,onMove(){}}));
 assert.match(html,/disabled=""[^>]*>Next/);assert.match(html,/View community post/);
 assert.match(html,/2 of 2/);
});
test("initial page has an honest loading state and no autoplaying third-party player",()=>{
 const html=render(createElement(components.default,{loadFeed:async()=>({items:[item],partial:false})}));
 assert.match(html,/Orbit Shorts/);assert.match(html,/Loading public videos/);
 assert.doesNotMatch(html,/No supported public clips|<iframe|<video/i);
 assert.match(html,/A video link is not evidence of a donation/);
});
