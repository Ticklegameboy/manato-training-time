'use strict';
window.GameAnalytics=(()=>{
 const id=window.MANATO_ANALYTICS?.measurementId||'';
 const enabled=/^G-[A-Z0-9]+$/.test(id)&&location.hostname==='ticklegameboy.github.io'&&/^\/manato-training-time(?:\/|$)/.test(location.pathname);
 const loadedAt=performance.now();let started=false,pendingSeconds=0,failed=false,loaded=false;
 let runId='',runSeconds=0,lastRecordSeconds=-1,lastRecordStatus='';
 const allowed=new Set(['page_view','game_start','game_play_time','game_end','game_load_complete','game_load_failed','game_run_record']);
 function send(name,params={}){
  if(!enabled||!allowed.has(name))return;
  try {window.gtag('event',name,{send_to:id,game_version:'manato-v20',...params});}catch{}
 }
 if(enabled){
  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
  window.gtag('js',new Date());
  window.gtag('config',id,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,
   page_location:location.origin+location.pathname,page_referrer:'',page_title:'Manato Training Time',cookie_flags:'SameSite=Lax;Secure'});
  const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+id;
  script.onerror=()=>{};document.head.appendChild(script);
  send('page_view');
 }
 function flush(){
  const seconds=Math.floor(pendingSeconds);if(!started||seconds<1)return;
  pendingSeconds-=seconds;send('game_play_time',{value:seconds,active_play_seconds:seconds});
 }
 // Each snapshot is cumulative for one run, NOT another additive time event.
 // Use MAX(run_seconds) per run_id (or country for its record); sum game_play_time for total time.
 function record(status){
  if(!started)return;
  const seconds=Math.floor(runSeconds+1e-7);
  if(seconds===lastRecordSeconds&&(status===lastRecordStatus||status!=='completed'))return;
  lastRecordSeconds=seconds;lastRecordStatus=status;
  send('game_run_record',{run_id:runId,run_seconds:seconds,run_status:status});
 }
 function newRunId(){
  try {if(window.crypto?.randomUUID)return window.crypto.randomUUID();}catch{}
  return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden){flush();record('background');}});
 window.addEventListener('pagehide',()=>{flush();record('pagehide');});
 return {
  start(){if(started)return;started=true;pendingSeconds=0;runSeconds=0;runId=newRunId();lastRecordSeconds=-1;lastRecordStatus='';send('game_start',{run_id:runId});},
  tick(seconds,active){
   if(!started||!active||document.hidden)return;
   const numeric=Number(seconds),delta=Number.isFinite(numeric)?Math.max(0,Math.min(numeric,1)):0;
   pendingSeconds+=delta;runSeconds+=delta;
   if(pendingSeconds>=30){flush();record('checkpoint');}
  },
  end(){if(!started)return;flush();record('completed');started=false;send('game_end',{run_id:runId,run_seconds:Math.floor(runSeconds+1e-7)});},
  loadComplete(){if(loaded||failed)return;loaded=true;send('game_load_complete',{load_seconds:Math.round((performance.now()-loadedAt)/1000)});},
  loadFailed(asset){if(failed||loaded)return;failed=true;
   // Only an asset path is sent; never send raw error text, queries, saved games or user input.
   const path=typeof asset==='string'?asset.split(/[?#]/)[0]:'';
   send('game_load_failed',{asset_path:/^[a-zA-Z0-9_./-]{1,180}$/.test(path)&&!path.includes('..')?path:'unknown'});
  }
 };
})();
