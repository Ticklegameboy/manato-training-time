const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const nodes=new Map(),gains=[];
const noop=()=>{};
class AudioMock{
 constructor(){this.paused=true;this.currentTime=0;this.readyState=4;}
 addEventListener(){} play(){this.paused=false;return Promise.resolve();} pause(){this.paused=true;}
}
class AudioContextMock{
 constructor(){this.currentTime=0;this.state='running';this.destination={};AudioContextMock.instance=this;}
 resume(){this.state='running';return Promise.resolve();}
 createMediaElementSource(){return {connect:noop};}
 createGain(){const gain={value:0,cancelScheduledValues:noop,setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;}};gains.push(gain);return {gain,connect:noop};}
}
const document={hidden:false,addEventListener:noop,getElementById(id){if(!nodes.has(id))nodes.set(id,{setAttribute:noop});return nodes.get(id);}};
const window={AudioContext:AudioContextMock};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../manato-bgm.js'),'utf8'),{window,document,Audio:AudioMock});
const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-9,`${label}: expected ${expected}, got ${actual}`);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const bgm=window.createManatoBgm();bgm.load();await flush();
 async function check(state,voiceActive,transition,expected){
  const s={state,voiceActive,transition,paused:false};bgm.update(s);await flush();AudioContextMock.instance.currentTime+=1;bgm.update(s);
  const snap=bgm.snapshot(),index=['opening','gameplay','ending'].indexOf(snap.scene);
  close(gains[index].value,expected,`${state}, voice=${voiceActive}, transition=${transition}: Web Audio scheduled gain`);
  close(snap.tracks[snap.scene].volume,expected,'Settled volume');
 }
 // Voice is active through most gameplay: this branch must follow volume changes too.
 await check('playing',true,false,.0225);
 await check('playing',false,false,.025);
 await check('playing',true,true,.010125);
 await check('dropping',true,false,.0225);
 await check('ready',false,false,.50);
 await check('won',false,false,.20);
 await check('playing',true,false,.0225);
 assert.equal(bgm.snapshot().tracks.ending.playing,false,'Previous scene track stops');
 console.log('PASS: actual scheduled BGM gains and settled levels: opening 50%, gameplay 2.5%, voice 2.25%; transition, drop and restart verified.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
