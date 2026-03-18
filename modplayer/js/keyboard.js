"use strict";

import { KEYBOARD_NOTE_MAP } from './constants.js';
import { transpose } from './clipboard.js';
import state from './state.js';
import { showStatus, uiUpdate, uiRenderPattern, uiUpdateSampleList, uiUpdateOrderList, uiUpdateMuteStrip } from './ui.js';

function saveUndo(){
  const m=state.tracker.mod;if(!m)return;
  state.undoMgr.snapPattern(m,m.patternOrder[state.tracker.orderIdx]);
}

function doTranspose(semitones){
  const m=state.tracker.mod;if(!m)return;
  const editor=state.editor;
  const pi=m.patternOrder[state.tracker.orderIdx];
  saveUndo();
  const sel=editor.getSelection();
  if(sel) transpose(m,pi,sel.r0,sel.r1,sel.c0,sel.c1,semitones);
  else transpose(m,pi,0,63,editor.cursorChannel,editor.cursorChannel,semitones);
  showStatus('TRANSPOSED '+(semitones>0?'+':'')+semitones,'#0af');
  uiRenderPattern();
}

export function handleKey(e){
  const ae=document.activeElement;
  if(ae&&(ae.tagName==='INPUT')&&ae.type!=='file'){
    if(e.key==='Escape'||e.key==='Enter'){ae.blur();if(state.tracker.mod&&ae.id==='songTitleInput')state.tracker.mod.songName=ae.value}
    return;
  }
  const m=state.tracker.mod;
  const editor=state.editor;
  const player=state.player;

  // Global shortcuts
  if(e.ctrlKey&&e.code==='KeyS'){e.preventDefault();document.getElementById('btnSave').click();return}
  if(e.ctrlKey&&e.code==='KeyO'){e.preventDefault();document.getElementById('fileInput').click();return}
  if(e.ctrlKey&&e.code==='KeyN'){e.preventDefault();document.getElementById('btnNew').click();return}

  // Undo/Redo
  if(e.ctrlKey&&e.code==='KeyZ'){
    e.preventDefault();
    const st=state.undoMgr.undo();
    if(st&&m) state.undoMgr.restore(m,st);
    uiRenderPattern();return;
  }
  if(e.ctrlKey&&e.code==='KeyY'){
    e.preventDefault();
    const st=state.undoMgr.redo();
    if(st&&m) state.undoMgr.restore(m,st);
    uiRenderPattern();return;
  }

  // Copy/Paste/Cut
  if(e.ctrlKey&&e.code==='KeyC'){
    e.preventDefault();
    if(m){
      const pi=m.patternOrder[state.tracker.orderIdx];
      const sel=editor.getSelection();
      if(sel) state.clipboard.copy(m,pi,sel.r0,sel.r1,sel.c0,sel.c1);
      else state.clipboard.copy(m,pi,editor.cursorRow,editor.cursorRow,editor.cursorChannel,editor.cursorChannel);
      showStatus('COPIED','#0af');
    }
    return;
  }
  if(e.ctrlKey&&e.code==='KeyV'){
    e.preventDefault();
    if(m&&state.clipboard.data){
      const pi=m.patternOrder[state.tracker.orderIdx];
      state.undoMgr.snapPattern(m,pi);
      state.clipboard.paste(m,pi,editor.cursorRow,editor.cursorChannel);
      showStatus('PASTED','#0af');
      uiRenderPattern();
    }
    return;
  }
  if(e.ctrlKey&&e.code==='KeyX'){
    e.preventDefault();
    if(m){
      const pi=m.patternOrder[state.tracker.orderIdx];
      state.undoMgr.snapPattern(m,pi);
      const sel=editor.getSelection();
      if(sel) state.clipboard.cut(m,pi,sel.r0,sel.r1,sel.c0,sel.c1);
      else state.clipboard.cut(m,pi,editor.cursorRow,editor.cursorRow,editor.cursorChannel,editor.cursorChannel);
      editor.clearSelection();showStatus('CUT','#f80');uiRenderPattern();
    }
    return;
  }

  // Transpose
  if(e.shiftKey&&e.code==='F1'){e.preventDefault();doTranspose(-1);return}
  if(e.shiftKey&&e.code==='F2'){e.preventDefault();doTranspose(1);return}
  if(e.shiftKey&&e.code==='F3'){e.preventDefault();doTranspose(-12);return}
  if(e.shiftKey&&e.code==='F4'){e.preventDefault();doTranspose(12);return}

  // Help
  if(e.code==='F1'){
    e.preventDefault();
    const h=document.getElementById('helpOverlay');
    h.style.display=h.style.display==='none'?'block':'none';return;
  }

  // Escape
  if(e.code==='Escape'){
    e.preventDefault();
    document.getElementById('helpOverlay').style.display='none';
    if(player?.isPlaying) player.stop();
    editor.clearSelection();uiUpdate();uiRenderPattern();return;
  }

  // Space - edit mode
  if(e.code==='Space'){
    e.preventDefault();
    const on=editor.toggleEdit();
    showStatus(on?'EDIT MODE ON':'EDIT MODE OFF',on?'#f80':'#0f0');
    uiUpdate();uiRenderPattern();return;
  }

  // Enter - play
  if(e.code==='Enter'){e.preventDefault();if(state.audioCtx&&player&&m)player.play();return}

  // F7 - Mute
  if(e.code==='F7'){e.preventDefault();if(player){player.toggleMute(editor.cursorChannel);uiUpdateMuteStrip();uiRenderPattern()}return}
  // F8 - Solo
  if(e.code==='F8'){e.preventDefault();if(player){player.soloChannel(editor.cursorChannel);uiUpdateMuteStrip();uiRenderPattern()}return}

  // Navigation with selection support
  if(e.code==='ArrowUp'){
    e.preventDefault();
    if(e.ctrlKey){
      if(state.tracker.orderIdx>0){state.tracker.orderIdx--;uiUpdateOrderList()}
    }else if(e.shiftKey&&editor.editMode){
      editor.startSelection();editor.moveCursor(-1,0,0);editor.selEndRow=editor.cursorRow;
    }else{
      editor.clearSelection();editor.moveCursor(-1,0,0);
    }
    uiUpdate();uiRenderPattern();return;
  }
  if(e.code==='ArrowDown'){
    e.preventDefault();
    if(e.ctrlKey){
      if(m&&state.tracker.orderIdx<m.songLen-1){state.tracker.orderIdx++;uiUpdateOrderList()}
    }else if(e.shiftKey&&editor.editMode){
      editor.startSelection();editor.moveCursor(1,0,0);editor.selEndRow=editor.cursorRow;
    }else{
      editor.clearSelection();editor.moveCursor(1,0,0);
    }
    uiUpdate();uiRenderPattern();return;
  }
  if(e.code==='ArrowLeft'){e.preventDefault();editor.moveCursor(0,0,-1);uiUpdate();uiRenderPattern();return}
  if(e.code==='ArrowRight'){e.preventDefault();editor.moveCursor(0,0,1);uiUpdate();uiRenderPattern();return}
  if(e.code==='Tab'){
    e.preventDefault();
    if(e.shiftKey){editor.moveCursor(0,-1,0);editor.cursorColumn=0}
    else{editor.moveCursor(0,1,0);editor.cursorColumn=0}
    uiUpdate();uiRenderPattern();return;
  }
  if(e.code==='PageUp'){e.preventDefault();editor.cursorRow=Math.max(0,editor.cursorRow-16);uiUpdate();uiRenderPattern();return}
  if(e.code==='PageDown'){e.preventDefault();editor.cursorRow=Math.min(63,editor.cursorRow+16);uiUpdate();uiRenderPattern();return}
  if(e.code==='Home'){e.preventDefault();editor.cursorRow=0;uiUpdate();uiRenderPattern();return}
  if(e.code==='End'){e.preventDefault();editor.cursorRow=63;uiUpdate();uiRenderPattern();return}

  // F2-F5 channel jump
  if(e.code==='F2'&&!e.shiftKey){e.preventDefault();editor.cursorChannel=0;editor.cursorColumn=0;uiUpdate();uiRenderPattern();return}
  if(e.code==='F3'&&!e.shiftKey){e.preventDefault();editor.cursorChannel=Math.min(1,(m?.channels||4)-1);editor.cursorColumn=0;uiUpdate();uiRenderPattern();return}
  if(e.code==='F4'&&!e.shiftKey){e.preventDefault();editor.cursorChannel=Math.min(2,(m?.channels||4)-1);editor.cursorColumn=0;uiUpdate();uiRenderPattern();return}
  if(e.code==='F5'&&!e.shiftKey){e.preventDefault();editor.cursorChannel=Math.min(3,(m?.channels||4)-1);editor.cursorColumn=0;uiUpdate();uiRenderPattern();return}

  // F6 new pattern
  if(e.code==='F6'){e.preventDefault();if(m){const np=m.addPattern();showStatus('PAT '+np+' CREATED','#0af')}return}

  // Sample select
  if(!editor.editMode&&e.shiftKey&&e.code==='ArrowUp'){e.preventDefault();editor.currentSample=Math.max(1,editor.currentSample-1);if(state.smpEditor)state.smpEditor.select(editor.currentSample-1);uiUpdateSampleList();uiUpdate();return}
  if(!editor.editMode&&e.shiftKey&&e.code==='ArrowDown'){e.preventDefault();editor.currentSample=Math.min(31,editor.currentSample+1);if(state.smpEditor)state.smpEditor.select(editor.currentSample-1);uiUpdateSampleList();uiUpdate();return}

  // Octave
  if(e.ctrlKey&&e.code>='Digit1'&&e.code<='Digit3'){e.preventDefault();editor.currentOctave=parseInt(e.code.replace('Digit',''));uiUpdate();return}
  // Step
  if(e.altKey&&e.code>='Digit0'&&e.code<='Digit9'){e.preventDefault();editor.stepValue=parseInt(e.code.replace('Digit',''));uiUpdate();return}

  // Delete/Backspace/Insert
  if(e.code==='Delete'){e.preventDefault();if(m){saveUndo();editor.clearNote(m);uiRenderPattern()}return}
  if(e.code==='Backspace'){e.preventDefault();if(m){saveUndo();editor.deleteAndPull(m);uiRenderPattern()}return}
  if(e.code==='Insert'&&!e.shiftKey){e.preventDefault();if(m){saveUndo();editor.insertRow(m);uiRenderPattern()}return}

  // Pattern order +/-
  if(e.code==='NumpadAdd'||(e.code==='Equal'&&!e.shiftKey)){
    e.preventDefault();
    if(m){
      const p=m.patternOrder[state.tracker.orderIdx];
      if(p<m.patterns.length-1){m.patternOrder[state.tracker.orderIdx]=p+1;uiUpdateOrderList();uiRenderPattern()}
    }
    return;
  }
  if(e.code==='NumpadSubtract'||e.code==='Minus'){
    e.preventDefault();
    if(m){
      const p=m.patternOrder[state.tracker.orderIdx];
      if(p>0){m.patternOrder[state.tracker.orderIdx]=p-1;uiUpdateOrderList();uiRenderPattern()}
    }
    return;
  }

  // Insert order position
  if(e.shiftKey&&e.code==='Insert'){
    e.preventDefault();
    if(m&&m.songLen<128){
      for(let i=127;i>state.tracker.orderIdx;i--) m.patternOrder[i]=m.patternOrder[i-1];
      m.songLen++;uiUpdateOrderList();
    }
    return;
  }

  // EDIT MODE - note/hex input
  if(editor.editMode&&m){
    if(editor.cursorColumn===0&&KEYBOARD_NOTE_MAP[e.code]!==undefined){
      e.preventDefault();
      saveUndo();
      const ofs=KEYBOARD_NOTE_MAP[e.code];
      const res=editor.inputNote(ofs,m);
      if(res&&player) player.previewNote(res.sample,res.period);
      uiUpdate();uiRenderPattern();return;
    }
    if(editor.cursorColumn>0){
      const hex='0123456789ABCDEF';
      const ch=e.key.toUpperCase();
      if(hex.includes(ch)){
        e.preventDefault();saveUndo();
        editor.inputHex(ch,m);uiUpdate();uiRenderPattern();return;
      }
    }
  }
}
