import test from "node:test";
import assert from "node:assert/strict";
import { storyMessages } from "../worker/agents/story.js";

const context={research:{available:false},campaign:null,preferences:[]};
test("complete STORY instructions target publication length without fabricated facts",()=>{
 const messages=storyMessages({details:"A verified community needs help with documented school supplies.",section:null},context);
 assert.match(messages[0].content,/at least 3500 meaningful characters/);
 assert.match(messages[0].content,/Avoid padding or redundant paragraphs/);
 assert.match(messages[0].content,/Never invent names, amounts/);
});
test("section rewriting keeps the original scope and avoids forcing long output",()=>{
 const messages=storyMessages({details:"A verified community needs help.",section:"A short section."},context);
 assert.match(messages[0].content,/For a section rewrite preserve its natural scope/);
 assert.match(messages[0].content,/retain its scope and all supplied facts/);
});
