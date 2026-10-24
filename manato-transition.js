'use strict';
window.createPixelTransition=function(){
 const canvas=document.getElementById('pixelTransition'),ctx=canvas.getContext('2d'),main=document.querySelector('main');
 let active=false,time=0,commit=null,committed=false,reduced=false;
 function resize(){canvas.width=320;canvas.height=Math.ceil(320*(window.innerHeight||800)/(window.innerWidth||512));ctx.imageSmoothingEnabled=false;}
 function start(action){if(active)return false;resize();active=true;time=0;commit=action;committed=false;reduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;canvas.hidden=false;main.inert=true;draw();return true;}
 function draw(){
  const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.globalAlpha=1;
  if(!active)return;
  const close=reduced?.08:.42,hold=reduced?.16:.62,finish=reduced?.24:1.12;
  const full=time>=close&&time<=hold;
  if(full||reduced){ctx.fillStyle='#0b0e13';ctx.fillRect(0,0,w,h);}
  else{
   const progress=time<close?time/close:1-(time-hold)/(finish-hold);
   const rows=Math.ceil(h/16),cols=20;
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const rank=(x/cols*.64+y/rows*.24+((x*7+y*11)%9)/9*.12);
    if(rank>progress*1.12)continue;
    ctx.fillStyle=rank>progress*1.12-.065?'#ddf650':'#0b0e13';ctx.fillRect(x*16,y*16,16,16);
    if(rank>progress*1.12-.065){ctx.fillStyle='#222b22';ctx.fillRect(x*16+4,y*16+4,8,4);}
   }
  }
  if(full&&!reduced){
   const mid=Math.floor(h/2);ctx.fillStyle='#d9f64b';ctx.fillRect(0,mid-18,w,36);
   ctx.fillStyle='#11171b';for(let x=-32;x<w+32;x+=32){const dx=Math.floor(time*80/4)*4;for(let y=0;y<9;y++)ctx.fillRect(((x+dx)%384)-32+y*4,mid-18+y*4,12,4);}
   ctx.fillStyle='#0b0e13';ctx.fillRect(97,mid-12,126,24);ctx.fillStyle='#ecff8b';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText('READY >>',160,mid+4);
   ctx.fillStyle='#52603a';ctx.fillRect(0,mid+24,Math.floor(w*((time-close)/(hold-close))),2);
  }
 }
 function step(dt){if(!active)return;time+=dt;draw();const commitAt=reduced?.12:.5,end=reduced?.24:1.12;
  // Reset only inside the fully opaque hold. Simulation stays frozen through reveal.
  if(!committed&&time>=commitAt){committed=true;commit();}
  if(time>=end){active=false;canvas.hidden=true;main.inert=false;commit=null;ctx.clearRect(0,0,canvas.width,canvas.height);}
 }
 return {start,step,get active(){return active;},snapshot:()=>({active,time,committed})};
};
