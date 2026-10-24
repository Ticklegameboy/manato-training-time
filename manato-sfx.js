'use strict';
// Original short PCM effects: electronic button clicks and a three-part pixel wipe.
window.createManatoSfx=function({base='assets/manato-sfx-v1/'}={}){
 const names=['select','confirm','retry','wipe-close','wipe-lock','wipe-open'];
 const buffers=new Map(),active=new Set();
 let context=null,promise=null,enabled=false,paused=false,wasActive=false,locked=false,revealed=false;
 const history=[];
 function getContext(){if(!context){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;context=new C();}return context;}
 function load(){return promise||(promise=(async()=>{
  try{const c=getContext();if(!c)return false;await Promise.all(names.map(async n=>{const r=await fetch(base+n+'.wav');if(!r.ok)throw Error(n);buffers.set(n,await c.decodeAudioData(await r.arrayBuffer()));}));return true;}
  catch(e){console.warn('UI audio unavailable:',e);return false;}
 })());}
 function emit(name,rate=1){
  if(!context||context.state!=='running'||paused||!buffers.has(name))return false;
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffers.get(name);
  if(source.playbackRate)source.playbackRate.value=rate;
  gain.gain.value=name.startsWith('wipe')?.44:.62;source.connect(gain);gain.connect(context.destination);
  active.add(source);source.onended=()=>{active.delete(source);source.disconnect();gain.disconnect();};source.start();
  history.push(name);if(history.length>24)history.shift();return true;
 }
 function click(name){enabled=true;paused=false;const c=getContext();if(!c)return;const resumed=c.resume();Promise.all([resumed,load()]).then(()=>emit(name)).catch(()=>{});}
 // Capture precedes existing handlers, so keyboard and touch activation also work.
 document.addEventListener('click',e=>{const button=e.target.closest?.('button');if(!button||button.disabled||button.hidden||button.closest('[hidden], [inert]'))return;click(['start','again'].includes(button.id)?'confirm':button.id==='retry'?'retry':'select');},true);
 function updateTransition(s){
  if(!s.active){wasActive=false;locked=false;revealed=false;return;}
  const speed=s.reduced?3:1;
  if(!wasActive)wasActive=emit('wipe-close',speed);
  if(s.committed&&!locked)locked=emit('wipe-lock',speed);
  if(s.time>=(s.reduced?.16:.62)&&!revealed)revealed=emit('wipe-open',speed);
 }
 function pause(){paused=true;for(const source of active){try{source.stop();}catch{}}active.clear();if(context?.state==='running')context.suspend().catch(()=>{});}
 function resume(){paused=!!document.hidden;if(enabled&&!paused)context?.resume().catch(()=>{});}
 return {load,updateTransition,pause,resume,snapshot:()=>({loaded:buffers.size,history:history.slice(),paused})};
};
