"use strict";

import { PAL_CLOCK, PERIOD_TABLE, SINE_TBL, periodToNoteIdx } from './constants.js';
import state from './state.js';
import { uiUpdate, uiRenderPattern, uiCreateScopes, uiCreateMuteStrip, resetVU } from './ui.js';

export class ModPlayer{
  constructor(ctx){
    this.ctx=ctx;this.mod=null;this.isPlaying=false;
    this.lookahead=0.08;this.nextNoteTime=0;
    this.speed=6;this.bpm=125;this.row=0;this.tick=0;
    this.breakPat=false;this.nextRow=0;this.jumpOrd=-1;
    this.patLoop={row:0,count:0};
    this.channels=[];this.analysers=[];this.muted=[];
    this.masterGain=ctx.createGain();this.masterGain.gain.value=0.5;
    this.masterGain.connect(ctx.destination);
    this.previewGain=ctx.createGain();this.previewGain.gain.value=0.4;
    this.previewGain.connect(ctx.destination);
    this.audioBuffers=[];
    this.onSongEnd=null;
    this._loop=this._loop.bind(this);
  }
  load(doc){
    this.stop();this.mod=doc;
    this._setupChannels(doc.channels);this._resetState();
    this.audioBuffers=doc.sampleData.map((d,i)=>{
      if(d.length===0)return null;
      const buf=this.ctx.createBuffer(1,d.length,this.ctx.sampleRate);
      buf.copyToChannel(d,0);return buf;
    });
  }
  _setupChannels(n){
    this.channels=[];this.analysers=[];
    const pan=[-0.7,0.7,0.7,-0.7,-0.7,0.7,-0.7,0.7];
    for(let i=0;i<n;i++){
      const p=this.ctx.createStereoPanner();p.pan.value=pan[i%8];
      p.connect(this.masterGain);
      const a=this.ctx.createAnalyser();a.fftSize=512;a.smoothingTimeConstant=0.5;
      a.connect(p);
      this.channels.push({
        idx:i,panner:p,analyser:a,
        sampleIdx:-1,volume:64,period:0,finetune:0,
        portDest:0,portSpeed:0,
        vibPos:0,vibDepth:0,vibSpeed:0,vibWave:0,
        tremPos:0,tremDepth:0,tremSpeed:0,
        arpBase:0,
        retrigCount:0,retrigInterval:0,
        delaySample:-1,delayPeriod:0,delayTick:0,
        cutTick:0,
        source:null,gain:null
      });
      this.analysers.push(a);
    }
    if(this.muted.length!==n) this.muted=new Array(n).fill(false);
    uiCreateScopes(n);uiCreateMuteStrip(n);resetVU(n);
  }
  _resetState(){
    this.speed=6;this.bpm=125;this.row=0;this.tick=0;
    this.patLoop={row:0,count:0};
    this.channels.forEach(ch=>{ch.sampleIdx=-1;ch.volume=64;ch.period=0});
  }
  play(){
    if(!this.mod)return;
    if(this.ctx.state==='suspended')this.ctx.resume();
    if(this.isPlaying)this.stop();
    this.isPlaying=true;this._resetState();
    this.row=state.editor.cursorRow;
    this.nextNoteTime=this.ctx.currentTime+0.05;
    requestAnimationFrame(this._loop);
  }
  stop(){
    this.isPlaying=false;
    this.channels.forEach(ch=>{
      if(ch.source){try{ch.source.stop()}catch(e){}}
      ch.source=null;
    });
  }
  toggleMute(ch){this.muted[ch]=!this.muted[ch]}
  soloChannel(ch){
    const allMuted=this.muted.every((m,i)=>i===ch?!m:m);
    if(allMuted){this.muted.fill(false)}
    else{this.muted.fill(true);this.muted[ch]=false}
  }
  previewNote(smpIdx,period){
    if(!this.mod||smpIdx<1||smpIdx>31)return;
    const buf=this.audioBuffers[smpIdx-1];if(!buf)return;
    const src=this.ctx.createBufferSource();src.buffer=buf;
    const smp=this.mod.samples[smpIdx-1];
    if(smp.loopLen>2){
      src.loop=true;
      src.loopStart=smp.loopStart/this.ctx.sampleRate;
      src.loopEnd=(smp.loopStart+smp.loopLen)/this.ctx.sampleRate;
    }
    const g=this.ctx.createGain();g.gain.value=smp.vol/64;
    g.connect(this.previewGain);src.connect(g);
    src.playbackRate.value=(PAL_CLOCK/(2*period))/this.ctx.sampleRate;
    src.start();
    setTimeout(()=>{
      g.gain.linearRampToValueAtTime(0,this.ctx.currentTime+0.1);
      setTimeout(()=>{try{src.stop()}catch(e){}},150);
    },250);
  }
  _loop(){
    if(!this.isPlaying)return;
    while(this.nextNoteTime<this.ctx.currentTime+this.lookahead){
      this._processTick(this.nextNoteTime);
      this.nextNoteTime+=2.5/this.bpm;
    }
    requestAnimationFrame(this._loop);
  }
  _processTick(time){
    const tracker=state.tracker;
    const pi=this.mod.patternOrder[tracker.orderIdx];
    const pat=this.mod.patterns[pi];
    if(this.tick===0){
      if(pat&&pat[this.row]) this._processRow(pat[this.row],time);
      const t=time;
      setTimeout(()=>{
        if(this.isPlaying){state.editor.cursorRow=this.row;uiUpdate();uiRenderPattern()}
      },(t-this.ctx.currentTime)*1000);
    }
    this._processEffects(time);
    this.tick++;
    if(this.tick>=this.speed){
      this.tick=0;this.row++;
      if(this.breakPat){
        tracker.orderIdx=this.jumpOrd!==-1?this.jumpOrd:tracker.orderIdx+1;
        this.row=this.nextRow;this.breakPat=false;this.jumpOrd=-1;this.nextRow=0;
      }else if(this.jumpOrd!==-1){
        tracker.orderIdx=this.jumpOrd;this.row=0;this.jumpOrd=-1;
      }
      if(this.row>=64){this.row=0;tracker.orderIdx++}
      if(tracker.orderIdx>=this.mod.songLen){
        if(this.onSongEnd){this.stop();this.onSongEnd();return}
        tracker.orderIdx=0;
      }
    }
  }
  _processRow(rowData,time){
    const tracker=state.tracker;
    rowData.forEach((note,ci)=>{
      const ch=this.channels[ci];
      const eff=note.effect,par=note.param;
      if(note.sample>0&&note.sample<=this.mod.samples.length){
        ch.sampleIdx=note.sample-1;
        const si=this.mod.samples[ch.sampleIdx];
        if(si){ch.volume=si.vol;ch.finetune=si.finetune}
      }
      if(note.period>0){
        if(eff===3||eff===5){ch.portDest=note.period}
        else{
          ch.period=note.period;ch.arpBase=note.period;
          ch.vibPos=0;ch.tremPos=0;
          if(!this.muted[ci]) this._trigger(ch,time,eff===9?par:0);
        }
      }
      switch(eff){
        case 0x8:ch.panner.pan.setValueAtTime(((par&0xFF)/128)-1,time);break;
        case 0xC:ch.volume=Math.min(64,par);break;
        case 0xF:if(par<32)this.speed=par||1;else this.bpm=par;break;
        case 0xB:this.jumpOrd=par;this.breakPat=true;this.nextRow=0;break;
        case 0xD:this.breakPat=true;this.nextRow=(par>>4)*10+(par&0x0F);break;
        case 3:if(par>0)ch.portSpeed=par;break;
        case 4:if(par&0x0F)ch.vibDepth=par&0x0F;if(par>>4)ch.vibSpeed=par>>4;break;
        case 7:if(par&0x0F)ch.tremDepth=par&0x0F;if(par>>4)ch.tremSpeed=par>>4;break;
        case 0xE:this._processExtended(ch,par,time,ci);break;
      }
      if(ch.gain&&!this.muted[ci]) ch.gain.gain.setValueAtTime(ch.volume/64,time);
      else if(ch.gain&&this.muted[ci]) ch.gain.gain.setValueAtTime(0,time);
    });
  }
  _processExtended(ch,par,time,ci){
    const cmd=par>>4,val=par&0x0F;
    switch(cmd){
      case 0x1:ch.period=Math.max(113,ch.period-val);break;
      case 0x2:ch.period=Math.min(856,ch.period+val);break;
      case 0x6:
        if(val===0) this.patLoop.row=this.row;
        else{
          if(this.patLoop.count===0) this.patLoop.count=val;
          else this.patLoop.count--;
          if(this.patLoop.count>0){this.breakPat=true;this.nextRow=this.patLoop.row}
        }
        break;
      case 0x9:ch.retrigInterval=val;ch.retrigCount=0;break;
      case 0xA:ch.volume=Math.min(64,ch.volume+val);break;
      case 0xB:ch.volume=Math.max(0,ch.volume-val);break;
      case 0xC:ch.cutTick=val;break;
      case 0xD:ch.delayTick=val;break;
    }
  }
  _processEffects(time){
    const tracker=state.tracker;
    this.channels.forEach(ch=>{
      if(!ch.source)return;
      const pi=this.mod.patternOrder[tracker.orderIdx];
      if(!this.mod.patterns[pi]||!this.mod.patterns[pi][this.row])return;
      const note=this.mod.patterns[pi][this.row][ch.idx];if(!note)return;
      const cmd=note.effect,par=note.param;
      let cp=ch.period;

      if(cmd===0&&par>0){
        const t=this.tick%3;
        let ofs=0;
        if(t===1) ofs=par>>4;
        if(t===2) ofs=par&0x0F;
        if(ofs>0){
          const bi=periodToNoteIdx(ch.arpBase);
          if(bi>=0){
            const ni=Math.min(PERIOD_TABLE.length-1,bi+ofs);
            this._setFreq(ch,time,PERIOD_TABLE[ni]);
          }
        } else this._setFreq(ch,time,ch.arpBase);
        return;
      }
      if(cmd===1&&this.tick>0){ch.period=Math.max(113,ch.period-par);cp=ch.period}
      if(cmd===2&&this.tick>0){ch.period=Math.min(856,ch.period+par);cp=ch.period}
      if((cmd===3||cmd===5)&&this.tick>0&&ch.portDest>0){
        if(ch.period<ch.portDest) ch.period=Math.min(ch.portDest,ch.period+ch.portSpeed);
        else if(ch.period>ch.portDest) ch.period=Math.max(ch.portDest,ch.period-ch.portSpeed);
        cp=ch.period;
      }
      if((cmd===4||cmd===6)&&this.tick>0){
        ch.vibPos=(ch.vibPos+ch.vibSpeed)&63;
        cp+=SINE_TBL[ch.vibPos]*ch.vibDepth*2;
      }
      if(cmd===7&&this.tick>0){
        ch.tremPos=(ch.tremPos+ch.tremSpeed)&63;
        const tv=ch.volume+SINE_TBL[ch.tremPos]*ch.tremDepth;
        if(ch.gain) ch.gain.gain.setValueAtTime(Math.max(0,Math.min(64,tv))/64,time);
      }
      this._setFreq(ch,time,cp);
      if((cmd===0xA||cmd===5||cmd===6)&&this.tick>0){
        const up=par>>4,dn=par&0x0F;
        if(up) ch.volume=Math.min(64,ch.volume+up);
        else if(dn) ch.volume=Math.max(0,ch.volume-dn);
        if(ch.gain) ch.gain.gain.setValueAtTime(ch.volume/64,time);
      }
      if(cmd===0xE&&(par>>4)===0xC){
        if(this.tick===(par&0x0F)){
          ch.volume=0;
          if(ch.gain) ch.gain.gain.setValueAtTime(0,time);
        }
      }
      if(cmd===0xE&&(par>>4)===9){
        const interval=par&0x0F;
        if(interval>0&&this.tick>0&&(this.tick%interval)===0){
          this._trigger(ch,time,0);
        }
      }
    });
  }
  _trigger(ch,time,ofsIdx){
    if(ch.sampleIdx<0)return;
    const buf=this.audioBuffers[ch.sampleIdx];if(!buf)return;
    if(ch.source){try{ch.source.stop(time)}catch(e){}}
    const src=this.ctx.createBufferSource();src.buffer=buf;
    const smp=this.mod.samples[ch.sampleIdx];
    if(smp.loopLen>2){
      src.loop=true;
      src.loopStart=smp.loopStart/this.ctx.sampleRate;
      src.loopEnd=(smp.loopStart+smp.loopLen)/this.ctx.sampleRate;
    }
    const g=this.ctx.createGain();
    g.gain.value=this.muted[ch.idx]?0:ch.volume/64;
    src.connect(g);g.connect(ch.analyser);
    this._setFreq(ch,time,ch.period);
    ch.source=src;ch.gain=g;
    src.start(time,ofsIdx>0?(ofsIdx*256)/this.ctx.sampleRate:0);
  }
  _setFreq(ch,time,period){
    if(period<1||!ch.source)return;
    ch.source.playbackRate.setValueAtTime((PAL_CLOCK/(2*period))/this.ctx.sampleRate,time);
  }
}
