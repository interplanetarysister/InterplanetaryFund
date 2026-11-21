// Exact overlay is the only source of words printed onto generated artwork.
// The image model is always asked to generate art without text or letterforms.
// User text is copied literally; corrected copy must be user-reviewed/entered.
export const MAX_ART_CAPTION=100;
export function validateArtworkCaption(value){
 if(typeof value!=="string")throw Error("Caption must be text.");
 if(value.length>MAX_ART_CAPTION || /[\u0000-\u001f\u007f]/u.test(value))
  throw Error("Use up to 100 printable characters for the image caption.");
 return value;
}
export function artworkCaptionLines(caption,{maxChars=26,maxLines=4}={}){
 const text=validateArtworkCaption(caption).trim();
 if(!text)return [];
 const words=text.split(/\s+/u),lines=[];let current="";
 for(const word of words){
  if(word.length>maxChars)throw Error("A word is too long for the image. Shorten the caption.");
  const proposed=current?current+" "+word:word;
  if(proposed.length>maxChars){
   lines.push(current);current=word;
  }else current=proposed;
 }
 if(current)lines.push(current);
 if(lines.length>maxLines)throw Error("Shorten the caption to fit the image.");
 return lines;
}
export async function overlayExactArtworkCaption(file,caption){
 const lines=artworkCaptionLines(caption);
 if(!lines.length)return file;
 if(!(file instanceof Blob)||file.type!=="image/jpeg")throw Error("Only generated JPEG artwork can be captioned.");
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error("Unable to preview generated artwork."));image.src=url;});
  const width=image.naturalWidth,height=image.naturalHeight;
  if(width<64||height<64||width*height>80_000_000)throw Error("The generated artwork has unsupported dimensions.");
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d",{alpha:false});if(!ctx)throw Error("This browser cannot render exact text.");
  ctx.drawImage(image,0,0);
  const fontSize=Math.max(15,Math.floor(Math.min(width/16,height/15,58)));
  ctx.font="700 "+fontSize+"px Arial, sans-serif";
  ctx.textAlign="center";ctx.textBaseline="middle";
  // Shrink to fit the widest EXACT line; never mutate wording or spelling.
  const longest=Math.max(...lines.map(line=>ctx.measureText(line).width));
  const scale=Math.min(1,(width*.86)/Math.max(1,longest));
  const size=Math.max(12,Math.floor(fontSize*scale));
  ctx.font="700 "+size+"px Arial, sans-serif";
  const lineHeight=size*1.3,boxHeight=Math.min(height*.64,lineHeight*(lines.length+1.5));
  const y=height-boxHeight-12;
  const gradient=ctx.createLinearGradient(0,y,0,height);
  gradient.addColorStop(0,"rgba(4,11,30,0)");gradient.addColorStop(.25,"rgba(4,11,30,.79)");gradient.addColorStop(1,"rgba(4,11,30,.95)");
  ctx.fillStyle=gradient;ctx.fillRect(0,y,width,height-y);
  ctx.fillStyle="#fff";ctx.shadowColor="rgba(0,0,0,.7)";ctx.shadowBlur=5;
  lines.forEach((line,i)=>ctx.fillText(line,width/2,y+boxHeight/2+(i-(lines.length-1)/2)*lineHeight,width*.9));
  const result=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.93));
  if(!result||result.size>5*1024*1024)throw Error("Captioned artwork exceeds the upload size limit.");
  return new File([result],"ifund-exact-text-cover.jpg",{type:"image/jpeg"});
 }finally{URL.revokeObjectURL(url);}
}
