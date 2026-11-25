import { useMemo } from "react";

function envelope(buffer,from,to,slices=96) {
  const frames=buffer.length;
  const rate=buffer.sampleRate;
  if(!Number.isFinite(frames) || !Number.isFinite(rate) || !buffer?.getChannelData || frames<=0)return [];
  const left=buffer.getChannelData(0);
  const right=buffer.numberOfChannels>1?buffer.getChannelData(1):null;
  const start=Math.max(0,Math.floor(from*rate)),end=Math.min(frames,Math.ceil(to*rate));
  if(start>=end)return [];
  const wave=[];
  for(let i=0;i<slices;i++){
    const a=start+Math.floor((end-start)*i/slices);
    const b=start+Math.floor((end-start)*(i+1)/slices);
    const stride=Math.max(1,Math.floor((b-a)/64));
    let max=0;
    for(let t=a;t<b;t+=stride) {
      const sample=Math.abs(right?(left[t]+right[t])*0.5:left[t]);
      if(Number.isFinite(sample))max=Math.max(max,sample);
    }
    wave.push(Math.min(1,max));
  }
  return wave;
}

export default function AudioTrackWaveform({track,timelineDuration}) {
  const samples=useMemo(()=>envelope(track.buffer,track.trimStart,track.trimEnd),[track.buffer,track.trimStart,track.trimEnd]);
  const full=Math.max(0.1,timelineDuration);
  const leftPct=Math.min(100,track.start/full*100);
  const widthPct=Math.max(0.5,(track.trimEnd-track.trimStart)/full*100);
  const bars=samples.map((value,i)=>{
    const height=Math.max(2,Math.round(26*value));
    const x=i*2.5+1;
    return <line key={i} x1={x} y1={17-height/2} x2={x} y2={17+height/2} stroke="currentColor" strokeWidth="1.5"/>;
  });
  return <div className="space-y-1">
    <p className="text-xs text-muted-foreground">Waveform · {track.start.toFixed(1)}s – {(track.start+track.trimEnd-track.trimStart).toFixed(1)}s on mix timeline</p>
    <div className="relative h-12 overflow-hidden rounded-lg border border-border bg-muted/30">
      <div className="absolute inset-y-1 overflow-hidden rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-300"
        style={{left:leftPct+"%",width:widthPct+"%"}}>
        <svg role="img" aria-label={"Amplitude waveform for "+track.name} viewBox="0 0 242 34"
          preserveAspectRatio="none" className="h-full w-full">
          {bars}
        </svg>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">Amplitude preview only. Waveform peaks do not predict audience response.</p>
  </div>;
}
