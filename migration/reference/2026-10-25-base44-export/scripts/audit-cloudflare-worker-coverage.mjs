import fs from 'node:fs';import assert from 'node:assert/strict';
const services=[['gateway','wrangler.toml','host/gateway/worker.js'],['oauth','host/oauth/worker.js',null],['email','host/email/wrangler.toml','host/email/worker.js'],['workforce','host/workforce/manifest.json',null]];
for(const [name,config,entry] of services){assert.ok(fs.existsSync(config),name+' config missing');if(entry)assert.ok(fs.existsSync(entry),name+' entry missing');console.log('PASS: source present',name)}
const manifest=JSON.parse(fs.readFileSync('host/workforce/manifest.json'));assert.equal(manifest.activation,'disabled');
console.log('BLOCKED: workforce runtime has no independently verified tool, memory or agent execution backend');
console.log('BLOCKED: live Cloudflare DNS, secrets, external OAuth, payment and email delivery not certified by source inspection');
