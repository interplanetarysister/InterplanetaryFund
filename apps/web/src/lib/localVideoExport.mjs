import { coverCrop } from "./mediaVariantPlans.mjs";

const MAX_EXPORT_SECONDS = 60;
const MAX_OUTPUT_BYTES = 70 * 1024 * 1024;
const MAX_RENDER_PIXELS = 1280 * 720;
const OUTPUT_FPS = 24;
const FORMATS = [
  { mime: "video/webm;codecs=vp8,opus", extension: "webm" },
  { mime: "video/webm", extension: "webm" },
  { mime: "video/mp4", extension: "mp4" },
];

export function videoExportAvailability(recorder = globalThis.MediaRecorder) {
  if (!recorder || typeof recorder.isTypeSupported !== "function") return null;
  return FORMATS.find(item => recorder.isTypeSupported(item.mime)) || null;
}
export function videoExportDimensions(variant) {
  if (!Number.isFinite(variant?.width) || !Number.isFinite(variant?.height) ||
    variant.width < 16 || variant.height < 16 || variant.width > 4096 || variant.height > 4096)
    throw new Error("Choose a valid video frame size.");
  const factor = Math.min(1, Math.sqrt(MAX_RENDER_PIXELS / (variant.width * variant.height)));
  const width = Math.max(16, Math.floor(variant.width * factor / 2) * 2);
  const height = Math.max(16, Math.floor(variant.height * factor / 2) * 2);
  return { width, height };
}
export function videoExportWindow(sourceDuration, start=0, end=0) {
  if (!Number.isFinite(sourceDuration) || sourceDuration < 1 || sourceDuration > 600)
    throw new Error("Video must be between 1 and 600 seconds to export.");
  if (!Number.isFinite(start) || start < 0 || start >= sourceDuration ||
    !Number.isFinite(end) || end < 0 || (end !== 0 && end > sourceDuration))
    throw new Error("Choose valid clip boundaries.");
  const until = end === 0 ? sourceDuration : end;
  if (until - start < 0.3 || until - start > MAX_EXPORT_SECONDS)
    throw new Error("Choose an export clip between 0.3 and 60 seconds.");
  return { from: start, to: until, duration: until - start };
}
function eventOrTimeout(element, eventName, signal, ms=12000) {
  return new Promise((resolve,reject)=>{
    let timer;
    const clean=()=>{clearTimeout(timer);element.removeEventListener(eventName,done);element.removeEventListener("error",failed);signal?.removeEventListener("abort",abort);};
    const done=()=>{clean();resolve();};
    const failed=()=>{clean();reject(Error("The selected media cannot be decoded."));};
    const abort=()=>{clean();reject(Error("Video export cancelled."));};
    element.addEventListener(eventName,done,{once:true});
    element.addEventListener("error",failed,{once:true});
    signal?.addEventListener("abort",abort,{once:true});
    timer=setTimeout(()=>{clean();reject(Error("Timed out reading the media."));},ms);
    if(signal?.aborted)abort();
  });
}

/**
 * Browser-native, real-time recording of selected local video to an actual
 * downloadable file. No network or provider calls. The output is NOT
 * guaranteed to satisfy any social platform's codec or upload requirements.
 */
export async function renderLocalVideoVariant({
  sourceUrl, variant, layeredAudioUrl=null, signal, onProgress=()=>{},
}={}) {
  if (typeof sourceUrl !== "string" || !sourceUrl.startsWith("blob:") ||
      (layeredAudioUrl && (typeof layeredAudioUrl !== "string" || !layeredAudioUrl.startsWith("blob:"))))
    throw new Error("Only locally supplied video and layered audio can be rendered.");
  if (signal?.aborted) throw new Error("Video export cancelled.");
  const format=videoExportAvailability();
  if (!format) throw new Error("This browser cannot record an eligible video format.");
  if (typeof document === "undefined" || typeof HTMLCanvasElement === "undefined" ||
      !HTMLCanvasElement.prototype.captureStream)
    throw new Error("This device does not support browser video rendering.");
  const {width,height}=videoExportDimensions(variant);
  const video=document.createElement("video");
  video.preload="auto";video.playsInline=true;video.src=sourceUrl;video.muted=false;
  const overlay=layeredAudioUrl?document.createElement("audio"):null;
  if (overlay){overlay.preload="auto";overlay.src=layeredAudioUrl;}
  const canvas=document.createElement("canvas");
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw Error("Canvas video rendering is unavailable.");
  let stream,mediaRecorder,ctxAudio,interval,timeout,stopping=false;
  const recorderChunks=[];
  const cropArgs=()=>coverCrop(video.videoWidth,video.videoHeight,width,height,
    variant.focalX,variant.focalY,variant.scale);
  const paint=()=>{
    if (!video.videoWidth || !video.videoHeight || video.readyState<2)return;
    const crop=cropArgs();
    ctx.filter="brightness("+variant.brightness+") contrast("+variant.contrast+") saturate("+variant.saturation+")";
    ctx.drawImage(video,crop.x,crop.y,crop.width,crop.height,0,0,width,height);
  };
  const stop=()=>{
    if(stopping && mediaRecorder?.state!=="recording")return;
    stopping=true;
    clearInterval(interval);clearTimeout(timeout);
    try{video.pause();overlay?.pause();}catch{}
    if(mediaRecorder?.state==="recording")mediaRecorder.stop();
  };
  const cancel=()=>stop();
  signal?.addEventListener("abort",cancel,{once:true});
  try{
    if(video.readyState<1)await eventOrTimeout(video,"loadedmetadata",signal);
    const clip=videoExportWindow(video.duration,variant.trimStart||0,variant.trimEnd||0);
    const speed=Number(variant.videoSpeed??1);
    if(!Number.isFinite(speed)||speed<0.5||speed>2||clip.duration/speed>MAX_EXPORT_SECONDS)
      throw Error("The rendered video would exceed 60 seconds; shorten the selection or increase playback speed.");
    video.playbackRate=speed;
    if(overlay)overlay.playbackRate=speed;
    if(clip.from>0){
      const seek=eventOrTimeout(video,"seeked",signal);
      video.currentTime=clip.from;await seek;
    }
    if(overlay && overlay.readyState<1)await eventOrTimeout(overlay,"loadedmetadata",signal);
    if(overlay && Number.isFinite(overlay.duration) && overlay.duration>clip.from){
      if(clip.from>0){
        const seek=eventOrTimeout(overlay,"seeked",signal);
        overlay.currentTime=clip.from;await seek;
      }
    }
    if(signal?.aborted)throw Error("Video export cancelled.");
    paint();
    stream=canvas.captureStream(OUTPUT_FPS);
    if (!stream.getVideoTracks().length)throw Error("Video track capture is unavailable.");
    const AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext;
    const mustPreserveAudio=(variant.videoVolume??1)>0||Boolean(overlay);
    if(mustPreserveAudio){
      if(!AudioContextClass)throw Error("Audio routing is unavailable; set original audio volume to zero to export muted video.");
      ctxAudio=new AudioContextClass();
      const dest=ctxAudio.createMediaStreamDestination();
      const source=ctxAudio.createMediaElementSource(video);
      const volume=ctxAudio.createGain();
      volume.gain.value=Math.min(1,Math.max(0,variant.videoVolume??1));
      source.connect(volume);volume.connect(dest);
      if(overlay){
        const layered=ctxAudio.createMediaElementSource(overlay);
        const layeredGain=ctxAudio.createGain();
        layeredGain.gain.value=Math.min(1,Math.max(0,variant.layeredVolume??1));
        layered.connect(layeredGain);layeredGain.connect(dest);
      }
      for (const track of dest.stream.getAudioTracks())stream.addTrack(track);
      if(ctxAudio.state==="suspended")await ctxAudio.resume();
    }
    if(signal?.aborted)throw Error("Video export cancelled.");
    mediaRecorder=new MediaRecorder(stream,{
      mimeType:format.mime,videoBitsPerSecond:3_500_000,audioBitsPerSecond:128_000,
    });
    const completion=new Promise((resolve,reject)=>{
      mediaRecorder.ondataavailable=e=>{if(e.data?.size)recorderChunks.push(e.data);};
      mediaRecorder.onerror=()=>reject(Error("Browser video recording failed."));
      mediaRecorder.onstop=()=>{
        if(signal?.aborted)reject(Error("Video export cancelled."));
        else resolve();
      };
    });
    // A failed play() call may reject before we await completion.
    completion.catch(()=>{});
    if(signal?.aborted)throw Error("Video export cancelled.");
    mediaRecorder.start(250);
    // Real-time browser encoder: a hidden/background tab may be throttled.
    interval=setInterval(()=>{
      if(signal?.aborted){stop();return;}
      paint();
      const elapsed=Math.min(clip.duration,Math.max(0,video.currentTime-clip.from));
      onProgress(Math.round(100*elapsed/clip.duration));
      if(video.ended||video.currentTime>=clip.to-0.04)stop();
    },Math.round(1000/OUTPUT_FPS));
    timeout=setTimeout(stop,Math.ceil((clip.duration/speed+8)*1000));
    await video.play();
    if(overlay && overlay.duration>clip.from)await overlay.play();
    await completion;
    if(signal?.aborted)throw Error("Video export cancelled.");
    const blob=new Blob(recorderChunks,{type:mediaRecorder.mimeType||format.mime});
    if(blob.size<1024 || blob.size>MAX_OUTPUT_BYTES)
      throw Error("Encoded video is empty or exceeds the local file limit.");
    onProgress(100);
    return {blob,format:format.extension,width,height,duration:clip.duration/speed,
      caveat:"Browser-recorded video; check actual playback, synchronization and each destination's upload requirements before posting."};
  } finally {
    signal?.removeEventListener("abort",cancel);
    stop();
    stream?.getTracks().forEach(track=>track.stop());
    if(ctxAudio)await ctxAudio.close().catch(()=>{});
    video.removeAttribute("src");video.load();
    if(overlay){overlay.removeAttribute("src");overlay.load();}
  }
}
