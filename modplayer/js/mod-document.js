"use strict";

export class ModDocument{
  constructor(ch=4){
    this.songName="NEW MODULE";this.channels=ch;
    this.samples=[];this.sampleData=[];
    for(let i=0;i<31;i++){
      this.samples.push({name:"",len:0,finetune:0,vol:64,loopStart:0,loopLen:0});
      this.sampleData.push(new Float32Array(0));
    }
    this.songLen=1;this.restartPos=0;
    this.patternOrder=new Uint8Array(128);
    this.patterns=[this._emptyPat()];
  }
  _emptyPat(){
    const rows=[];
    for(let r=0;r<64;r++){
      const row=[];
      for(let c=0;c<this.channels;c++) row.push({sample:0,period:0,effect:0,param:0});
      rows.push(row);
    }
    return rows;
  }
  addPattern(){this.patterns.push(this._emptyPat());return this.patterns.length-1}
  getNote(p,r,c){
    if(p>=this.patterns.length||r>=64||c>=this.channels)return null;
    return this.patterns[p][r][c];
  }
  setNote(p,r,c,n){
    if(p>=this.patterns.length||r>=64||c>=this.channels)return;
    this.patterns[p][r][c]={...n};
  }
  clonePattern(idx){
    if(idx>=this.patterns.length)return-1;
    const src=this.patterns[idx];
    const dst=[];
    for(let r=0;r<64;r++){
      const row=[];
      for(let c=0;c<this.channels;c++) row.push({...src[r][c]});
      dst.push(row);
    }
    this.patterns.push(dst);
    return this.patterns.length-1;
  }
}
