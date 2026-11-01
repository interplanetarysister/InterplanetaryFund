import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import { campaignPublicUrl } from '../src/lib/campaignSharing.js';

const read = name => fs.readFileSync(new URL('../'+name, import.meta.url),'utf8');
const APP_ID = '6a67a778342a8fe05ee79cba';
const backend = read('base44/functions/renderInterplanetaryPhoto/entry.ts');
const styles = read('base44/shared/ifundSignatureStyle.ts');
function mockHandler({ authenticated = true, openaiKey = null, providerResponse = null } = {}) {
  const source = ts.transpileModule(backend,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  const calls=[];
  const fetch = async (url, options) => {
    calls.push({url,options});
    return providerResponse || {ok:false,status:503};
  };
  const base44={
    auth:{me:async()=>authenticated ? {id:'test-user',role:'user'} : null},
    integrations:{Core:{ UploadFile:async()=>({file_url:`https://base44.app/api/apps/${APP_ID}/files/mp/public/test/edited.png`}) }},
  };
  const stubReq=name=>{
    if(name.includes('base44/sdk'))return {createClientFromRequest:()=>base44};
    if(name === 'base44:runtime')return {secrets:{get:(key)=>key==='OPENAI_API_KEY'?openaiKey:null}};
    if(name.endsWith('accountGuard.ts'))return {assertActiveAccount:async()=>({ok:true})};
    if(name.endsWith('ifundSignatureStyle.ts'))return {
      IFUND_PHOTO_EDIT_STYLE:'Keep original image and restyle in authentic IFund style',
    };
    throw Error('Unexpected import '+name);
  };
  new Function('require','exports','fetch','Response','console','AbortSignal',source)(
    stubReq,exports,fetch,Response,
    {error:()=>{},warn:()=>{}},AbortSignal,
  );
  return {fn:exports.default,calls};
}
const req = url => ({json:async()=>({source_url:url})});
const original=`https://media.base44.com/images/public/${APP_ID}/myphoto.jpg`;
const appUpload=`https://base44.app/api/apps/${APP_ID}/files/mp/public/asset/photo.png`;
{
 const {fn,calls}=mockHandler();const res=await fn(req(original));
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.mode,'photo_treatment');
 assert.equal(data.source_url,original);
 assert.equal(calls.length,0,'Do not waste an AI generation credit without configured image edit service');
}
{
 const {fn}=mockHandler({authenticated:false});const r=await fn(req(original));assert.equal(r.status,401);
}
{
 const {fn}=mockHandler();const r=await fn(req(appUpload));
 assert.equal(r.status,200);
 assert.equal((await r.json()).source_url,appUpload);
}
for(const source of [
 'https://random.test/image.jpg','http://media.base44.com/images/public/photo.jpg',
 'https://media.base44.com.evil.test/images/public/image.jpg',
 'https://media.base44.com@evil.test/images/public/image.jpg',
 'https://media.base44.com/private/anything',
 'https://media.base44.com/images/public/other_app/photo.png',
 'https://base44.app/api/apps/other_app/files/mp/public/photo.png',
 'javascript:alert(1)'
]){
 const {fn}=mockHandler();
 const res=await fn(req(source));
 assert.equal(res.status,400,source);
}
{
 const {fn,calls}=mockHandler({openaiKey:'mock-only-secret'});
 const res=await fn(req(original));
 assert.equal(res.status,200);
 assert.equal((await res.json()).mode,'photo_treatment');
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://api.openai.com/v1/images/edits');
 const body=JSON.parse(calls[0].options.body);
 assert.equal(body.images[0].image_url,original,'MUST pass the actual photo as an edit image');
 assert.match(body.prompt,/original image|original photo|Keep original/i);
 assert.equal(body.model,'gpt-image-2');
}
{
 const png=Buffer.from('This mock is not a real image').toString('base64');
 const response={ok:true,json:async()=>({data:[{b64_json:png}]})};
 const {fn}=mockHandler({openaiKey:'fake-key',providerResponse:response});
 const res=await fn(req(original));
 assert.equal(res.status,200);
 assert.equal((await res.json()).mode,'ai_photo_edit');
}
assert.match(styles,/cyberpunk/i);
assert.match(styles,/steampunk/i);
assert.match(styles,/space.comic/i);
assert.match(styles,/afro/i);
assert.match(read('base44/functions/generateCampaignCover/entry.ts'),/IFUND_SIGNATURE_STYLE/);
assert.match(read('base44/functions/generateSocialContent/entry.ts'),/IFUND_SIGNATURE_STYLE/);
assert.doesNotMatch(backend,/Core\.GenerateImage\(/,'Never pretend a text prompt sees uploaded photos');
const media=read('src/components/media/MediaUpload.jsx');
assert.match(media,/improveUploadedPhoto\(base44, source\)/);
const photoService = read('src/lib/ifundPhotoService.js');
assert.match(photoService,/createIfundPhotoTreatment\(originalUrl, serverUrl \|\| null\)/);
assert.match(photoService,/brandAndUploadGeneratedImage\(base44, brandedSource\)/);
assert.match(read('src/components/social/PostComposer.jsx'),/improveUploadedPhoto\(base44, source\)/);
assert.match(media,/photoSelected && \(/,'Available for all uploaded photos');
assert.match(read('src/lib/ifundPhotoTreatment.js'),/ctx.drawImage\(image, 0, 0, width, height\)/);
assert.match(read('src/lib/ifundPhotoTreatment.js'),/cyan|211,238|34,211,238/);
const branded=read('src/lib/ifundImageBranding.js');
assert.match(branded,/interplanetaryfund\.com/);
assert.match(branded,/IFUND_WATERMARK_LOGO = BRAND_MARK/);
assert.match(read('src/pages/CreateCampaign.jsx'),/brandAndUploadGeneratedImage/);
assert.match(read('src/components/social/AdminContentPanel.jsx'),/brandAndUploadGeneratedImage/);
assert.equal(campaignPublicUrl('c123'),'https://interplanetaryfund.com/campaign/c123');
const reference=fs.readFileSync(new URL('../public/ifund-logo.jpg',import.meta.url));
assert.equal(reference.length,102603);
assert.equal(crypto.createHash('sha256').update(reference).digest('hex'),'468ed782bacfa2e70c5ec524dae7d2ecebadf18c5ebce9b1fa849722d4d06d3e');
console.log('PASS: both IFund-owned Base44 image storage addresses, provider edit, mocked no-charge fallback, invalid URL denial, logo and shared style.');
