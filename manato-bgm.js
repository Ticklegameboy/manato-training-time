'use strict';
window.createManatoBgm=function({base='assets/manato-bgm-v1/'}={}){
 const levels={opening:.36,gameplay:.10,ending:.20},tracks=new Map();
 let context=null,enabled=true,muted=false,paused=false,scene=null,error=null,lastState=null,waitingForGesture=false;
 const button=document.getElementById('musicToggle'),credits=document.getElementById('musicCredits');
 function load(){
  if(context||error)return;
  try{
   const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('Web Audio unavailable');context=new C();
   for(const name of Object.keys(levels)){
    const audio=new Audio(base+name+'.mp3');audio.loop=true;audio.preload='metadata';
    const source=context.createMediaElementSource(audio),gain=context.createGain();gain.gain.value=0;source.connect(gain);gain.connect(context.destination);
    const track={audio,gain,from:0,to:0,start:0,end:0,stopAt:null,started:false,pending:false};tracks.set(name,track);
    audio.addEventListener('error',()=>{error='Music load failed: '+name;});
   }
   context.resume().then(()=>{waitingForGesture=false;if(lastState)update(lastState);}).catch(()=>{waitingForGesture=true;});
  }catch(e){error=String(e.message||e);}
 }
 function level(t){if(t.end<=t.start)return t.to;return t.from+(t.to-t.from)*Math.max(0,Math.min(1,(context.currentTime-t.start)/(t.end-t.start)));}
 function ramp(t,value,seconds){
  if(t.to===value)return;
  const now=context.currentTime,current=level(t);t.gain.gain.cancelScheduledValues(now);t.gain.gain.setValueAtTime(current,now);t.gain.gain.linearRampToValueAtTime(value,now+seconds);
  t.from=current;t.to=value;t.start=now;t.end=now+seconds;
 }
 function play(t){
  if(t.pending||!t.audio.paused)return;
  t.pending=true;
  // A failure is retried only on a new user gesture, not on every animation frame.
  t.audio.play().then(()=>{t.pending=false;if(paused||muted||t!==tracks.get(scene)){t.audio.pause();return;}t.started=true;waitingForGesture=false;},e=>{t.pending=false;if(e?.name==='AbortError'||paused||muted||t!==tracks.get(scene))return;waitingForGesture=true;if(e?.name!=='NotAllowedError')error=String(e?.message||e);});
 }
 function unlock(){
  if(muted)return;load();if(!context)return;enabled=true;paused=!!document.hidden;
  waitingForGesture=false;context.resume().then(()=>{if(lastState)update(lastState);}).catch(()=>{waitingForGesture=true;});labels();
 }
 function labels(){
  const lang=window.MANATO_I18N?.language||'zh-Hant';
  const strings=lang==='ja'?['音楽を再生','音楽をミュート','音楽クレジット']:lang==='en'?['Enable music','Mute music','Music credits']:['開啟音樂','音樂靜音','音樂鳴謝'];
  button.textContent=enabled&&!muted?'♫':'♪';button.setAttribute('aria-label',strings[enabled&&!muted?1:0]);button.title=strings[enabled&&!muted?1:0];button.setAttribute('aria-pressed',String(enabled&&!muted));credits.textContent=strings[2];
 }
 button.onclick=()=>{if(!enabled||muted){muted=false;unlock();}else{muted=true;for(const t of tracks.values()){ramp(t,0,.16);t.stopAt=context.currentTime+.17;}labels();}};
 for(const event of ['pointerdown','keydown'])document.addEventListener(event,e=>{if(e.target.closest?.('#musicToggle'))return;if(!muted&&(!enabled||waitingForGesture||context?.state!=='running'))unlock();},{capture:true});
 window.MANATO_I18N?.onChange(labels);labels();
 function update(s){
  credits.hidden=s.state!=='ready';
  button.parentElement?.classList.toggle('in-game',['playing','dropping'].includes(s.state));
  lastState={...s};const next=s.state==='ready'?'opening':s.state==='won'?'ending':['playing','dropping'].includes(s.state)?'gameplay':null;
  if(!context)return;
  if(next!==scene){
   scene=next;
   for(const [name,t] of tracks){
    if(name===scene){t.audio.pause();t.audio.currentTime=0;t.started=false;t.stopAt=null;}
    else if(!t.audio.paused){ramp(t,0,.5);t.stopAt=context.currentTime+.52;}
   }
  }
  for(const t of tracks.values())if(t.stopAt!==null&&context.currentTime>=t.stopAt){t.audio.pause();t.stopAt=null;}
  if(!enabled||muted||paused||s.paused||waitingForGesture||context.state!=='running')return;
  const t=tracks.get(scene);if(!t)return;t.stopAt=null;play(t);
  const vocal=!!s.voiceActive;
  // Keep gameplay music beneath breath and laughter; transitions briefly dip too.
  const target=(scene==='gameplay'?(vocal?.045:levels.gameplay):levels[scene])*(s.transition?.45:1);
  ramp(t,target,target<t.to?.12:.65);
 }
 function pause(){paused=true;for(const t of tracks.values())t.audio.pause();context?.suspend().catch(()=>{});}
 function resume(){paused=!!document.hidden;if(enabled&&!muted&&!paused)context?.resume().catch(()=>{});}
 return {load,unlock,update,pause,resume,snapshot:()=>({scene,enabled,muted,paused,error,tracks:Object.fromEntries([...tracks].map(([n,t])=>[n,{playing:!t.audio.paused,position:t.audio.currentTime,volume:level(t),target:t.to,ready:t.audio.readyState}]))})};
};
