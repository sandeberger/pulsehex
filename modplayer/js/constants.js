"use strict";

export const PAL_CLOCK = 7093789.2;

export const PERIOD_TABLE = [
  856,808,762,720,678,640,604,570,538,508,480,453,
  428,404,381,360,339,320,302,285,269,254,240,226,
  214,202,190,180,170,160,151,143,135,127,120,113
];

export const FINETUNE_PERIODS = [];
for(let ft=0;ft<16;ft++){
  const v = ft>7?ft-16:ft;
  const mul = Math.pow(2, v/(12*8));
  FINETUNE_PERIODS[ft] = PERIOD_TABLE.map(p=>Math.round(p/mul));
}

export const NOTE_NAMES=["C-","C#","D-","D#","E-","F-","F#","G-","G#","A-","A#","B-"];

export const SINE_TBL = new Float32Array(64);
for(let i=0;i<64;i++) SINE_TBL[i]=Math.sin(i*Math.PI*2/64);

export const EFFECT_NAMES={0:'Arp',1:'Prt\u2191',2:'Prt\u2193',3:'Tone',4:'Vib',5:'T+VS',
  6:'V+VS',7:'Tre',8:'Pan',9:'SOfs',0xA:'VSlid',0xB:'PJmp',0xC:'Vol',
  0xD:'PBrk',0xE:'Ext',0xF:'Spd'};

export const KEYBOARD_NOTE_MAP = {
  'KeyZ':0,'KeyS':1,'KeyX':2,'KeyD':3,'KeyC':4,'KeyV':5,'KeyG':6,
  'KeyB':7,'KeyH':8,'KeyN':9,'KeyJ':10,'KeyM':11,
  'Comma':12,'KeyL':13,'Period':14,'Semicolon':15,'Slash':16,
  'KeyQ':12,'Digit2':13,'KeyW':14,'Digit3':15,'KeyE':16,'KeyR':17,
  'Digit5':18,'KeyT':19,'Digit6':20,'KeyY':21,'Digit7':22,'KeyU':23,
  'KeyI':24,'Digit9':25,'KeyO':26,'Digit0':27,'KeyP':28,
  'BracketLeft':29,'Equal':30,'BracketRight':31
};

export function periodToNoteIdx(period){
  if(period<=0)return -1;
  let best=-1,minD=99999;
  for(let i=0;i<PERIOD_TABLE.length;i++){
    const d=Math.abs(PERIOD_TABLE[i]-period);
    if(d<minD){minD=d;best=i}
  }
  return best;
}

export function noteStr(period){
  const i=periodToNoteIdx(period);
  if(i<0)return"---";
  return NOTE_NAMES[i%12]+(Math.floor(i/12)+1);
}
