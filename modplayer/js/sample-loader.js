"use strict";

export class SampleLoader{
  constructor(){this._ctx=null}
  async load(file){
    if(!this._ctx) this._ctx=new(window.AudioContext||window.webkitAudioContext)();
    const ab=await file.arrayBuffer();
    const buf=await this._ctx.decodeAudioData(ab);
    let mono;
    if(buf.numberOfChannels===1) mono=buf.getChannelData(0);
    else{
      const L=buf.getChannelData(0),R=buf.getChannelData(1);
      mono=new Float32Array(L.length);
      for(let i=0;i<L.length;i++) mono[i]=(L[i]+R[i])/2;
    }
    const rate=16726;
    const resampled=this._resample(mono,buf.sampleRate,rate);
    const limited=resampled.length>65534?resampled.slice(0,65534):resampled;
    return{name:file.name.substring(0,22).replace(/\.[^.]+$/,''),data:this._normalize(limited),rate};
  }
  _resample(d,from,to){
    if(from===to)return d;
    const ratio=from/to,len=Math.floor(d.length/ratio),out=new Float32Array(len);
    for(let i=0;i<len;i++){
      const s=i*ratio,f=Math.floor(s),c=Math.min(f+1,d.length-1),t=s-f;
      out[i]=d[f]*(1-t)+d[c]*t;
    }
    return out;
  }
  _normalize(d){
    let mx=0;for(let i=0;i<d.length;i++){const a=Math.abs(d[i]);if(a>mx)mx=a}
    if(mx===0||mx>=.99)return d;
    const out=new Float32Array(d.length),g=.99/mx;
    for(let i=0;i<d.length;i++) out[i]=d[i]*g;
    return out;
  }
}

export const smpLoader=new SampleLoader();
