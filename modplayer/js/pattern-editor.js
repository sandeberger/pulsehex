"use strict";

import { PERIOD_TABLE } from './constants.js';
import state from './state.js';

export class PatternEditor{
  constructor(){
    this.cursorRow=0;this.cursorChannel=0;this.cursorColumn=0;
    this.editMode=false;this.currentOctave=2;this.currentSample=1;this.stepValue=1;
    this.selActive=false;this.selStartRow=-1;this.selEndRow=-1;
    this.selStartCh=-1;this.selEndCh=-1;
  }
  toggleEdit(){this.editMode=!this.editMode;return this.editMode}
  moveCursor(dr,dc,dcol){
    this.cursorRow=Math.max(0,Math.min(63,this.cursorRow+dr));
    this.cursorChannel=Math.max(0,Math.min((state.tracker.mod?.channels||4)-1,this.cursorChannel+dc));
    const mx=5;let nc=this.cursorColumn+dcol;
    if(nc>mx){nc=0;this.cursorChannel=Math.min((state.tracker.mod?.channels||4)-1,this.cursorChannel+1)}
    else if(nc<0){nc=mx;this.cursorChannel=Math.max(0,this.cursorChannel-1)}
    this.cursorColumn=nc;
  }
  advanceRow(){this.cursorRow=(this.cursorRow+this.stepValue)%64}
  startSelection(){
    if(!this.selActive){this.selActive=true;this.selStartRow=this.cursorRow;this.selStartCh=this.cursorChannel}
    this.selEndRow=this.cursorRow;this.selEndCh=this.cursorChannel;
  }
  clearSelection(){this.selActive=false;this.selStartRow=-1;this.selEndRow=-1;this.selStartCh=-1;this.selEndCh=-1}
  getSelection(){
    if(!this.selActive)return null;
    return{
      r0:Math.min(this.selStartRow,this.selEndRow),
      r1:Math.max(this.selStartRow,this.selEndRow),
      c0:Math.min(this.selStartCh,this.selEndCh),
      c1:Math.max(this.selStartCh,this.selEndCh)
    };
  }
  inputNote(noteOfs,mod){
    if(!this.editMode||!mod)return null;
    const pi=mod.patternOrder[state.tracker.orderIdx];
    const n=mod.getNote(pi,this.cursorRow,this.cursorChannel);if(!n)return null;
    const ni=(this.currentOctave-1)*12+noteOfs;
    if(ni<0||ni>=PERIOD_TABLE.length)return null;
    n.period=PERIOD_TABLE[ni];n.sample=this.currentSample;
    mod.setNote(pi,this.cursorRow,this.cursorChannel,n);
    this.advanceRow();
    return{period:n.period,sample:this.currentSample};
  }
  inputHex(ch,mod){
    if(!this.editMode||!mod)return;
    const v=parseInt(ch,16);if(isNaN(v))return;
    const pi=mod.patternOrder[state.tracker.orderIdx];
    const n=mod.getNote(pi,this.cursorRow,this.cursorChannel);if(!n)return;
    switch(this.cursorColumn){
      case 1:n.sample=(v<<4)|(n.sample&0x0F);break;
      case 2:n.sample=(n.sample&0xF0)|v;break;
      case 3:n.effect=v;break;
      case 4:n.param=(v<<4)|(n.param&0x0F);break;
      case 5:n.param=(n.param&0xF0)|v;break;
    }
    mod.setNote(pi,this.cursorRow,this.cursorChannel,n);
    if(this.cursorColumn===2||this.cursorColumn===5) this.advanceRow();
    else if(this.cursorColumn>=1) this.cursorColumn++;
  }
  clearNote(mod){
    if(!this.editMode||!mod)return;
    const pi=mod.patternOrder[state.tracker.orderIdx];
    const n=mod.getNote(pi,this.cursorRow,this.cursorChannel);if(!n)return;
    if(this.cursorColumn===0){n.period=0;n.sample=0}
    else if(this.cursorColumn<=2) n.sample=0;
    else{n.effect=0;n.param=0}
    mod.setNote(pi,this.cursorRow,this.cursorChannel,n);
  }
  deleteAndPull(mod){
    if(!this.editMode||!mod)return;
    const pi=mod.patternOrder[state.tracker.orderIdx],pat=mod.patterns[pi];
    for(let r=this.cursorRow;r<63;r++) pat[r][this.cursorChannel]={...pat[r+1][this.cursorChannel]};
    pat[63][this.cursorChannel]={sample:0,period:0,effect:0,param:0};
  }
  insertRow(mod){
    if(!this.editMode||!mod)return;
    const pi=mod.patternOrder[state.tracker.orderIdx],pat=mod.patterns[pi];
    for(let r=63;r>this.cursorRow;r--) pat[r][this.cursorChannel]={...pat[r-1][this.cursorChannel]};
    pat[this.cursorRow][this.cursorChannel]={sample:0,period:0,effect:0,param:0};
  }
}
