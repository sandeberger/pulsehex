"use strict";

import state from './state.js';
import { ModDocument } from './mod-document.js';
import { ModParser } from './mod-parser.js';
import { ModWriter } from './mod-writer.js';
import { ModPlayer } from './mod-player.js';
import { PatternEditor } from './pattern-editor.js';
import { UndoManager } from './undo-manager.js';
import { Clipboard } from './clipboard.js';
import { SampleEditorUI } from './sample-editor-ui.js';
import { handleKey } from './keyboard.js';
import { initBrowseUI, toggle as toggleBrowse } from './browse-ui.js';
import { toggle as toggleRadio, stop as stopRadio, isActive as isRadioActive } from './radio.js';
import {
  resizeCanvas, showStatus, uiUpdate, uiRenderPattern,
  uiUpdateSampleList, uiUpdateOrderList, uiScopeLoop
} from './ui.js';

// Initialize shared state
state.editor = new PatternEditor();
state.undoMgr = new UndoManager();
state.clipboard = new Clipboard();
state.canvas = document.getElementById('trackerCanvas');
state.ctx = state.canvas.getContext('2d');

async function initAudio(){
  if(state.audioCtx)return;
  state.audioCtx=new(window.AudioContext||window.webkitAudioContext)({sampleRate:44100});
  state.player=new ModPlayer(state.audioCtx);
}

function newModule(){
  state.tracker.mod=new ModDocument(4);state.tracker.orderIdx=0;
  state.editor.cursorRow=0;state.editor.cursorChannel=0;state.editor.cursorColumn=0;
  state.editor.clearSelection();
  document.getElementById('songTitleInput').value=state.tracker.mod.songName;
  if(state.player) state.player.load(state.tracker.mod);
  uiUpdateSampleList();uiUpdateOrderList();uiUpdate();uiRenderPattern();
  if(state.smpEditor) state.smpEditor.select(0);
}

// File input
document.getElementById('fileInput').addEventListener('change',async e=>{
  await initAudio();const f=e.target.files[0];if(!f)return;
  try{
    const p=new ModParser(await f.arrayBuffer());
    const mod=p.parse();state.tracker.mod=mod;state.tracker.orderIdx=0;
    state.player.load(mod);
    document.getElementById('songTitleInput').value=mod.songName;
    uiUpdateSampleList();uiUpdateOrderList();uiUpdate();uiRenderPattern();
    if(state.smpEditor) state.smpEditor.select(state.editor.currentSample-1);
  }catch(e){alert('Invalid MOD: '+e.message)}
});

// Buttons
document.getElementById('btnNew').onclick=async()=>{await initAudio();newModule()};
document.getElementById('btnBrowse').onclick=async()=>{await initAudio();toggleBrowse()};
document.getElementById('btnRadio').onclick=async()=>{await initAudio();toggleRadio()};
document.getElementById('btnPlay').onclick=async()=>{await initAudio();if(isRadioActive())stopRadio();if(state.player&&state.tracker.mod)state.player.play()};
document.getElementById('btnStop').onclick=()=>{if(isRadioActive())stopRadio();if(state.player)state.player.stop()};
document.getElementById('btnSave').onclick=()=>{
  if(!state.tracker.mod){showStatus('NO MODULE!','#f00');return}
  state.tracker.mod.songName=document.getElementById('songTitleInput').value||'UNTITLED';
  new ModWriter(state.tracker.mod).download();showStatus('SAVED!','#0f0');
};

// Drag & Drop
document.body.addEventListener('dragover',e=>{if(!e.target.closest('#sampleDropZone'))e.preventDefault()});
document.body.addEventListener('drop',async e=>{
  if(e.target.closest('#sampleDropZone'))return;
  e.preventDefault();await initAudio();
  const f=e.dataTransfer.files[0];if(!f)return;
  if(f.name.toLowerCase().endsWith('.mod')){
    try{
      const mod=new ModParser(await f.arrayBuffer()).parse();
      state.tracker.mod=mod;state.tracker.orderIdx=0;state.player.load(mod);
      document.getElementById('songTitleInput').value=mod.songName;
      uiUpdateSampleList();uiUpdateOrderList();uiUpdate();uiRenderPattern();
      if(state.smpEditor) state.smpEditor.select(state.editor.currentSample-1);
    }catch(e){alert('Invalid MOD: '+e.message)}
  }else if(state.tracker.mod&&state.smpEditor) state.smpEditor.loadFile(f);
});

// Keyboard
window.addEventListener('keydown',handleKey);

// Song title
document.getElementById('songTitleInput').addEventListener('change',()=>{
  if(state.tracker.mod) state.tracker.mod.songName=document.getElementById('songTitleInput').value;
});

// Init
window.onresize=resizeCanvas;
resizeCanvas();uiScopeLoop();uiUpdate();uiRenderPattern();
state.smpEditor=new SampleEditorUI();
initBrowseUI();

document.body.addEventListener('click',async function init(){
  await initAudio();if(!state.tracker.mod)newModule();
  document.body.removeEventListener('click',init);
},{once:true});
