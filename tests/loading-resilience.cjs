const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const path=require('path'),root=path.resolve(__dirname,'..');
const flush=()=>new Promise(r=>setImmediate(r));
function loaderHarness(){
 const timers=new Map(),attempts=new Map(),pending=[];let id=0,behavior='ok',active=0,max=0,fetches=0,aborts=0,decodeStalls=false;
 const window={setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout(id){timers.delete(id);}};
 class Image{set src(url){this.url=url;if(!url)return;attempts.set(url,(attempts.get(url)||0)+1);active++;max=Math.max(max,active);const done=()=>{active--;if(behavior==='fail')this.onerror?.();else this.onload?.();};if(behavior==='stall')pending.push(done);else queueMicrotask(done);}}
 class AbortController{constructor(){this.signal={};}abort(){aborts++;}}
 const sandbox=vm.createContext({window,Image,AbortController,console,fetch:async()=>{fetches++;return {ok:true,arrayBuffer:()=>behavior==='audio-stall'?new Promise(()=>{}):Promise.resolve('bytes')};}});
 vm.runInContext(fs.readFileSync(root+'/manato-loader.js','utf8'),sandbox);
 return {loader:window.ManatoLoader,attempts,timers,setBehavior:x=>behavior=x,release:()=>pending.splice(0).forEach(fn=>fn()),fire:()=>{const list=[...timers.values()];timers.clear();list.forEach(fn=>fn());},stats:()=>({active,max,fetches,aborts}),context:{decodeAudioData:()=>decodeStalls?new Promise(()=>{}):Promise.resolve({duration:3})},stallDecode:()=>decodeStalls=true};
}
function gameHarness({failImage=false,stalledAudio=false,noAudio=false,badVoice=false}={}){
 const source=fs.readFileSync(path.join(__dirname,'game-integration.cjs'),'utf8').split('(async()=>{')[0];
 const control={failImage,requests:new Map(),audio:[],timers:new Map(),id:0};
 let code=source.replace('window={AudioContext:AC,setTimeout,clearTimeout,', 'window={AudioContext:control.noAudio?undefined:AC,setTimeout:control.setTimeout,clearTimeout:control.clearTimeout,');
 code=code.replace('queueMicrotask(()=>this.onload())', "control.requests.set(x,(control.requests.get(x)||0)+1);queueMicrotask(()=>{if(control.failImage&&x.includes('normal'))this.onerror();else this.onload();})");
 code=code.replace("fetch:async url=>({ok:true,arrayBuffer:async()=>path.basename(url,'.wav')})", "fetch:async url=>{if(control.badVoice&&url.includes('suppress-2'))return {ok:false};if(control.stalledAudio)return new Promise(resolve=>control.audio.push(()=>resolve({ok:true,arrayBuffer:async()=>path.basename(url,'.wav')})));return {ok:true,arrayBuffer:async()=>path.basename(url,'.wav')};}");
 Object.assign(control,{noAudio,stalledAudio,badVoice,setTimeout(fn){control.timers.set(++control.id,fn);return control.id;},clearTimeout(id){control.timers.delete(id);}});
 code=code.replace('for(const ac of AC.instances)','for(const ac of (AC.instances||[]))');
 const box=vm.createContext({require,console:{...console,warn(){}},setTimeout,clearTimeout,queueMicrotask,control,__dirname});
 vm.runInContext(code+';this.result={window,node,advance,events,status};',box);
 return {...box.result,control};
}
(async()=>{
 let h=loaderHarness();h.setBehavior('stall');let all=Promise.all(Array.from({length:12},(_,i)=>h.loader.image('frame'+i)));await flush();assert.equal(h.stats().max,4);h.setBehavior('ok');h.release();await all;assert.equal(h.stats().max,4);assert.equal(h.timers.size,0);await h.loader.image('frame0');assert.equal(h.attempts.get('frame0'),1,'Reuse successful assets');
 h=loaderHarness();h.setBehavior('fail');await assert.rejects(h.loader.image('bad'));assert.equal(h.attempts.get('bad'),2);h.setBehavior('ok');await h.loader.image('bad');assert.equal(h.attempts.get('bad'),3,'Failed cache evicted for retry');
 h=loaderHarness();h.setBehavior('stall');const results=Promise.allSettled(Array.from({length:40},(_,i)=>h.loader.image('timeout'+i)));await flush();h.fire();await flush();h.fire();await flush();assert.equal((await results).filter(x=>x.status==='rejected').length,40,'Offline queue drains after first failures');assert.equal(h.timers.size,0);
 h=loaderHarness();h.setBehavior('audio-stall');let audio=Promise.allSettled(Array.from({length:2},()=>h.loader.audio('voice',h.context)));await flush();assert.equal(h.stats().fetches,2,'Two audio requests maximum');h.fire();await flush();h.fire();await flush();assert.equal((await audio).every(x=>x.status==='rejected'),true);assert.equal(h.stats().aborts,4,'Stalled body downloads aborted');
 h=loaderHarness();h.stallDecode();audio=h.loader.audio('decode',h.context);const rejected=assert.rejects(audio);await flush();h.fire();await flush();h.fire();await rejected;assert.equal(h.timers.size,0,'Stalled decoder is bounded too');
 let g=gameHarness({stalledAudio:true});await flush();await flush();g.advance(3.1);assert.equal(g.status().loading.ready,true);assert.equal(g.node('start').hidden,false,'START despite stalled audio');assert.equal(g.status().voice.ready,false);g.node('start').onclick();g.advance(1.3);assert.equal(g.status().state,'playing');g.control.stalledAudio=false;for(const resume of g.control.audio.splice(0))resume();await flush();await flush();g.advance(.1);assert.equal(g.status().voice.loaded,23);assert.equal(g.status().voice.active,'pullup','Late audio joins current animation');
 g=gameHarness({failImage:true});await flush();await flush();g.advance(3.1);assert.equal(g.status().loading.failed,true);assert.equal(g.node('retry').hidden,false);assert.equal(g.node('start').hidden,true);const cached=new Map([...g.control.requests].filter(([name])=>!name.includes('normal')));g.control.failImage=false;g.node('retry').onclick();g.node('retry').onclick();await flush();await flush();g.advance(.1);assert.equal(g.status().loading.ready,true);assert.equal(g.status().loading.loaded,g.status().loading.total);for(const [name,count] of cached)assert.equal(g.control.requests.get(name),count,'Successful images never redownload');g.node('start').onclick();g.advance(1.3);assert.equal(g.status().state,'playing');
 g=gameHarness({badVoice:true});await flush();await flush();assert.equal(g.status().voice.loaded,22);assert.equal(g.status().voice.ready,true,'One missing voice does not disable others');g.control.badVoice=false;g.events['window:online']();await flush();await flush();assert.equal(g.status().voice.loaded,23,'Reconnect recovers missing audio');
 g=gameHarness({noAudio:true});await flush();await flush();g.advance(3.1);g.node('start').onclick();g.advance(1.3);assert.equal(g.status().state,'playing','Unsupported audio does not block gameplay');g.node('musicToggle').onclick();
 console.log('PASS: bounded concurrency; cache reuse; image retry; disconnected queue drains; body/decode timeout; stalled audio permits start; late audio rejoins phase; retry retains images; repeated retry safe; no WebAudio still playable.');
})().catch(e=>{console.error(e);process.exitCode=1;});

