"use strict";

import { PERIOD_TABLE, periodToNoteIdx } from './constants.js';

export class Clipboard{
  constructor(){this.data=null;this.rows=0;this.channels=1}
  copy(mod,patIdx,rowStart,rowEnd,chStart,chEnd){
    if(!mod)return;
    const pat=mod.patterns[patIdx];if(!pat)return;
    const r0=Math.max(0,Math.min(rowStart,rowEnd));
    const r1=Math.min(63,Math.max(rowStart,rowEnd));
    const c0=Math.max(0,Math.min(chStart,chEnd));
    const c1=Math.min(mod.channels-1,Math.max(chStart,chEnd));
    this.data=[];this.rows=r1-r0+1;this.channels=c1-c0+1;
    for(let r=r0;r<=r1;r++){
      const row=[];
      for(let c=c0;c<=c1;c++) row.push({...pat[r][c]});
      this.data.push(row);
    }
  }
  paste(mod,patIdx,rowStart,chStart){
    if(!mod||!this.data)return;
    const pat=mod.patterns[patIdx];if(!pat)return;
    for(let r=0;r<this.data.length;r++){
      const tr=rowStart+r;if(tr>=64)break;
      for(let c=0;c<this.data[r].length;c++){
        const tc=chStart+c;if(tc>=mod.channels)break;
        pat[tr][tc]={...this.data[r][c]};
      }
    }
  }
  cut(mod,patIdx,rowStart,rowEnd,chStart,chEnd){
    this.copy(mod,patIdx,rowStart,rowEnd,chStart,chEnd);
    if(!mod)return;
    const pat=mod.patterns[patIdx];if(!pat)return;
    const r0=Math.max(0,Math.min(rowStart,rowEnd));
    const r1=Math.min(63,Math.max(rowStart,rowEnd));
    const c0=Math.max(0,Math.min(chStart,chEnd));
    const c1=Math.min(mod.channels-1,Math.max(chStart,chEnd));
    for(let r=r0;r<=r1;r++)
      for(let c=c0;c<=c1;c++) pat[r][c]={sample:0,period:0,effect:0,param:0};
  }
}

export function transpose(mod,patIdx,r0,r1,c0,c1,semitones){
  if(!mod)return;
  const pat=mod.patterns[patIdx];if(!pat)return;
  for(let r=r0;r<=r1;r++){
    for(let c=c0;c<=c1;c++){
      const n=pat[r][c];
      if(n.period<=0)continue;
      const idx=periodToNoteIdx(n.period);
      if(idx<0)continue;
      const ni=Math.max(0,Math.min(PERIOD_TABLE.length-1,idx+semitones));
      n.period=PERIOD_TABLE[ni];
    }
  }
}
