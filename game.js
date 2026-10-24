'use strict';
(() => {
const $=id=>document.getElementById(id), canvas=$('game'),ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;
const dissolve=document.createElement('canvas');dissolve.width=256;dissolve.height=400;
const mixCtx=dissolve.getContext('2d');mixCtx.imageSmoothingEnabled=false;
const order=[0,1,2,3,4,5,4,3,2,1], durations=[500,150,150,150,160,380,200,200,200,200];
const total=durations.reduce((a,b)=>a+b,0), images={normal:[],moving:[],suppress:[],hanging:[],shaking:[],breathingAngry:[],breathingExhausted:[]};
const artwork=window.MANATO_ASSETS;
const screens=window.createManatoScreens(canvas,artwork);
const transition=window.createPixelTransition();
let assetsReady=false,loadError=false,loadedAssets=0,bootTime=0;
const assetCount=3+Object.values(artwork.groups).reduce((n,g)=>n+g.frames.length,0)+(artwork.endingLoop?.length||0)+(artwork.runnerFrames?.length||0);
const maxStamina=200,suppressThreshold=maxStamina*.85,hangThreshold=maxStamina*.65,exhaustedThreshold=maxStamina*.35,breathDelay=1,hitDamage=.875,recoveryRate=2.4,recoveryAcceleration=4,maxRecoveryRate=20;
// A held contact equals four ordinary taps per second, regardless of move-event frequency.
const holdInterval=.25;
// All interaction coordinates follow the selected character artwork.
const viewTop=0,viewHeight=400;
function frameAt(group,ms,once=false){
 const length=group.duration_ms.reduce((a,b)=>a+b,0);
 let t=once?Math.min(ms,length-1):((ms%length)+length)%length;
 for(let i=0;i<group.sequence.length;i++){if(t<group.duration_ms[i])return group.sequence[i];t-=group.duration_ms[i];}
 return group.sequence.at(-1);
}
function visual(){
 if(state==='dropping'||state==='won'){
  const group=artwork.groups.release;
  const duration=group.duration_ms.reduce((a,b)=>a+b,0);
  return {key:'release',index:frameAt(group,Math.min(dropTime/1.35,1)*duration,true)};
 }
 if(blend)return {...(blend.time/blend.duration<.5?blend.from:blend.to)};
 return currentFrame();
}
function activeGeometry(){const {key,index}=visual();return artwork.groups[key].geometry[index]||{regions:[],hotspots:[]};}
function insideRegion(x,y,polygon){
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const [ax,ay]=polygon[j],[bx,by]=polygon[i];
  if(Math.abs((x-ax)*(by-ay)-(y-ay)*(bx-ax))<1e-7&&x>=Math.min(ax,bx)-1e-7&&x<=Math.max(ax,bx)+1e-7&&y>=Math.min(ay,by)-1e-7&&y<=Math.max(ay,by)+1e-7)return true;
  if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
 }
 return inside;
}
function hitZone(x,y){
 if(x<0||x>=256||y<0||y>=400)return null;
 let selected=null;
 for(const zone of activeGeometry().zones||[]){
  if(insideRegion(x,y,zone.polygon)&&(!selected||zone.multiplier>selected.multiplier))selected=zone;
 }
 return selected;
}
let state='ready',stamina=maxStamina,elapsed=0,phase=0,lastHit=-100,combo=0,bestCombo=0,hits=0,misses=0;
let criticalHits=0,lastDamage=0,lastZone=null;
let mode='normal',pose=0,locked=false,laughClock=0,dropTime=0,paused=false;
let endingTime=0;
let hitEffects=[],last=0,toastUntil=0,lastInput=-100;
const speech=window.createManatoSpeech(artwork);
function setMode(next){mode=next;}
function reactionMode(){
 if(elapsed-lastHit+1e-9>=breathDelay){
  if(stamina>=hangThreshold)return 'normal';
  return stamina<exhaustedThreshold?'breathingExhausted':'breathingAngry';
 }
 if(stamina>=suppressThreshold)return 'suppress';
 if(stamina>=hangThreshold)return 'moving';
 return stamina<exhaustedThreshold?'shaking':'hanging';
}
// Hanging is a reversible stamina band, never a timed or permanent lock.
function syncStaminaState(){
 locked=stamina<hangThreshold;
 setMode(reactionMode());
}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');toastUntil=elapsed+1.4;}
function poseAt(ms){let t=((ms%total)+total)%total;for(let i=0;i<durations.length;i++){if(t<durations[i])return order[i];t-=durations[i];}return 0;}
// Logical stamina bands update immediately; the visible actor owns its own clock.
const pullModes=new Set(['normal','suppress','moving']);
const starts=durations.map((_,i)=>durations.slice(0,i).reduce((a,b)=>a+b,0));
let renderMode='normal',motion='pulling',blend=null,bottomTime=0;
function currentFrame(){return {key:renderMode,index:pullModes.has(renderMode)?pose:frameAt(artwork.groups[renderMode],laughClock*1000)};}
function phaseSlot(){let t=((phase%total)+total)%total;for(let i=0;i<durations.length;i++){if(t<durations[i])return {slot:i,fraction:t/durations[i]};t-=durations[i];}return {slot:0,fraction:0};}
function poseDistance(a,b){
 const x=artwork.groups[a.key].geometry[a.index].landmarks,y=artwork.groups[b.key].geometry[b.index].landmarks;
 // Match actual torso landmarks, not frame numbers from separately generated loops.
 return (x.pit-y.pit)**2+(x.pec-y.pec)**2+(x.navel[1]-y.navel[1])**2+2*(x.navel[0]-y.navel[0])**2;
}
function closestFrame(from,key,indices=[...new Set(artwork.groups[key].sequence)]){
 return indices.reduce((best,index)=>poseDistance(from,{key,index})<poseDistance(from,{key,index:best})?index:best,indices[0]);
}
function beginBlend(key,index,duration=.12){
 const from=currentFrame();
 renderMode=key;
 if(pullModes.has(key))pose=index;
 else {const g=artwork.groups[key],slot=g.sequence.indexOf(index);laughClock=g.duration_ms.slice(0,slot).reduce((a,b)=>a+b,0)/1000;}
 blend={from,to:{key,index},time:0,duration};
}
function torsoHeight(frame){
 const l=artwork.groups[frame.key].geometry[frame.index].landmarks;
 return (l.pit+l.pec+l.navel[1])/3;
}
function pullTrajectory(){
 const {slot,fraction}=phaseSlot(),nextSlot=(slot+1)%order.length,afterSlot=(slot+2)%order.length;
 const from=currentFrame(),next={key:renderMode,index:order[nextSlot]},after={key:renderMode,index:order[afterSlot]};
 const direction=Math.sign(torsoHeight(next)-torsoHeight(from));
 const velocity=(torsoHeight(next)-torsoHeight(from))/durations[slot];
 const followingVelocity=(torsoHeight(after)-torsoHeight(next))/durations[nextSlot];
 return {slot,fraction,from,next,direction,velocity,followingVelocity,remaining:durations[slot]*(1-fraction)};
}
function matchNextMotion(key,trajectory){
 const {from,next,direction,velocity,followingVelocity}=trajectory;
 const rising=direction<0,slots=rising?[0,1,2,3,4,5]:[5,6,7,8,9,0];
 const old=artwork.groups[from.key].geometry[from.index].landmarks;
 let best=null;
 for(const slot of slots){
  const frame={key,index:order[slot]},l=artwork.groups[key].geometry[frame.index].landmarks;
  // All three torso anchors must move forward. A close but backward pose replays effort.
  if(direction*(torsoHeight(frame)-torsoHeight(from))<1)continue;
  if([l.pit-old.pit,l.pec-old.pec,l.navel[1]-old.navel[1]].some(delta=>direction*delta< -2))continue;
  const after={key,index:order[(slot+1)%order.length]};
  const nextVelocity=(torsoHeight(after)-torsoHeight(frame))/durations[slot];
  const score=poseDistance(next,frame)+4000*(nextVelocity-followingVelocity)**2;
  if(best&&score>=best.score)continue;
  const turning=(rising&&slot===5)||(!rising&&slot===0);
  // Do not replay a bottom/top pause when entering that pose already in motion.
  const speed=Math.abs(Math.sign(followingVelocity)===direction?followingVelocity:velocity);
  const travel=Math.abs(torsoHeight(after)-torsoHeight(frame));
  const hold=turning?durations[slot]:Math.min(durations[slot],Math.max(80,travel/Math.max(.02,speed)));
  best={frame,slot,score,entryPhase:starts[slot]+durations[slot]-hold};
 }
 return best;
}
function changePullMode(key,dt){
 const trajectory=pullTrajectory();
 // The dissolve replaces the end of this frame's dwell, rather than adding a stop.
 if(trajectory.remaining>120)return false;
 const target=matchNextMotion(key,trajectory);
 // A target loop may not reach the current extreme: let the source turn naturally.
 if(!target)return false;
 beginBlend(key,target.frame.index,trajectory.remaining/1000);
 blend.kind='momentum';blend.direction=trajectory.direction;
 phase=target.entryPhase;
 const remainder=advanceBlend(dt);
 if(remainder!==null){phase=(phase+remainder*1000)%total;pose=poseAt(phase);}
 return true;
}
function advanceBlend(dt){
 blend.time+=dt;
 if(blend.time+1e-9<blend.duration)return null;
 const remainder=Math.max(0,blend.time-blend.duration);blend=null;
 return remainder;
}
function beginDescent(){
 motion='lowering';bottomTime=0;
 const {slot,fraction}=phaseSlot();
 // Reverse an unfinished ascent at its current pose; never teleport to the bottom.
 if(slot>0&&slot<5)phase=starts[10-pose]+fraction*durations[10-pose];
}
function advanceAnimation(dt){
 if(blend){
  const remainder=advanceBlend(dt);
  if(remainder===null)return;
  dt=remainder;
 }
 const wantsPull=pullModes.has(mode),isPull=pullModes.has(renderMode);
 if(isPull){
  if(!wantsPull){
   if(motion!=='lowering')beginDescent();
   if(pose===0){
    bottomTime+=dt;
    if(bottomTime>=.12){const index=closestFrame(currentFrame(),mode);beginBlend(mode,index,.16);motion='hanging';}
    return;
   }
   phase+=dt*1000;
   if(phase>=total){phase=0;pose=0;bottomTime=0;}else pose=poseAt(phase);
   return;
  }
  // A recovery during descent cancels the pending hang without resetting the pose.
  motion='pulling';bottomTime=0;
  if(renderMode!==mode&&changePullMode(mode,dt))return;
  phase=(phase+dt*1000)%total;pose=poseAt(phase);
 }else{
  if(wantsPull){
   // Enter the rising branch at the closest low pose, with a short settling beat.
   const index=closestFrame(currentFrame(),mode,[0,1]);
   beginBlend(mode,index,.16);phase=starts[index];motion='pulling';bottomTime=0;return;
  }
  motion='hanging';
  if(renderMode!==mode){beginBlend(mode,closestFrame(currentFrame(),mode));return;}
  laughClock+=dt;
 }
}
function reset(){
 window.GameAnalytics?.start();
 clearPointer();endingTime=0;screens.play();
 renderMode='normal';motion='pulling';blend=null;bottomTime=0;
 criticalHits=0;lastDamage=0;lastZone=null;
 state='playing';stamina=maxStamina;elapsed=phase=combo=bestCombo=hits=misses=0;lastHit=lastInput=-100;mode='normal';pose=0;locked=false;laughClock=dropTime=0;paused=false;hitEffects=[];$('intro').classList.add('hidden');$('winPanel').classList.add('hidden');$('toast').classList.remove('show');speech.reset(visual());updateHud();}
function finish(){window.GameAnalytics?.end();clearPointer();blend=null;motion='release';state='dropping';mode='release';dropTime=0;stamina=0;speech.finish(elapsed);toast('體力耗盡');}
function showWin(){state='won';endingTime=0;screens.ending();$('resultTime').textContent=elapsed.toFixed(1)+'s';$('resultHits').textContent=hits;$('resultCombo').textContent=bestCombo;$('winPanel').classList.remove('hidden');$('speech').textContent='呼……你贏啦。';}
// Pixel feedback is emitted only by a successful damage adjudication.
const pixelGlyphs={
 '0':['111','101','101','101','111'],'1':['010','110','010','010','111'],
 '2':['111','001','111','100','111'],'3':['111','001','111','001','111'],
 '4':['101','101','111','001','001'],'5':['111','100','111','001','111'],
 '6':['111','100','111','101','111'],'7':['111','001','010','010','010'],
 '8':['111','101','111','101','111'],'9':['111','101','111','001','111'],
 '/':['001','001','010','100','100'],
 B:['11110','11001','11001','11110','11001','11001','11110'],
 u:['00000','00000','11001','11001','11001','11001','01111'],
 r:['0000','0000','1011','1100','1000','1000','1000'],
 s:['0000','0000','0111','1000','0110','0001','1110'],
 t:['0100','0100','1111','0100','0100','0100','0011']
};
function pixelText(text,x,y,color,scale=1){
 ctx.fillStyle=color;
 for(const char of text){const glyph=pixelGlyphs[char];if(!glyph){x+=3*scale;continue;}
  glyph.forEach((row,j)=>{for(let i=0;i<row.length;i++)if(row[i]==='1')ctx.fillRect(Math.round(x+i*scale),Math.round(y+j*scale),scale,scale);});
  x+=(glyph[0].length+1)*scale;
 }
}
function spark(x,y,critical){hitEffects.push({x:Math.round(x),y:Math.round(y),critical,age:0,duration:critical?.56:.32});}
function drawHitEffects(){
 for(const fx of hitEffects){
  const ringTime=fx.age/.32, gold=fx.critical?'#ffd34e':'#eefaff';
  if(ringTime<1){
   const radius=Math.round(3+10*(1-(1-ringTime)**2));
   ctx.globalAlpha=Math.min(1,(1-ringTime)*2);ctx.fillStyle=gold;
   // Draw the contour on the native pixel grid; no smooth vector circle.
   for(let y=-radius;y<=radius;y++)for(let x=-radius;x<=radius;x++){
    const d=x*x+y*y;if(d<=radius*radius&&d>(radius-1.5)**2)ctx.fillRect(fx.x+x,fx.y+y,1,1);
   }
   if(fx.age<.08){ctx.fillStyle='#fff9dc';ctx.fillRect(fx.x-1,fx.y-3,2,6);ctx.fillRect(fx.x-3,fx.y-1,6,2);}
   if(fx.critical){const reach=radius+3;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])ctx.fillRect(fx.x+dx*reach-1,fx.y+dy*reach-1,2,2);}
  }
  if(fx.critical){
   const t=fx.age/fx.duration,x=Math.max(3,Math.min(224,fx.x-13));
   const y=Math.max(3,Math.round(fx.y-13-7*Math.sin(Math.min(1,t*2)*Math.PI/2)-5*t));
   ctx.globalAlpha=Math.min(1,(1-t)*4);
   for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[2,2]])pixelText('Burst',x+dx,y+dy,'#171017');
   pixelText('Burst',x,y,gold);
  }
 }
 ctx.globalAlpha=1;
}
function staminaBand(value=stamina){return value>=suppressThreshold?0:value>=hangThreshold?1:value>=exhaustedThreshold?2:3;}
function drawStamina(){
 // Upper-left margin ends at x=80, leaving the central ears unobstructed.
 const colors=['#f5df51','#ff9850','#ff526c','#c481ff'],color=colors[staminaBand()];
 ctx.fillStyle='#090c10';ctx.beginPath();ctx.moveTo(6,7);ctx.lineTo(80,7);ctx.lineTo(80,34);ctx.lineTo(73,41);ctx.lineTo(6,41);ctx.closePath();ctx.fill();
 ctx.fillStyle=color;ctx.fillRect(6,7,3,29);ctx.fillRect(10,7,70,1);
 ctx.font=window.MANATO_I18N.language==='en'?'bold 5px sans-serif':'bold 7px sans-serif';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle='#f3f1e8';ctx.fillText(window.MANATO_I18N.ui('stamina'),14,12);
 const n=Math.max(0,Math.min(maxStamina,Math.ceil(stamina)));
 pixelText(String(n).padStart(3,'0'),41,12,'#f3f1e8');pixelText('/200',55,12,'#92969a');
 ctx.fillStyle='#33353c';ctx.fillRect(14,24,58,7);
 const width=Math.round(58*Math.max(0,Math.min(1,stamina/maxStamina)));
 ctx.fillStyle=color;ctx.fillRect(14,24,width,7);ctx.fillStyle='#ffffff';ctx.globalAlpha=.45;ctx.fillRect(14,24,width,1);ctx.globalAlpha=1;
 // Fixed threshold notches make a stage change easy to read in both directions.
 ctx.fillStyle='#090c10';for(const ratio of [.35,.65,.85])ctx.fillRect(14+Math.round(58*ratio),24,1,7);
 for(let i=0;i<4;i++){ctx.fillStyle=i===staminaBand()?color:'#45454c';ctx.fillRect(14+i*7,35,5,2);}
 ctx.fillStyle=color;ctx.fillRect(64,35,6,1);ctx.fillRect(62,37,6,1);
}
function hit(x,y){if(state!=='playing'||paused||transition.active||elapsed-lastInput<.085)return false;lastInput=elapsed;
 const zone=hitZone(x,y);
 if(!zone){misses++;return false;}
 combo=elapsed-lastHit<1.15?combo+1:1;bestCombo=Math.max(bestCombo,combo);lastHit=elapsed;hits++;
 lastDamage=Math.min(stamina,hitDamage*zone.multiplier);lastZone=zone.id;
 if(zone.multiplier===2)criticalHits++;
 stamina=Math.max(0,stamina-lastDamage);
 spark(x,y,zone.multiplier===2);syncStaminaState();speech.hit(mode,zone.id,elapsed);
 if(stamina<=0)finish();updateHud();return true;
}
let pointer=null;
function clearPointer(){const id=pointer?.id;pointer=null;if(id!==undefined&&canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);}
function pointerPoint(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*256,y:viewTop+(e.clientY-r.top)/r.height*viewHeight};}
canvas.addEventListener('pointerdown',e=>{
 if(state!=='playing'||paused||transition.active||pointer||e.isPrimary===false||(e.button!==undefined&&e.button!==0))return;
 e.preventDefault();pointer={id:e.pointerId,...pointerPoint(e),contactTime:0,hasContact:false};
 try{canvas.setPointerCapture(e.pointerId);}catch{}
 const active=pointer;active.hasContact=hit(active.x,active.y);
});
canvas.addEventListener('pointermove',e=>{
 if(!pointer||e.pointerId!==pointer.id)return;
 if(e.pointerType==='mouse'&&e.buttons===0){clearPointer();return;}
 e.preventDefault();Object.assign(pointer,pointerPoint(e));
 if(!hitZone(pointer.x,pointer.y)){pointer.contactTime=0;pointer.hasContact=false;}
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(pointer&&e.pointerId===pointer.id){if(pointer.hasContact)lastHit=elapsed;clearPointer();}});
window.addEventListener('blur',()=>{clearPointer();paused=true;});
window.addEventListener('focus',()=>{paused=!!document.hidden;});
function updateHeldInput(dt){
 if(!pointer)return;
 if(!hitZone(pointer.x,pointer.y)){pointer.contactTime=0;pointer.hasContact=false;return;}
 if(pointer.hasContact)lastHit=elapsed;
 pointer.contactTime+=dt;
 while(pointer&&pointer.contactTime+1e-9>=holdInterval){const active=pointer;active.contactTime-=holdInterval;active.hasContact=hit(active.x,active.y);}
}
function updateHud(){const n=Math.floor(stamina*10)/10;$('staminaText').textContent=`${n} / ${maxStamina}`;$('staminaFill').style.width=stamina/maxStamina*100+'%';$('staminaFill').style.filter=stamina<exhaustedThreshold?'hue-rotate(320deg) saturate(1.5)':'none';document.querySelector('.meter').setAttribute('aria-valuenow',n);$('clock').textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;$('combo').textContent=combo?`${combo} 连击`:'准备挑战';$('status').textContent=state==='won'||state==='dropping'?'体力耗尽':({normal:'教练示范中',suppress:'惊讶忍笑 · 还在嘴硬',moving:'笑着拒绝 · 努力坚持',hanging:'忍不住大笑 · 仍不服输',shaking:'破防大笑 · 连声求饶',breathingAngry:'喘口气 · 嘴硬逞强',breathingExhausted:'疲惫喘息 · 轻声求饶'})[mode];}
// Integrate the ramp exactly, so recovery does not depend on frame rate.
function recoveryTotal(seconds){
 const t=Math.max(0,seconds),ramp=(maxRecoveryRate-recoveryRate)/recoveryAcceleration;
 const rising=Math.min(t,ramp);
 return recoveryRate*rising+.5*recoveryAcceleration*rising*rising+Math.max(0,t-ramp)*maxRecoveryRate;
}
function update(dt){if(paused)return;if(state==='ready'){bootTime+=dt;screens.loading(Math.min(loadedAssets/assetCount,bootTime/3),bootTime,assetsReady&&bootTime>=3,loadError);return;}
 if(state==='playing'){elapsed+=dt;
 updateHeldInput(dt);if(state!=='playing')return;
 const rest=elapsed-lastHit-breathDelay;
 stamina=Math.min(maxStamina,stamina+recoveryTotal(rest)-recoveryTotal(rest-dt));
 syncStaminaState();advanceAnimation(dt);
 if(elapsed-lastHit>1.15)combo=0;
 updateHud();
 }else if(state==='dropping'){dropTime+=dt;if(dropTime>=1.35)showWin();}else if(state==='won'){endingTime+=dt;}
 speech.update(dt,{state,mode,visual:visual(),blend,elapsed,lastHit});
 hitEffects=hitEffects.filter(fx=>(fx.age+=dt)<fx.duration);if(elapsed>toastUntil)$('toast').classList.remove('show');
}
function draw(){
 ctx.setTransform(2,0,0,2,0,0);ctx.imageSmoothingEnabled=false;
 ctx.clearRect(0,0,256,400);
 if(state==='ready'){screens.boot(ctx,images);return;}
 if(!images.bg)return;
 ctx.drawImage(images.bg,0,0,256,400);
 const paint=(context,target,alpha=1)=>{const sprite=images[target.key]?.[target.index];if(sprite&&alpha>0){context.globalAlpha=alpha;context.drawImage(sprite,0,artwork.groups[target.key].offsetY);}};
 if(blend&&state==='playing'){
  const t=Math.min(1,blend.time/blend.duration),mix=t*t*(3-2*t);
  // Mix on transparency so shared opaque pixels (especially the bar) never dim.
  mixCtx.clearRect(0,0,256,400);mixCtx.globalCompositeOperation='source-over';
  paint(mixCtx,blend.from,1-mix);mixCtx.globalCompositeOperation='lighter';paint(mixCtx,blend.to,mix);
  mixCtx.globalAlpha=1;mixCtx.globalCompositeOperation='source-over';ctx.drawImage(dissolve,0,0);
 }else paint(ctx,visual());
 ctx.globalAlpha=1;
 if(state==='won'){screens.end(ctx,images,endingTime);}
 else{drawHitEffects();speech.draw(ctx);drawStamina();}
}
function loop(t){window.GameAnalytics?.tick((t-last)/1000,state==='playing'&&!paused&&!transition.active);const dt=Math.min((t-last)/1000||0,.05);last=t;if(transition.active){draw();if(!paused)transition.step(dt);}else{update(dt);draw();}requestAnimationFrame(loop);}
function load(name){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{loadedAssets++;resolve(im);};im.onerror=()=>{const error=new Error('Asset load failed: '+name);error.assetURL=name;reject(error);};im.src=name;});}
async function init(){
 requestAnimationFrame(loop);screens.loading(0,0,false,false);
 try{
  await Promise.all([
   load(artwork.background).then(im=>images.bg=im),
   load(artwork.ending).then(im=>images.ending=im),
   load(artwork.loadingBackground).then(im=>images.loading=im),
   Promise.all(artwork.endingLoop.map(load)).then(frames=>images.endingLoop=frames),
   Promise.all(artwork.runnerFrames.map(load)).then(frames=>images.runner=frames),
   ...Object.entries(artwork.groups).map(async([key,group])=>{images[key]=await Promise.all(group.frames.map(load));})
  ]);
  assetsReady=true;window.GameAnalytics?.loadComplete();
 }catch(e){loadError=true;window.GameAnalytics?.loadFailed(e.assetURL);console.error(e);}
}
$('start').onclick=()=>{if(state==='ready'&&assetsReady&&bootTime>=3)transition.start(reset);};
$('again').onclick=()=>{if(state==='won')transition.start(reset);};$('watch').onclick=()=>$('winPanel').classList.add('hidden');
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearPointer();paused=!!document.hidden;});
// Read-only state for local QA and support; gameplay always goes through pointer input.
Object.defineProperty(window,'gameStatus',{get:()=>({state,mode,stamina,maxStamina,screen:screens.snapshot(),transition:transition.snapshot(),staminaPercent:stamina/maxStamina*100,elapsed,locked,pose,hits,misses,criticalHits,lastDamage,lastZone,combo,bestCombo,paused,holding:!!pointer,feedback:hitEffects.map(fx=>({...fx})),staminaBand:staminaBand(),endingVisible:state==='won'&&endingTime>0,speech:speech.snapshot(),animation:{renderMode,motion,phase,blending:!!blend,blendProgress:blend?blend.time/blend.duration:1,blendKind:blend?.kind||null,direction:blend?.direction||(pullModes.has(renderMode)?pullTrajectory().direction:0)},visual:visual(),hotspots:activeGeometry().hotspots.map(([x,y])=>({x,y})),regions:activeGeometry().regions.map(p=>p.map(([x,y])=>[x,y])),hitZones:(activeGeometry().zones||[]).map(z=>({id:z.id,multiplier:z.multiplier,polygon:z.polygon.map(([x,y])=>[x,y]),probe:z.probe?.slice()}))})});
init();
})();

