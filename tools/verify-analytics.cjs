const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../analytics.js'),'utf8');
function harness(id='',hostname='ticklegameboy.github.io'){
 const scripts=[],listeners={},doc={hidden:false,addEventListener:(key,fn)=>listeners[key]=fn,createElement:()=>({}),head:{appendChild:s=>scripts.push(s)}};
 const sandbox={document:doc,location:{hostname,origin:'https://'+hostname,pathname:'/manato-training-time/',search:'?secret=never-send'},performance:{now:()=>1200},Date,Set,Number,Math};
 sandbox.window=sandbox;sandbox.MANATO_ANALYTICS={measurementId:id};sandbox.addEventListener=(key,fn)=>listeners[key]=fn;
 vm.createContext(sandbox);vm.runInContext(source,sandbox);
 return {sandbox,doc,scripts,listeners,run:code=>vm.runInContext(code,sandbox),events:()=>Array.from(sandbox.dataLayer||[],a=>Array.from(a)).filter(a=>a[0]==='event')};
}
for(const [id,host] of [['','ticklegameboy.github.io'],['G-TEST123','localhost'],['bad-id','ticklegameboy.github.io']]){
 const h=harness(id,host);h.run("GameAnalytics.start('ryu');GameAnalytics.tick(1,true);GameAnalytics.end();GameAnalytics.loadFailed('x');");assert.equal(h.scripts.length,0);assert.equal(h.events().length,0);
}
const h=harness('G-TEST123');assert.equal(h.scripts.length,1);assert.equal(h.scripts[0].async,true);assert.equal(h.events()[0][1],'page_view');
h.run("GameAnalytics.loadComplete();GameAnalytics.loadComplete();GameAnalytics.start('red-ranger');for(let n=0;n<35;n++)GameAnalytics.tick(1,true);for(let n=0;n<20;n++)GameAnalytics.tick(1,false);");
h.doc.hidden=true;h.listeners.visibilitychange();h.run('for(let n=0;n<20;n++)GameAnalytics.tick(1,true);GameAnalytics.end();GameAnalytics.end();');
assert.equal(h.events().filter(e=>e[1]==='game_load_complete').length,1);
assert.equal(h.events().filter(e=>e[1]==='game_start').length,1);
assert.equal(h.events().filter(e=>e[1]==='game_end').length,1);
assert.equal(h.events().filter(e=>e[1]==='game_play_time').reduce((sum,e)=>sum+e[2].active_play_seconds,0),35);
assert.equal(JSON.stringify(h.sandbox.dataLayer).includes('secret'),false);
const f=harness('G-TEST123');f.run("GameAnalytics.loadFailed('ryu/atlas-0.png?secret=never-send');GameAnalytics.loadFailed('second');");
assert.equal(f.events().filter(e=>e[1]==='game_load_failed').length,1);assert.equal(f.events().at(-1)[2].asset_path,'ryu/atlas-0.png');
const blocked=harness('G-TEST123');blocked.scripts[0].onerror();blocked.run("window.gtag=()=>{throw Error('blocked');};GameAnalytics.start('ryu');GameAnalytics.end();");
console.log(JSON.stringify({passed:true,disabledWithoutId:true,noLocalTracking:true,pauseAndBackgroundExcluded:true,duplicateFailuresPrevented:true,noQueryOrSavedData:true,blockedAnalyticsDoesNotThrow:true}));

const wrongPath=harness('G-TEST123'); wrongPath.sandbox.location.pathname='/feather-arcade/'; wrongPath.sandbox.dataLayer=[]; vm.runInContext(source,wrongPath.sandbox); assert.equal(wrongPath.events().length,0);
const replay=harness('G-TEST123');replay.run('GameAnalytics.start();GameAnalytics.start();GameAnalytics.end();GameAnalytics.start();');assert.equal(replay.events().filter(e=>e[1]==='game_start').length,2);
// Checkpoints, background/exit, replay and bfcache-like resume keep one cumulative run.
const runs=harness('G-TEST123');
const records=()=>runs.events().filter(e=>e[1]==='game_run_record').map(e=>e[2]);
runs.run('GameAnalytics.start();GameAnalytics.start();for(let n=0;n<65;n++)GameAnalytics.tick(1,true);');
assert.deepEqual(records().map(r=>r.run_seconds),[30,60]);
const firstId=records()[0].run_id;assert.ok(firstId.length>10);
runs.doc.hidden=true;runs.listeners.visibilitychange();runs.listeners.pagehide();
assert.deepEqual(records().map(r=>r.run_seconds),[30,60,65]);
runs.run('for(let n=0;n<20;n++)GameAnalytics.tick(1,true);');
runs.doc.hidden=false;runs.listeners.visibilitychange();
runs.run('for(let n=0;n<10;n++)GameAnalytics.tick(1,false);for(let n=0;n<5;n++)GameAnalytics.tick(1,true);GameAnalytics.end();GameAnalytics.end();');
runs.listeners.pagehide();
assert.equal(records().at(-1).run_seconds,70);assert.equal(records().at(-1).run_status,'completed');
assert.ok(records().every(r=>r.run_id===firstId));
assert.ok(records().every(r=>!('value' in r)),'Cumulative records must not inflate additive event value');
assert.equal(runs.events().filter(e=>e[1]==='game_play_time').reduce((s,e)=>s+e[2].value,0),70);
runs.run('GameAnalytics.start();for(let n=0;n<120;n++)GameAnalytics.tick(1/60,true);GameAnalytics.tick(NaN,true);GameAnalytics.tick(Infinity,true);GameAnalytics.tick(-1,true);GameAnalytics.end();');
assert.equal(records().at(-1).run_seconds,2);assert.notEqual(records().at(-1).run_id,firstId);
const boundary=harness('G-TEST123');boundary.run('GameAnalytics.start();for(let n=0;n<30;n++)GameAnalytics.tick(1,true);GameAnalytics.end();');
assert.deepEqual(boundary.events().filter(e=>e[1]==='game_run_record').map(e=>e[2].run_status),['checkpoint','completed']);
console.log('Run duration tests passed: cumulative checkpoints, exit deduplication, pause exclusion, resume, replay IDs, fractional seconds and completed status.');
