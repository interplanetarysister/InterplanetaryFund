import assert from 'node:assert/strict';
import { buildCampaignEmbed } from '../src/lib/campaignSharing.js';
import { generateCampaignUpdateDraft } from '../src/lib/updateDraft.js';
import { copyText } from '../src/lib/copyText.js';
import { readFileSync } from 'node:fs';

const embed=buildCampaignEmbed({id:'campaign23',title:'People & Community <help>'},true);
assert.equal(embed.url,'https://interplanetaryfund.com/campaign/campaign23');
assert.match(embed.card,/href="https:\/\/interplanetaryfund\.com\/campaign\/campaign23"/);
assert.doesNotMatch(embed.card,/<iframe|<script/i,'Embeds must not require a frame-capable host');
assert.match(embed.card,/People &amp; Community &lt;help&gt;/);
assert.match(embed.button,/View campaign on Interplanetary Fund/);
assert.doesNotMatch(embed.card,/src="http:\/\//);
assert.equal(buildCampaignEmbed({id:'../unsafe'},true).card,'');
assert.match(embed.card,/src="https:\/\/interplanetaryfund\.com\/ifund-logo.jpg"/);
assert.doesNotMatch(buildCampaignEmbed({id:'safe',title:'<img src=x onerror=alert(1)>',cover_image_url:'javascript:alert(1)'},true).card,/<img src=x onerror/);
assert.doesNotMatch(buildCampaignEmbed({id:'safe',cover_image_url:'javascript:alert(1)'},true).card,/src="javascript:/);
assert.doesNotMatch(readFileSync(new URL('../src/components/campaigns/ShareCampaignKit.jsx',import.meta.url),'utf8'),/<iframe/i);

const update=generateCampaignUpdateDraft({id:'campaign23',title:'Community Repairs',summary:'Working together'},'Supplies have arrived.');
assert.match(update.title,/Community Repairs/);
assert.match(update.content,/Supplies have arrived/);
assert.match(update.content,/https:\/\/interplanetaryfund\.com\/campaign\/campaign23/);
assert.doesNotMatch(generateCampaignUpdateDraft({id:'campaign23',title:'Community Repairs'},'').content,/received \$|finished|raised \$/i);
const oldNavigator=globalThis.navigator;
try {
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async()=>{}}}});
 assert.equal(await copyText('Hello IFund'),true);
 const selection={select(){this.called=true;},setSelectionRange(){},focus(){}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
 assert.equal(await copyText('Hello',selection),false);
 assert.equal(selection.called,true,'When clipboard blocks, the input stays selectable');
} finally {
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:oldNavigator});
}
const sharing=readFileSync(new URL('../src/components/campaigns/ShareCampaignKit.jsx',import.meta.url),'utf8');
assert.match(sharing,/Copy campaign card HTML/);
assert.match(sharing,/ifund-campaign-card-code/);
assert.match(sharing,/copyText\(/);
const updates=readFileSync(new URL('../src/components/campaigns/UpdatesSection.jsx',import.meta.url),'utf8');
assert.match(updates,/Generate copy-ready update/);
assert.match(updates,/Copy update text/);
assert.match(updates,/Save private draft/);
assert.match(updates,/data\?\.update\?\.id/);
console.log('PASS: canonical campaign embeds, safe HTML, copy fallback, generated/editable updates and draft preservation.');
