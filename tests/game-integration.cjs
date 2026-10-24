const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const lengths={};
for(const folder of ['manato-voice-v1','manato-voice-v2','manato-sfx-v1'])for(const file of fs.readdirSync(path.join(root,'assets',folder)).filter(x=>x.endsWith('.wav'))){
 const name=path.basename(file,'.wav');const b=fs.readFileSync(path.join(root,'assets',folder,file));let rate,bytes,data;
 for(let at=12;at+8<=b.length;){const id=b.toString('ascii',at,at+4),size=b.readUInt32LE(at+4);if(id==='fmt '){rate=b.readUInt32LE(at+12);bytes=b.readUInt32LE(at+16);}if(id==='data')data=size;at+=8+size+(size%2);}
 assert.ok(rate&&data);lengths[name]=data/bytes;
}
assert.equal(lengths.pullup,9.56);
class AC{
 constructor(){this.currentTime=0;this.state='suspended';this.destination={};AC.last=this;(AC.instances??=[]).push(this);this.sources=[];}
 resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}
 decodeAudioData(data){return Promise.resolve({duration:lengths[data]});}
 createMediaElementSource(){return {connect(){}};}
 createGain(){return {connect(){},disconnect(){},gain:{value:.85,setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){}}};}
 createBufferSource(){const source={connect(){},disconnect(){},start(at,offset){this.at=at;this.offset=offset;},stop(at=0){this.stopped=at;}};this.sources.push(source);return source;}
}

class AudioMock{constructor(src){this.src=src;this.paused=true;this.currentTime=0;this.readyState=4;}addEventListener(){}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
const nodes=new Map(),events={},calls=[];let raf,t=0;
const noop=()=>{};
const ctx=new Proxy({drawImage(im){calls.push(['image',im.src])},fillText(text){calls.push(['text',text])}},{get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
function node(id){if(!nodes.has(id))nodes.set(id,{style:{},attrs:{},hidden:false,classList:{add:noop,remove:noop},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]},addEventListener:(k,f)=>events[id+':'+k]=f,getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:256,height:400})});return nodes.get(id)}
const document={documentElement:{},hidden:false,createElement:()=>({getContext:()=>ctx}),getElementById:node,querySelector:()=>node('meter'),addEventListener:(k,f)=>events['document:'+k]=f};
const window={AudioContext:AC,setTimeout,clearTimeout,location:{reload:noop},addEventListener:(k,f)=>events['window:'+k]=f};
class Img{constructor(){this.width=512;this.height=800}set src(x){assert.ok(fs.existsSync(path.join(root,x)),x);this._src=x;queueMicrotask(()=>this.onload())}get src(){return this._src}}
const context=vm.createContext({window,document,Image:Img,Audio:AudioMock,Math,console,fetch:async url=>({ok:true,arrayBuffer:async()=>path.basename(url,'.wav')}),requestAnimationFrame:f=>raf=f});
for(const name of ['manato-loader.js','manato-assets.js','manato-locales.js','manato-dialogue.js','manato-screens.js','manato-transition.js','manato-voice.js','manato-sfx.js','manato-bgm.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context);
let game=fs.readFileSync(path.join(root,'game.js'),'utf8');game=game.replace('init();','window.qaFinish=finish;window.qaHit=hit;window.qaStamina=value=>{stamina=value;syncStaminaState();};init();');vm.runInContext(game,context);
const status=()=>window.gameStatus;
function advance(s){const end=t+s*1000;while(t<end-1e-7){const next=Math.min(end,t+20);for(const ac of AC.instances)if(ac.state==='running')ac.currentTime+=(next-t)/1000;t=next;raf(t)}}
function collect(o){return Array.isArray(o)?o:typeof o==='object'?Object.entries(o).filter(([k])=>k!=='colors').flatMap(([,v])=>collect(v)):[]}
(async()=>{
 assert.equal(status().state,'ready');node('start').onclick();assert.equal(status().state,'ready');
 await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));raf(0);
 assert.equal(status().screen.language,'zh-Hant');assert.equal(node('start').hidden,true);
 advance(1);assert.ok(status().screen.progress>0&&status().screen.progress<1);assert.equal(node('loadPanel').hidden,false);assert.equal(status().hits,0);
 node('langEn').onclick();assert.equal(document.documentElement.lang,'en');assert.equal(node('startLabel').textContent,'START GAME');
 node('langJa').onclick();assert.equal(document.documentElement.lang,'ja');assert.equal(node('startLabel').textContent,'ゲーム開始');
 node('langZh').onclick();advance(2.1);assert.equal(node('loadPanel').hidden,true);assert.equal(node('start').hidden,false);assert.equal(status().state,'ready');assert.equal(node('loadMeter').attrs['aria-valuenow'],100);
 const lines=collect(window.MANATO_DIALOGUE);assert.equal(lines.length,207);
 for(const lang of ['en','ja']){window.MANATO_I18N.set(lang);for(const source of lines){const text=window.MANATO_I18N.translate(source);assert.ok(text&&text!==source,lang+': '+source);const wrapped=window.MANATO_I18N.lines(text,13.75,222);assert.ok(wrapped.length<=4);for(const line of wrapped)assert.ok(window.MANATO_I18N.width(line,13.75)<=222,lang+': '+line);}}
 node('langEn').onclick();node('start').onclick();assert.equal(status().state,'ready');assert.equal(status().transition.active,true);advance(.4);assert.equal(status().state,'ready');node('start').onclick();advance(.12);assert.equal(status().state,'playing');assert.equal(status().transition.committed,true);assert.equal(status().elapsed,0);advance(.62);assert.equal(status().transition.active,false);assert.equal(node('pixelTransition').hidden,true);assert.equal(node('bootScreen').hidden,true);advance(.1);assert.equal(status().speech.floats[0].text,'Feeling good today.');

 assert.equal(status().bgm.scene,'gameplay');assert.equal(status().bgm.tracks.gameplay.target,.045);assert.equal(status().voice.ready,true);assert.equal(status().voice.active,'pullup');
 const n0=status().voice.scheduled;advance(9.56);assert.equal(status().voice.scheduled,n0,'Normal has no restarts over four complete repetitions');
 window.qaHit(0,0);advance(.1);assert.equal(status().voice.kind,'normal','Miss does not trigger laugh');
 const p=status().hotspots[0];window.qaHit(p.x,p.y);advance(.2);assert.equal(status().voice.kind,'suppress');
 let first=status().voice.active,seenNext=false;
 for(let i=0;i<60;i++){window.qaStamina(200);const p=status().hotspots[0];window.qaHit(p.x,p.y);advance(.25);if(status().voice.active&&status().voice.active!==first)seenNext=true;}
 assert.ok(seenNext,'Continuous valid interference chains laugh clips');
 assert.equal(status().voice.kind,'suppress');advance(2);assert.equal(status().voice.kind,'normal');
 const phaseSeconds=status().animation.phase/1000,voiceSeconds=status().voice.position%2.39;assert.ok(Math.abs(voiceSeconds-phaseSeconds)<.06,'Recovery enters correct pull-up phase');

 // Exercise actual game stamina boundaries, keeping interference alive.
 function tickleAt(value,seconds){for(let j=0;j<seconds/.2;j++){window.qaStamina(value);const z=status().hotspots[0];window.qaHit(z.x,z.y);advance(.2);}}
 tickleAt(190,.4);assert.equal(status().voice.kind,'suppress');
 tickleAt(160,2);assert.equal(status().mode,'moving');assert.equal(status().voice.kind,'laugh');assert.ok(status().voice.history.find(x=>x.name.startsWith('laugh')).name.startsWith('laugh1-'));
 const ordinaryStart=status().voice.history.filter(x=>x.name.startsWith('laugh')).length;
 tickleAt(110,1.4);assert.equal(status().mode,'hanging');assert.equal(status().voice.kind,'laugh');assert.equal(status().voice.history.filter(x=>x.name.startsWith('laugh')).length,ordinaryStart,'Descent preserves queued audio');
 tickleAt(60,1.4);assert.equal(status().mode,'shaking');assert.equal(status().voice.kind,'breakdown');
 tickleAt(110,1.4);assert.equal(status().voice.kind,'laugh');
 tickleAt(160,2);assert.equal(status().mode,'moving');assert.equal(status().voice.kind,'laugh');
 window.qaStamina(90);advance(2);assert.equal(status().mode,'breathingAngry');assert.equal(status().voice.kind,'breath');
 events['window:blur']();advance(1);assert.equal(status().voice.active,null);events['window:focus']();advance(.1);assert.equal(status().voice.kind,'breath');
 window.qaStamina(200);advance(1);assert.equal(status().voice.kind,'normal');
 tickleAt(50,1.4);assert.equal(status().voice.kind,'breakdown');const dropVoice=status().voice.active;window.qaFinish();advance(.8);assert.equal(status().state,'dropping');assert.equal(status().bgm.scene,'gameplay');assert.equal(status().voice.kind,'breakdown');assert.ok(status().voice.active);advance(.7);assert.equal(status().voice.active,null);advance(.4);assert.equal(status().state,'won');assert.equal(status().bgm.scene,'ending');assert.equal(status().bgm.tracks.ending.target,.20);assert.equal(node('endingScreen').hidden,false);
 calls.length=0;advance(.5);assert.ok(!calls.some(c=>c[0]==='text'&&['體力','体力','STAMINA'].includes(c[1])),'No stamina HUD on ending');assert.ok(calls.some(c=>c[0]==='text'&&c[1].includes('Bro')),'Localized ending line floats');
 calls.length=0;advance(3);for(const frame of window.MANATO_ASSETS.endingLoop)assert.ok(calls.some(c=>c[1]===frame),'Every breathing frame rendered');
 const prior=status().endingVisible;events['window:blur']();calls.length=0;advance(2);assert.equal(status().endingVisible,prior);events['window:focus']();
 node('again').onclick();assert.equal(status().state,'won');advance(.4);assert.equal(status().state,'won');events['window:blur']();const held=status().transition.time;advance(.5);assert.equal(status().transition.time,held);events['window:focus']();advance(.12);assert.equal(status().state,'playing');assert.equal(status().stamina,200);advance(.62);assert.equal(status().transition.active,false);assert.equal(node('endingScreen').hidden,true);assert.equal(status().screen.language,'en');
 const screen=window.createManatoScreens(node('game'),window.MANATO_ASSETS);screen.loading(.4,2,false,true);assert.equal(node('retry').hidden,false);assert.equal(node('start').hidden,true);
 console.log('PASS: real game + audio controller integrated; phase alignment; random laughter; misses; breathing; focus; restart;  real asset progress + minimum run; start gated until complete; three language buttons; 207 lines translated in both languages and wrapped; localized game/ending; no ending stamina; all breath frames loop; pause; explicit restart; load failure retry.');
})().catch(e=>{console.error(e);process.exitCode=1});

