'use strict';
// Experimental read-only projection. No database, credentials or mutation path in worker.
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {createHeadlessEngine}=require('./headless-engine.cjs');
if(!isMainThread){
 try{
  const engine=createHeadlessEngine();
  const state=workerData.encoded===true?require('./canonical-state-codec.cjs').createCanonicalStateCodec().decode(workerData.state):workerData.state;
  parentPort.postMessage({ok:true,projection:engine.readProjection(state)});
 }catch{parentPort.postMessage({ok:false});}
}else{
 function createProjectionWorkerTrial({timeoutMs=30000,maxOldGenerationSizeMb=1024}={}){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000||
     !Number.isInteger(maxOldGenerationSizeMb)||maxOldGenerationSizeMb<128||maxOldGenerationSizeMb>4096)throw Error('invalid worker trial limits');
  let busy=false;
  async function run(state,encoded){
   if(busy)throw Error('projection worker busy');
   busy=true;let worker,timer;
   try{
    worker=new Worker(__filename,{workerData:{state,encoded},resourceLimits:{maxOldGenerationSizeMb}});
    return await new Promise((resolve,reject)=>{
     timer=setTimeout(()=>reject(Error('projection worker timeout')),timeoutMs);
     worker.once('message',m=>{
      if(m?.ok!==true||!m.projection?.game||!Array.isArray(m.projection.actions))return reject(Error('projection worker failed'));
      resolve(m.projection);
     });
     worker.once('error',()=>reject(Error('projection worker failed')));
     worker.once('exit',()=>reject(Error('projection worker exited')));
    });
   }finally{
    clearTimeout(timer);
    try{if(worker)await worker.terminate();}finally{busy=false;}
   }
  }
  return Object.freeze({project:state=>run(state,false),projectEncoded:state=>run(state,true)});
 }
 module.exports={createProjectionWorkerTrial};
}
