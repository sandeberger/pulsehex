"use strict";

import { ModDocument } from './mod-document.js';

export class ModParser{
  constructor(buf){this.v=new DataView(buf);this.o=0}
  str(n){let s="";for(let i=0;i<n;i++){const c=this.v.getUint8(this.o++);if(c)s+=String.fromCharCode(c)}return s}
  u16(){const v=this.v.getUint16(this.o);this.o+=2;return v}
  u8(){return this.v.getUint8(this.o++)}
  parse(){
    if(this.v.byteLength<1084)throw new Error("Too small");
    const doc=new ModDocument();
    doc.songName=this.str(20);
    for(let i=0;i<31;i++){
      const name=this.str(22),len=this.u16()*2,ft=this.u8(),vol=this.u8(),
            ls=this.u16()*2,ll=this.u16()*2;
      doc.samples[i]={name,len,finetune:ft>7?ft-16:ft,vol:Math.min(64,vol),loopStart:ls,loopLen:ll};
    }
    doc.songLen=this.u8();doc.restartPos=this.u8();
    let maxP=0;
    for(let i=0;i<128;i++){doc.patternOrder[i]=this.u8();if(doc.patternOrder[i]>maxP)maxP=doc.patternOrder[i]}
    const sig=this.str(4);
    doc.channels=sig==="6CHN"?6:sig==="8CHN"?8:4;
    doc.patterns=[];
    for(let p=0;p<=maxP;p++){
      const rows=[];
      for(let r=0;r<64;r++){
        const rd=[];
        for(let c=0;c<doc.channels;c++){
          if(this.o>=this.v.byteLength)break;
          const b0=this.u8(),b1=this.u8(),b2=this.u8(),b3=this.u8();
          rd.push({sample:(b0&0xF0)|(b2>>4),period:((b0&0x0F)<<8)|b1,effect:b2&0x0F,param:b3});
        }
        rows.push(rd);
      }
      doc.patterns.push(rows);
    }
    doc.sampleData=[];
    for(let i=0;i<31;i++){
      const s=doc.samples[i];
      if(s.len>0&&this.o+s.len<=this.v.byteLength){
        const f=new Float32Array(s.len);
        for(let j=0;j<s.len;j++) f[j]=this.v.getInt8(this.o++)/128.0;
        doc.sampleData.push(f);
      } else doc.sampleData.push(new Float32Array(0));
    }
    return doc;
  }
}
