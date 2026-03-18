"use strict";

export class UndoManager{
  constructor(maxSize=100){this.stack=[];this.idx=-1;this.max=maxSize}
  push(state){
    this.stack.length=this.idx+1;
    this.stack.push(state);
    if(this.stack.length>this.max) this.stack.shift();
    this.idx=this.stack.length-1;
  }
  undo(){
    if(this.idx<=0)return null;
    this.idx--;
    return this.stack[this.idx];
  }
  redo(){
    if(this.idx>=this.stack.length-1)return null;
    this.idx++;
    return this.stack[this.idx];
  }
  snapPattern(mod,patIdx){
    if(!mod||patIdx>=mod.patterns.length)return;
    const pat=mod.patterns[patIdx];
    const snap=[];
    for(let r=0;r<64;r++){
      const row=[];
      for(let c=0;c<mod.channels;c++) row.push({...pat[r][c]});
      snap.push(row);
    }
    this.push({type:'pattern',patIdx,data:snap});
  }
  restore(mod,st){
    if(!mod||!st)return false;
    if(st.type==='pattern'){
      if(st.patIdx>=mod.patterns.length)return false;
      mod.patterns[st.patIdx]=st.data;
      return true;
    }
    return false;
  }
}
