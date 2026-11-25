import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {videoExportDimensions, videoExportWindow, videoExportAvailability, renderLocalVideoVariant} from "../src/lib/localVideoExport.mjs";
import {createPlatformVariants} from "../src/lib/mediaVariantPlans.mjs";

test("local video export derives bounded real output dimensions for each selected aspect ratio",()=>{
 const variants=createPlatformVariants(["tiktok","x-feed","meta-square"]);
 assert.equal(variants.length,3);
 for(const item of variants){
   const size=videoExportDimensions(item);
   assert.ok(size.width*size.height<=1280*720+2000);
   assert.equal(size.width%2,0);
   assert.equal(size.height%2,0);
   assert.ok(Math.abs(size.width/size.height-item.width/item.height)<0.015);
 }
 assert.throws(()=>videoExportDimensions({width:0,height:9}),/valid video/);
});
test("real-time export rejects inappropriate clip boundaries or unsupported lengths",()=>{
 assert.deepEqual(videoExportWindow(30,5,12),{from:5,to:12,duration:7});
 assert.deepEqual(videoExportWindow(30,0,0),{from:0,to:30,duration:30});
 for(const range of [[30,-1,10],[30,5,2],[30,0,0.1],[120,0,0],[30,0,31]])
   assert.throws(()=>videoExportWindow(...range),/clip|boundar/i);
});
test("recording codec selection is feature-detected, not assumed",()=>{
 assert.deepEqual(videoExportAvailability({isTypeSupported:val=>val==="video/webm"}),{mime:"video/webm",extension:"webm"});
 assert.deepEqual(videoExportAvailability({isTypeSupported:val=>val==="video/mp4"}),{mime:"video/mp4",extension:"mp4"});
 assert.equal(videoExportAvailability({isTypeSupported:()=>false}),null);
 assert.equal(videoExportAvailability(null),null);
});
test("video renderer refuses remote URLs and provider network access",async()=>{
 await assert.rejects(()=>renderLocalVideoVariant({sourceUrl:"https://outside.example/video.mp4",variant:{width:1200,height:800}}),/Only locally/);
 await assert.rejects(()=>renderLocalVideoVariant({sourceUrl:"blob:local/one",layeredAudioUrl:"https://example.org/audio",variant:{width:1200,height:800}}),/Only locally/);
 await assert.rejects(()=>renderLocalVideoVariant({sourceUrl:"blob:local/one",variant:{width:1200,height:800},signal:{aborted:true}}),/cancelled/);
 const code=readFileSync(new URL("../src/lib/localVideoExport.mjs",import.meta.url),"utf8");
 assert.match(code,/MediaRecorder/);
 assert.match(code,/createMediaStreamDestination/);
 assert.match(code,/canvas\.captureStream/);
 assert.doesNotMatch(code,/fetch\(|\/api\/.*publish/);
});
test("selected platform UI renders actual local files and keeps original/layered audio optional",()=>{
 const source=readFileSync(new URL("../src/components/communications/PlatformVariantEditor.jsx",import.meta.url),"utf8");
 const optimizer=readFileSync(new URL("../src/components/communications/PrePostMediaOptimizer.jsx",import.meta.url),"utf8");
 assert.match(source,/renderLocalVideoVariant/);
 assert.match(source,/Render this version/);
 assert.match(source,/Save rendered video/);
 assert.match(source,/Cancel video rendering/);
 assert.match(source,/download=\{"ifund-"/);
 assert.match(optimizer,/layeredAudioUrl=\{layeredAudioUrl\}/);
});
