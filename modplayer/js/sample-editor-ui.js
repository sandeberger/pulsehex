"use strict";

import state from './state.js';
import { smpLoader } from './sample-loader.js';
import { showStatus, uiUpdateSampleList } from './ui.js';

export class SampleEditorUI{
  constructor(){
    this.cvs=document.getElementById('waveformCanvas');
    this.cx=this.cvs.getContext('2d');
    this.selIdx=0;this.dragging=false;this.dragType=null;
    this._setupEvents();
  }
  _setupEvents(){
    const box=document.getElementById('waveformBox');
    new ResizeObserver(()=>{this.cvs.width=box.clientWidth;this.cvs.height=box.clientHeight;this.render()}).observe(box);
    document.getElementById('sampleFileInput').addEventListener('change',e=>{if(e.target.files[0])this.loadFile(e.target.files[0])});
    const dz=document.getElementById('sampleDropZone');
    dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag-over')});
    dz.addEventListener('dragleave',()=>dz.classList.remove('drag-over'));
    dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('drag-over');if(e.dataTransfer.files[0])this.loadFile(e.dataTransfer.files[0])});
    ['sampleNameInput','smpVol','smpFine','smpLpS','smpLpL'].forEach(id=>{
      document.getElementById(id).addEventListener('change',()=>this._syncParams())
    });
    this.cvs.addEventListener('dblclick',()=>this.preview());
  }
  async loadFile(file){
    const mod=state.tracker.mod;if(!mod){showStatus('NO MODULE!','#f00');return}
    showStatus('LOADING...','#ff0');
    try{
      const r=await smpLoader.load(file);
      const i=state.editor.currentSample-1;
      mod.samples[i]={name:r.name,len:r.data.length,finetune:0,vol:64,loopStart:0,loopLen:0};
      mod.sampleData[i]=r.data;
      if(state.player&&state.audioCtx){
        const buf=state.audioCtx.createBuffer(1,r.data.length,state.audioCtx.sampleRate);
        buf.copyToChannel(r.data,0);state.player.audioBuffers[i]=buf;
      }
      this.select(i);uiUpdateSampleList();
      showStatus('LOADED: '+r.name.substring(0,12).toUpperCase(),'#0f0');
    }catch(e){showStatus('LOAD ERROR!','#f00');console.error(e)}
  }
  select(idx){
    this.selIdx=idx;state.editor.currentSample=idx+1;
    const mod=state.tracker.mod;if(!mod)return;
    const s=mod.samples[idx];
    document.getElementById('sampleNameInput').value=s.name||'';
    document.getElementById('smpVol').value=s.vol;
    document.getElementById('smpFine').value=s.finetune;
    document.getElementById('smpLpS').value=s.loopStart;
    document.getElementById('smpLpL').value=s.loopLen;
    document.getElementById('smpLenD').textContent=s.len;
    document.getElementById('smpLoopD').textContent=s.loopLen>2?'ON':'OFF';
    document.getElementById('currentSampleNum').textContent=(idx+1).toString().padStart(2,'0');
    this.render();
  }
  _syncParams(){
    const mod=state.tracker.mod;if(!mod)return;
    const i=state.editor.currentSample-1;
    mod.samples[i].name=document.getElementById('sampleNameInput').value;
    mod.samples[i].vol=parseInt(document.getElementById('smpVol').value)||0;
    mod.samples[i].finetune=parseInt(document.getElementById('smpFine').value)||0;
    mod.samples[i].loopStart=parseInt(document.getElementById('smpLpS').value)||0;
    mod.samples[i].loopLen=parseInt(document.getElementById('smpLpL').value)||0;
    document.getElementById('smpLoopD').textContent=mod.samples[i].loopLen>2?'ON':'OFF';
    uiUpdateSampleList();this.render();
  }
  render(){
    const w=this.cvs.width,h=this.cvs.height,cx=this.cx;
    cx.fillStyle='#000';cx.fillRect(0,0,w,h);
    cx.strokeStyle='#112';cx.beginPath();cx.moveTo(0,h/2);cx.lineTo(w,h/2);cx.stroke();
    const mod=state.tracker.mod;if(!mod)return;
    const d=mod.sampleData[this.selIdx];
    if(!d||!d.length){
      cx.fillStyle='#334';cx.font='13px VT323';cx.textAlign='center';
      cx.fillText('NO SAMPLE',w/2,h/2);cx.textAlign='left';return;
    }
    const smp=mod.samples[this.selIdx];
    cx.strokeStyle='#00cc44';cx.lineWidth=1;cx.beginPath();
    const step=d.length/w;
    for(let x=0;x<w;x++){
      const y=(1-d[Math.floor(x*step)])*h/2;
      x===0?cx.moveTo(x,y):cx.lineTo(x,y);
    }
    cx.stroke();
    if(smp.loopLen>2){
      const lsx=(smp.loopStart/d.length)*w,lex=((smp.loopStart+smp.loopLen)/d.length)*w;
      cx.fillStyle='rgba(0,100,0,.18)';cx.fillRect(lsx,0,lex-lsx,h);
      cx.strokeStyle='#0f0';cx.lineWidth=2;cx.beginPath();cx.moveTo(lsx,0);cx.lineTo(lsx,h);cx.stroke();
      cx.strokeStyle='#f00';cx.beginPath();cx.moveTo(lex,0);cx.lineTo(lex,h);cx.stroke();
      cx.fillStyle='#0f0';cx.font='9px VT323';cx.fillText('LS',lsx+2,9);
      cx.fillStyle='#f00';cx.fillText('LE',lex+2,9);
    }
  }
  preview(){
    if(!state.player||!state.audioCtx)return;
    state.player.previewNote(state.editor.currentSample,428);
  }
}
