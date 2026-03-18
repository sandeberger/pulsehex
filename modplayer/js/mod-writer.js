"use strict";

export class ModWriter{
  constructor(mod){this.m=mod}
  _ws(u,o,s,n){for(let i=0;i<n;i++)u[o+i]=i<s.length?s.charCodeAt(i):0}
  write(){
    const m=this.m,ps=64*m.channels*4,np=m.patterns.length;
    let sds=0;for(let i=0;i<31;i++)sds+=m.sampleData[i]?.length||0;
    const buf=new ArrayBuffer(1084+np*ps+sds),dv=new DataView(buf),u=new Uint8Array(buf);
    let o=0;
    this._ws(u,o,m.songName,20);o+=20;
    for(let i=0;i<31;i++){
      const s=m.samples[i],d=m.sampleData[i],len=d?.length||0;
      this._ws(u,o,s.name||'',22);o+=22;
      dv.setUint16(o,Math.floor(len/2));o+=2;
      const ft=s.finetune<0?s.finetune+16:s.finetune;
      dv.setUint8(o,ft&0x0F);o++;
      dv.setUint8(o,Math.min(64,s.vol));o++;
      dv.setUint16(o,Math.floor(s.loopStart/2));o+=2;
      dv.setUint16(o,s.loopLen>2?Math.floor(s.loopLen/2):1);o+=2;
    }
    dv.setUint8(o,m.songLen);o++;dv.setUint8(o,127);o++;
    for(let i=0;i<128;i++){dv.setUint8(o,m.patternOrder[i]||0);o++}
    this._ws(u,o,m.channels===6?'6CHN':m.channels===8?'8CHN':'M.K.',4);o+=4;
    for(let p=0;p<np;p++){
      for(let r=0;r<64;r++){
        for(let c=0;c<m.channels;c++){
          const n=m.patterns[p][r][c];
          dv.setUint8(o,((n.sample>>4)&0x0F)|((n.period>>8)&0x0F));
          dv.setUint8(o+1,n.period&0xFF);
          dv.setUint8(o+2,((n.sample&0x0F)<<4)|(n.effect&0x0F));
          dv.setUint8(o+3,n.param);o+=4;
        }
      }
    }
    for(let i=0;i<31;i++){
      const d=m.sampleData[i];
      if(d&&d.length>0){
        for(let j=0;j<d.length;j++){dv.setInt8(o,Math.max(-128,Math.min(127,Math.round(d[j]*127))));o++}
      }
    }
    return buf;
  }
  download(fn){
    const b=new Blob([this.write()],{type:'application/octet-stream'});
    const a=document.createElement('a');a.href=URL.createObjectURL(b);
    a.download=fn||(this.m.songName.trim()||'untitled')+'.mod';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
  }
}
