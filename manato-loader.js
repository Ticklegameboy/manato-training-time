'use strict';
// Separate bounded queues keep optional audio from flooding image downloads.
window.ManatoLoader=(()=>{
 function pool(limit,stopOnError=false){
  let active=0;const queue=[];
  function pump(){while(active<limit&&queue.length){const {task,resolve,reject}=queue.shift();active++;Promise.resolve().then(task).then(resolve,error=>{reject(error);/* A disconnected queue should fail promptly, not time out in serial batches. */if(stopOnError)for(const waiting of queue.splice(0))waiting.reject(error);}).finally(()=>{active--;pump();});}}
  return task=>new Promise((resolve,reject)=>{queue.push({task,resolve,reject});pump();});
 }
 const pictures=pool(4,true),sounds=pool(2),images=new Map();
 async function retry(task){let error;for(let attempt=0;attempt<2;attempt++){try{return await task();}catch(e){error=e;}}throw error;}
 function deadline(task,url,cancel){
  return new Promise((resolve,reject)=>{
   let finished=false;
   const finish=(error,value)=>{if(finished)return;finished=true;window.clearTimeout(timer);if(error){error.assetURL=url;reject(error);}else resolve(value);};
   const timer=window.setTimeout(()=>{finish(new Error('Asset timed out: '+url));cancel?.();},30000);
   Promise.resolve().then(task).then(value=>finish(null,value),error=>finish(error));
  });
 }
 function image(url){
  if(images.has(url))return images.get(url);
  const promise=pictures(()=>retry(()=>{
   const im=new Image();
   return deadline(()=>new Promise((resolve,reject)=>{im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Image unavailable: '+url));im.src=url;}),url,()=>{im.onload=im.onerror=null;im.src='';});
  }));
  images.set(url,promise);promise.catch(()=>images.delete(url));return promise;
 }
 function audio(url,context){
  return sounds(()=>retry(()=>{
   const controller=typeof AbortController==='function'?new AbortController():null;
   return deadline(async()=>{
    const response=await fetch(url,controller?{signal:controller.signal}:{});
    if(!response.ok)throw new Error('Audio unavailable: '+url);
    return await context.decodeAudioData(await response.arrayBuffer());
   },url,()=>controller?.abort());
  }));
 }
 return {image,audio};
})();
