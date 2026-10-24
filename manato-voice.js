'use strict';
(() => {
// Decoded buffers are scheduled on the audio clock, not HTMLAudio ended events.
window.createManatoVoice = function ({base='assets/manato-voice-v1/',extraBase='assets/manato-voice-v2/',random=Math.random}={}) {
 const series=(prefix,count)=>Array.from({length:count},(_,i)=>prefix+'-'+(i+1));
 const pools={suppress:series('suppress',4),laugh:[...series('laugh1',5),...series('laugh2',7)],breakdown:series('breakdown',5)};
 const originalNames=['pullup',...pools.suppress,'breath'];
 const names=[...originalNames,...pools.laugh,...pools.breakdown];
 const buffers=new Map();
 let context=null,loadPromise=null,ready=false,error=null,unlocked=false;
 let kind=null,nodes=[],lastLaugh=-1,normal=null,lastState=null;
 const lastByPool={suppress:null,laugh:null,breakdown:null};
 let openingShort=false,dropKind=null;
 let scheduled=0,resyncs=0,pauseTimer=null;
 const history=[];
 const modulo=(a,b)=>((a%b)+b)%b;
 function getContext(){
  if(!context){const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error('Web Audio unavailable');context=new C();}
  return context;
 }
 function load(){
  if(loadPromise)return loadPromise;
  loadPromise=(async()=>{
   try{
    const c=getContext();
    await Promise.all(names.map(async name=>{
     const response=await fetch((originalNames.includes(name)?base:extraBase)+name+'.wav');
     if(!response.ok)throw new Error('Voice load failed: '+name);
     buffers.set(name,await c.decodeAudioData(await response.arrayBuffer()));
    }));ready=true;return true;
   }catch(e){error=String(e.message||e);console.warn('Manato voice:',error);return false;}
  })();return loadPromise;
 }
 function unlock(){
  if(pauseTimer!==null){window.clearTimeout(pauseTimer);pauseTimer=null;}
  try{
   const c=getContext();unlocked=true;
   return c.resume().catch(e=>{error=String(e.message||e);});
  }catch(e){error=String(e.message||e);return Promise.resolve();}
 }
 function rememberAudible(){
  if(!context)return;
  for(const n of nodes)if(n.pool&&n.at<=context.currentTime){
   lastByPool[n.pool]=n.name;
   if(n.pool==='suppress')lastLaugh=Number(n.name.split('-')[1])-1;
  }
 }
 function stop(){
  if(!context)return;
  rememberAudible();
  const now=context.currentTime;
  for(const n of nodes){
   if(n.at>now){try{n.source.stop();}catch{}}
   else{
    n.gain.gain.cancelScheduledValues(now);
    // Preserve the attack level if a clip is stopped immediately after starting.
    n.gain.gain.setValueAtTime(.85*Math.min(1,Math.max(0,(now-n.at)/.005)),now);
    const fade=n.pool ? .1 : .025;
    n.gain.gain.linearRampToValueAtTime(0,now+fade);
    try{n.source.stop(now+fade+.005);}catch{}
   }
  }
  nodes=[];normal=null;kind=null;
 }
 function pause(){stop();if(pauseTimer!==null)window.clearTimeout(pauseTimer);if(context?.state==='running')pauseTimer=window.setTimeout(()=>{pauseTimer=null;context.suspend().catch(()=>{});},110);}
 function reset(){stop();lastLaugh=-1;for(const pool of Object.keys(lastByPool))lastByPool[pool]=null;openingShort=false;dropKind=null;history.length=0;scheduled=0;resyncs=0;lastState=null;}
 function start(name,at,offset=0,loop=false,pool){
  const buffer=buffers.get(name),source=context.createBufferSource(),gain=context.createGain();
  source.buffer=buffer;source.loop=loop;source.connect(gain);gain.connect(context.destination);
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.85,at+.005);
  const item={name,source,gain,at,offset,end:loop?Infinity:at+buffer.duration-offset,pool};
  source.onended=()=>{source.disconnect();gain.disconnect();};
  source.start(at,offset);nodes.push(item);scheduled++;
  history.push({name,at,end:Number.isFinite(item.end)?item.end:null,offset});if(history.length>32)history.shift();
  return item;
 }
 function desired(s){
  if(s.state==='dropping'&&!s.paused)return dropKind;
  if(s.state!=='playing'||s.paused)return null;
  if(s.mode==='suppress'&&['normal','suppress'].includes(s.renderMode)&&s.motion==='pulling')return 'suppress';
  if(s.mode==='normal'&&s.renderMode==='normal'&&s.motion==='pulling'&&!s.blending)return 'normal';
  // Moving and hanging share one uninterrupted playlist, including the descent.
  if(['moving','hanging'].includes(s.mode)&&['moving','hanging'].includes(s.renderMode))return 'laugh';
  if(s.mode==='shaking'&&s.renderMode==='shaking')return 'breakdown';
  if(['breathingAngry','breathingExhausted'].includes(s.mode)&&['breathingAngry','breathingExhausted'].includes(s.renderMode))return 'breath';
  return null;
 }
 function update(s){
  if(s.state==='dropping'&&lastState?.state!=='dropping')dropKind=pools[kind]?kind:'breakdown';
  if(s.state!=='dropping')dropKind=null;
  // Latch the logical upgrade while the animator completes its current movement.
  // Reactions starting directly from hanging/breathing have no short-opener rule.
  if(s.state==='playing'&&!s.paused){
   if(lastState?.mode==='suppress'&&['moving','hanging'].includes(s.mode)&&lastState.motion==='pulling')openingShort=true;
   if(!['moving','hanging'].includes(s.mode))openingShort=false;
  }
  lastState={...s};
  const next=desired(s);
  if(!next){if(kind)stop();return;}
  if(!ready||!unlocked||context?.state!=='running')return;
  if(next!==kind){stop();kind=next;}
  const now=context.currentTime;
  rememberAudible();nodes=nodes.filter(n=>n.end>now);
  if(kind==='normal'){
   const cycle=s.cycleMs/1000,phase=modulo(s.phase/1000,cycle);
   if(normal){
    const actual=modulo(normal.offset+now-normal.at,cycle);
    const drift=Math.abs(modulo(actual-phase+cycle/2,cycle)-cycle/2);
    // Re-enter at the current pose after a descent/recovery or a stalled render clock.
    // Some browsers briefly freeze the audio clock while restoring a background tab.
    // Do not repeatedly restart a newly aligned source against that frozen clock.
    if(drift>.09&&now-normal.at>.25){stop();kind='normal';resyncs++;}
   }
   if(!normal)normal=start('pullup',now,phase,true);
  }else if(kind==='breath'){
   if(!nodes.length)start('breath',now,0,true);
  }else{
   // Always have the current clip and its successor queued with sample-contiguous times.
   // Selection excludes the actual last audible clip, even if an earlier queue was cancelled.
   while(nodes.length<2){
    const previous=nodes.length?nodes.at(-1).name:lastByPool[kind];
    const shortOpener=kind==='laugh'&&openingShort&&nodes.length===0;
    const options=pools[kind].filter(name=>{
     if(name===previous)return false;
     if(shortOpener)return name.startsWith('laugh1-');
     if(kind==='laugh'&&previous?.startsWith('laugh1-'))return name.startsWith('laugh2-');
     return true;
    });
    const pick=options[Math.min(options.length-1,Math.floor(random()*options.length))];
    const at=nodes.length?nodes.at(-1).end:now;
    start(pick,at,0,false,kind);
    if(shortOpener)openingShort=false;
   }
  }
 }
 function snapshot(){
  const now=context?.currentTime||0;
  const active=nodes.find(n=>n.at<=now&&n.end>now);
  return {ready,error,unlocked,loaded:buffers.size,contextState:context?.state||'unavailable',kind,active:active?.name||null,lastLaugh,lastByPool:{...lastByPool},openingShort,scheduled,resyncs,
   position:active?modulo(active.offset+Math.max(0,now-active.at),buffers.get(active.name).duration):0,
   queue:nodes.map(n=>({name:n.name,at:n.at,end:Number.isFinite(n.end)?n.end:null})),history:history.map(n=>({...n})),
   animationPhase:lastState?.phase??0};
 }
 return {load,unlock,update,pause,reset,stop,snapshot};
};
})();
