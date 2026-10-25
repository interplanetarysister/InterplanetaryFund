import assert from 'node:assert/strict';
import { createIfundPhotoTreatment } from '../src/lib/ifundPhotoTreatment.js';

const priorWindow = globalThis.window;
const priorDocument = globalThis.document;
const operations = [];
const context = {
  filter:'none', globalAlpha:1,
  drawImage(image,x,y,width,height){operations.push({type:'draw',src:image.src,x,y,width,height,alpha:this.globalAlpha,filter:this.filter});},
  createLinearGradient(){return {addColorStop(){}};},
  strokeRect(){operations.push({type:'border'});},
  beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, arc(){},
  save(){operations.push({type:'save'});this._alpha=this.globalAlpha;},
  restore(){this.globalAlpha=this._alpha ?? 1;},
};
class Photo {
  naturalWidth=1280;
  naturalHeight=960;
  set src(value) {
    this._src=value;
    queueMicrotask(()=>this.onload?.());
  }
  get src(){return this._src;}
}
try {
  globalThis.window={Image:Photo};
  globalThis.document={createElement:(tag)=>{
    assert.equal(tag,'canvas');
    return {
      getContext:()=>context,
      toBlob:(callback,type)=>{assert.equal(type,'image/png');callback(new Blob(['PNG mock'],{type}));},
      set width(value){operations.push({type:'width',value});},
      set height(value){operations.push({type:'height',value});},
    };
  }};
  const source='https://media.base44.com/images/public/photo.jpg';
  const result=await createIfundPhotoTreatment(source);
  assert.equal(result.type,'image/png');
  assert.equal(operations.filter(op=>op.type==='draw').length,1);
  assert.equal(operations.find(op=>op.type==='draw').src,source);
  assert.match(operations.find(op=>op.type==='draw').filter,/contrast/);
  assert.ok(operations.some(op=>op.type==='border'));
  operations.length=0;
  const edit='https://media.base44.com/images/public/edited.png';
  await createIfundPhotoTreatment(source,edit);
  const draws=operations.filter(op=>op.type==='draw');
  assert.equal(draws.length,2);
  assert.equal(draws[0].src,source,'Original pixels must be the primary full-opacity layer');
  assert.equal(draws[0].alpha,1);
  assert.equal(draws[1].src,edit);
  assert.ok(draws[1].alpha <= .15,'AI edit is only a subtle accent layer');
  console.log('PASS: original-source full-opacity photo treatment, optional restrained AI edit, saved image blob and decorative IFund style.');
} finally {
  globalThis.window=priorWindow;
  globalThis.document=priorDocument;
}
