import test from "node:test";
import assert from "node:assert/strict";
import { storyMessages } from "../worker/agents/story.js";

const context={research:{available:false},campaign:null,preferences:[]};
test("generated complete STORY targets 1,000–2,500 chars with no publication minimum",()=>{
 const messages=storyMessages({details:"A verified community needs help with documented school supplies.",section:null},context);
 assert.match(messages[0].content,/between 1000 and 2500 characters/);
 assert.match(messages[0].content,/Avoid padding, redundant paragraphs/);
 assert.match(messages[0].content,/Never invent names, amounts/);
 assert.match(messages[0].content,/no minimum story length blocks publishing/);
});
test("section rewriting keeps the original scope and avoids forcing long output",()=>{
 const messages=storyMessages({details:"A verified community needs help.",section:"A short section."},context);
 assert.match(messages[0].content,/For a section rewrite preserve its natural scope/);
 assert.match(messages[0].content,/retain its scope and all supplied facts/);
});
