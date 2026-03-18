"use strict";

import { noteStr } from './constants.js';
import state from './state.js';

export function resetVU(n){state.vuLevels=new Array(n).fill(0);state.vuBufs=new Array(n).fill(null)}

export function sampleVU(){
  const decay=0.88;
  const player=state.player;
  if(!player||!player.analysers||player.analysers.length===0){
    state.vuLevels=state.vuLevels.map(v=>v*decay);return;
  }
  player.analysers.forEach((a,i)=>{
    if(!state.vuBufs[i]||state.vuBufs[i].length!==a.fftSize) state.vuBufs[i]=new Uint8Array(a.fftSize);
    a.getByteTimeDomainData(state.vuBufs[i]);
    let sum=0;
    for(let j=0;j<state.vuBufs[i].length;j++){const v=(state.vuBufs[i][j]-128)/128;sum+=v*v}
    const rms=Math.sqrt(sum/state.vuBufs[i].length);
    const lvl=Math.min(1,rms*3.5);
    state.vuLevels[i]=Math.max(lvl,(state.vuLevels[i]||0)*decay);
  });
}

export function resizeCanvas(){
  state.canvas.width=state.canvas.parentElement.clientWidth;
  state.canvas.height=state.canvas.parentElement.clientHeight;
  uiRenderPattern();
}

export function showStatus(msg,color='#0f0'){
  const el=document.getElementById('statusMsg');if(!el)return;
  const editor=state.editor;
  el.textContent=msg;el.style.color=color;
  setTimeout(()=>{
    if(el.textContent===msg){
      el.textContent=editor.editMode?'EDIT MODE':'READY';
      el.style.color=editor.editMode?'#ff8800':'#22cc66';
    }
  },3000);
}

export function uiUpdate(){
  const m=state.tracker.mod;
  const editor=state.editor;
  const player=state.player;
  document.getElementById('dPos').textContent=state.tracker.orderIdx.toString().padStart(2,'0');
  document.getElementById('dPat').textContent=m?m.patternOrder[state.tracker.orderIdx].toString().padStart(2,'0'):'00';
  document.getElementById('dRow').textContent=editor.cursorRow.toString().padStart(2,'0');
  document.getElementById('dChn').textContent=(editor.cursorChannel+1).toString();
  document.getElementById('dSpd').textContent=(player?.speed||6).toString().padStart(2,'0');
  document.getElementById('dBpm').textContent=(player?.bpm||125).toString();
  document.getElementById('dOct').textContent=editor.currentOctave.toString();
  document.getElementById('dStp').textContent=editor.stepValue.toString();
  document.getElementById('currentSampleNum').textContent=editor.currentSample.toString().padStart(2,'0');
  const ei=document.getElementById('editInd');
  if(editor.editMode){ei.textContent="\u25cf EDIT MODE";ei.className="edit-indicator edit-on"}
  else{ei.textContent="PLAY MODE";ei.className="edit-indicator edit-off"}
  const sel=editor.getSelection();
  const si=document.getElementById('selInfo');
  if(sel){si.textContent=`SEL: R${sel.r0}-${sel.r1} CH${sel.c0+1}-${sel.c1+1}`}
  else{si.textContent=''}
}

export function uiUpdateSampleList(){
  const m=state.tracker.mod,lst=document.getElementById('sampleList');
  const editor=state.editor;
  lst.innerHTML='';
  for(let i=0;i<31;i++){
    const s=m?m.samples[i]:{name:'',len:0,vol:64};
    const hex=(i+1).toString(16).toUpperCase().padStart(2,'0');
    const d=document.createElement('div');
    d.className='sample-row'+(i+1===editor.currentSample?' selected':'')+(s.len>0?' has-data':'');
    const nm=(s.name||'').replace(/\0/g,'').padEnd(22,' ').substring(0,22);
    const ln=s.len>0?(s.len>9999?Math.floor(s.len/1000)+'K':s.len.toString()).padStart(5,' '):'    -';
    d.textContent=`${hex}: ${nm} ${ln}`;
    d.onclick=()=>{
      editor.currentSample=i+1;
      if(state.smpEditor) state.smpEditor.select(i);
      uiUpdateSampleList();uiUpdate();
    };
    lst.appendChild(d);
  }
}

export function uiUpdateOrderList(){
  const m=state.tracker.mod,c=document.getElementById('orderDisplay');
  c.innerHTML='';if(!m)return;
  document.getElementById('songLenD').textContent=m.songLen.toString().padStart(2,'0');
  for(let i=0;i<m.songLen;i++){
    const d=document.createElement('div');
    d.className='order-item'+(i===state.tracker.orderIdx?' current':'');
    d.textContent=m.patternOrder[i].toString().padStart(2,'0');
    d.onclick=()=>{state.tracker.orderIdx=i;uiUpdateOrderList();uiUpdate();uiRenderPattern()};
    c.appendChild(d);
  }
}

export function uiCreateScopes(n){
  const c=document.getElementById('scopeBox');c.innerHTML='';
  for(let i=0;i<n;i++){
    const cv=document.createElement('canvas');cv.className='scope-canv';
    cv.width=120;cv.height=60;cv.id='scope'+i;c.appendChild(cv);
  }
}

export function uiCreateMuteStrip(n){
  const c=document.getElementById('muteStrip');c.innerHTML='';
  const player=state.player;
  for(let i=0;i<n;i++){
    const b=document.createElement('div');
    b.className='mute-btn'+(player?.muted[i]?' muted':'');
    b.textContent='CH'+(i+1);
    b.onclick=()=>{
      if(state.player){state.player.toggleMute(i);uiUpdateMuteStrip()}
    };
    b.oncontextmenu=e=>{
      e.preventDefault();
      if(state.player){state.player.soloChannel(i);uiUpdateMuteStrip()}
    };
    c.appendChild(b);
  }
}

export function uiUpdateMuteStrip(){
  if(!state.player)return;
  const btns=document.querySelectorAll('.mute-btn');
  btns.forEach((b,i)=>{
    b.className='mute-btn'+(state.player.muted[i]?' muted':'');
  });
}

export function uiScopeLoop(){
  requestAnimationFrame(uiScopeLoop);
  const player=state.player;
  const editor=state.editor;
  if(!player||!player.analysers)return;
  player.analysers.forEach((ana,i)=>{
    const cv=document.getElementById('scope'+i);if(!cv)return;
    const cx=cv.getContext('2d'),w=cv.width,h=cv.height;
    const data=new Uint8Array(ana.fftSize);
    ana.getByteTimeDomainData(data);
    cx.fillStyle='#000';cx.fillRect(0,0,w,h);
    cx.strokeStyle='#0a1a0a';cx.lineWidth=1;cx.beginPath();cx.moveTo(0,h/2);cx.lineTo(w,h/2);cx.stroke();
    const muted=player.muted[i];
    if(muted){cx.fillStyle='rgba(80,0,0,.3)';cx.fillRect(0,0,w,h)}
    const color=muted?'#553333':i===editor.cursorChannel?'#00ff88':'#00aa44';
    cx.lineWidth=1.5;cx.strokeStyle=color;cx.shadowBlur=3;cx.shadowColor=color;
    cx.beginPath();
    const sw=w/data.length;let x=0;
    let si=0;
    for(let j=0;j<data.length-1;j++){if(data[j]<128&&data[j+1]>=128){si=j;break}}
    for(let j=0;j<data.length;j++){
      const v=data[(si+j)%data.length]/128.0;
      const y=v*h/2;
      j===0?cx.moveTo(x,y):cx.lineTo(x,y);x+=sw;
    }
    cx.stroke();cx.shadowBlur=0;
    cx.fillStyle=i===editor.cursorChannel?'rgba(255,255,100,.6)':'rgba(255,255,255,.3)';
    cx.font='11px VT323';cx.fillText('CH'+(i+1),3,11);
  });
}

export function uiRenderPattern(){
  const m=state.tracker.mod;
  const canvas=state.canvas,ctx=state.ctx;
  const editor=state.editor,player=state.player;
  const w=canvas.width,h=canvas.height;
  ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
  if(!m){
    ctx.fillStyle='#334';ctx.font='18px VT323';ctx.textAlign='center';
    ctx.fillText('CLICK TO START \u2014 SPACE FOR EDIT MODE',w/2,h/2);
    ctx.textAlign='left';return;
  }
  const pi=m.patternOrder[state.tracker.orderIdx];
  const rows=m.patterns[pi];if(!rows)return;
  const rh=17,cy=Math.floor(h/2),vis=Math.ceil(h/rh)+2,half=Math.floor(vis/2);
  ctx.font='15px VT323';
  const rnw=28,chw=(w-rnw)/m.channels;
  const nw=28,sw=20;
  const sel=editor.getSelection();
  sampleVU();

  for(let r=-half;r<=half;r++){
    const ar=editor.cursorRow+r,y=cy+(r*rh);
    if(ar<0||ar>=64)continue;
    const rd=rows[ar];

    if(ar%16===0){ctx.fillStyle=r===0?'rgba(40,60,100,.2)':'rgba(20,35,60,.15)';ctx.fillRect(0,y-rh/2+2,w,rh)}
    else if(ar%4===0){ctx.fillStyle=r===0?'rgba(25,40,70,.15)':'rgba(15,25,45,.1)';ctx.fillRect(0,y-rh/2+2,w,rh)}

    if(r===0){ctx.fillStyle='rgba(0,85,170,.2)';ctx.fillRect(0,y-rh/2+2,w,rh)}

    if(sel&&ar>=sel.r0&&ar<=sel.r1){
      for(let c=sel.c0;c<=sel.c1;c++){
        const sx=rnw+c*chw;
        ctx.fillStyle='rgba(100,150,255,.12)';
        ctx.fillRect(sx,y-rh/2+2,chw,rh);
      }
    }

    const isQtr=ar%4===0;
    ctx.fillStyle=r===0?'#88bbff':isQtr?'#5577aa':'#2a3a55';
    ctx.fillText(ar.toString(16).toUpperCase().padStart(2,'0'),3,y+5);

    rd.forEach((cell,ch)=>{
      const x=rnw+ch*chw;
      const isCur=ch===editor.cursorChannel&&r===0;

      if(isCur&&editor.editMode){
        ctx.fillStyle='rgba(255,200,0,.2)';
        const positions=[
          [x+2,nw],[x+nw+2,10],[x+nw+12,10],
          [x+nw+sw+4,10],[x+nw+sw+14,10],[x+nw+sw+24,10]
        ];
        const [cx2,cw]=positions[editor.cursorColumn]||positions[0];
        ctx.fillRect(cx2,y-rh/2+3,cw,rh-2);
      }

      const muted=player?.muted[ch];

      const ns=noteStr(cell.period);
      if(ns!=='---'){
        const c1=isCur?'#ffdd00':r===0?'#ccaa00':'#776600';
        ctx.fillStyle=muted?'#443300':c1;
      } else ctx.fillStyle=muted?'#111':'#1a2233';
      ctx.fillText(ns,x+3,y+5);

      const ss=cell.sample>0?cell.sample.toString(16).toUpperCase().padStart(2,'0'):'--';
      ctx.fillStyle=cell.sample>0?(isCur?'#aaccff':r===0?'#6699cc':'#334466'):'#151a25';
      if(muted&&cell.sample>0) ctx.fillStyle='#223';
      ctx.fillText(ss,x+nw+3,y+5);

      const hasEff=cell.effect>0||cell.param>0;
      const es=cell.effect.toString(16).toUpperCase()+cell.param.toString(16).toUpperCase().padStart(2,'0');
      if(hasEff){
        ctx.fillStyle=isCur?'#ff8866':r===0?'#cc6644':'#553322';
        if(muted) ctx.fillStyle='#332211';
      } else ctx.fillStyle='#0e1118';
      ctx.fillText(es,x+nw+sw+5,y+5);

      if(ch<m.channels-1){
        ctx.strokeStyle='#151a28';ctx.beginPath();
        ctx.moveTo(x+chw-1,y-rh/2);ctx.lineTo(x+chw-1,y+rh/2);ctx.stroke();
      }
    });
  }

  // VU meters
  const mBase=cy+rh/2-2,mTop=22,mRange=Math.max(6,mBase-mTop);
  const mw=Math.min(10,chw-14);
  for(let ch=0;ch<m.channels;ch++){
    const lvl=state.vuLevels[ch]||0;if(lvl<=0.01||player?.muted[ch])continue;
    const bh=Math.max(2,lvl*mRange);
    const x=rnw+ch*chw+chw/2-mw/2,y=mBase-bh;
    const g=ctx.createLinearGradient(0,y,0,y+bh);
    g.addColorStop(0,'rgba(255,60,0,.85)');
    g.addColorStop(0.5,'rgba(255,180,0,.8)');
    g.addColorStop(1,'rgba(0,180,40,.75)');
    ctx.fillStyle=g;ctx.fillRect(x,y,mw,bh);
  }

  // Channel headers
  ctx.fillStyle='#060a14';ctx.fillRect(0,0,w,18);
  ctx.font='13px VT323';
  for(let ch=0;ch<m.channels;ch++){
    const x=rnw+ch*chw+chw/2-22;
    const muted=player?.muted[ch];
    ctx.fillStyle=muted?'#553333':'#5577aa';
    ctx.fillText(`CH ${ch+1}${muted?' [M]':''}`,x,13);
  }
}
