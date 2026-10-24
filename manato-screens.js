'use strict';
window.createManatoScreens=function(canvas,artwork){
 const $=id=>document.getElementById(id),i18n=window.MANATO_I18N;
 let progress=0,complete=false,error=false;
 function labels(){
  for(const [id,key] of Object.entries({titleLabel:'title',subtitleLabel:'subtitle',modeLabel:'mode',startLabel:'start',againLabel:'restart',startHint:'hint',retry:'retry',languageLabel:'language'}))$(id).textContent=i18n.ui(key);
  $('loadLabel').textContent=i18n.ui(error?'error':complete?'ready':'loading');
  $('bootScreen').setAttribute('aria-label',i18n.ui('start'));
  document.querySelector('.language-picker')?.setAttribute('aria-label',i18n.ui('language'));
  $('loadMeter').setAttribute('aria-label',i18n.ui('loading'));canvas.setAttribute('aria-label',i18n.ui('gameLabel'));
  for(const [id,lang] of [['langZh','zh-Hant'],['langJa','ja'],['langEn','en']])$(id).setAttribute('aria-pressed',String(i18n.language===lang));
 }
 for(const [id,lang] of [['langZh','zh-Hant'],['langJa','ja'],['langEn','en']])$(id).onclick=()=>i18n.set(lang);
 i18n.onChange(labels);labels();
 $('retry').onclick=()=>window.location.reload();
 function loading(value,time,done,failed){
  progress=value;complete=done;error=failed;
  $('loadFill').style.width=(value*100)+'%';$('loadPercent').textContent=Math.floor(value*100)+'%';
  $('loadMeter').setAttribute('aria-valuenow',Math.floor(value*100));
  $('runner').style.left=(8+value*84)+'%';
  const frames=artwork.runnerFrames||[];
  if(frames.length){const src=frames[Math.floor(time/.07)%frames.length];if($('runner').getAttribute?.('src')!==src)$('runner').src=src;}
  $('loadPanel').hidden=done;$('start').hidden=!done;$('start').disabled=!done;$('startHint').hidden=!done;
  $('retry').hidden=!failed;$('loadLabel').textContent=i18n.ui(failed?'error':done?'ready':'loading');
 }
 function play(){ $('bootScreen').hidden=true;$('endingScreen').hidden=true; }
 function ending(){ $('bootScreen').hidden=true;$('endingScreen').hidden=false; }
 function cover(ctx,im,alpha=1){if(!im)return;const scale=Math.max(256/im.width,400/im.height),w=im.width*scale,h=im.height*scale;ctx.globalAlpha=alpha;ctx.drawImage(im,(256-w)/2,(400-h)/2,w,h);ctx.globalAlpha=1;}
 function boot(ctx,images){ctx.fillStyle='#131a24';ctx.fillRect(0,0,256,400);cover(ctx,images.loading);}
 function endingFrame(time){const order=[0,1,2,3,2,1];return {index:order[Math.floor(Math.max(0,time)/.18)%order.length]};}
 function end(ctx,images,time){
  const frames=images.endingLoop||[],f=endingFrame(time);
  // A single opaque authored frame per tick: no crossfade, morph or interpolation.
  cover(ctx,frames[f.index]||images.ending);
  if(time>.3&&time<5.5){
   const age=time-.3,size=i18n.language==='ja'?9:10,lines=i18n.lines(i18n.ui('ending'),size,214);
   const y=Math.max(17,45-age*3.5),alpha=Math.min(1,age/.3,(5.5-time)/.8);
   ctx.save();ctx.globalAlpha=Math.max(0,alpha);ctx.font=`800 ${size}px "Microsoft JhengHei","Yu Gothic",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=2.5;ctx.strokeStyle='#21162f';ctx.fillStyle='#edc5ff';
   lines.forEach((line,j)=>{ctx.strokeText(line,116,y+j*(size+3));ctx.fillText(line,116,y+j*(size+3));});ctx.restore();
  }
 }
 return {loading,play,ending,boot,end,endingFrame,snapshot:()=>({progress,complete,error,language:i18n.language})};
};
