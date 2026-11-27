'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServiceRuntime}=require('../server/service-runtime.cjs'),{createHeadlessEngine}=require('../server/headless-engine.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'pl-direct-runtime-')),dataDir=path.join(root,'data'),owner='a'.repeat(64),deny=async()=>null;
const engine=createHeadlessEngine(),opts={dataDir,authenticate:async t=>t==='a'?{authenticated:true,account:owner}:{authenticated:false},verifyRecentReauth:deny,verifyReceipt:deny,verifyCurrent:deny,verifyNotification:deny,verifyEvent:deny,verifyAction:deny,verifyCompletion:deny,canonicalEngine:engine,units:{android:{unit:'123',item:'ticket',amount:1}}};
let runtime;
async function open(extra){runtime=createServiceRuntime({...opts,...extra});await new Promise((ok,bad)=>{runtime.server.once('error',bad);runtime.server.listen(0,'127.0.0.1',ok);});return 'http://127.0.0.1:'+runtime.server.address().port;}
async function close(){if(runtime){await runtime.close();runtime=null;}}
async function post(base,route,body,token='a'){const res=await fetch(base+'/v1/game/'+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,body:await res.json()};}
(async()=>{
 try{
  const config={projectionMode:'direct-text',gameLimits:{rssLimitBytes:2*1024**3}};
  for(const x of [{projectionMode:'auto'}, {...config,projectionWorker:{}},{...config,canonicalEngine:null},{projectionMode:'direct-text'}, {...config,gameLimits:{rssLimitBytes:2*1024**3,heavyLimit:2}},{...config,environment:'production'}])a.throws(()=>createServiceRuntime({...opts,...x}));
  a.equal(fs.existsSync(dataDir),false);
  let base=await open({});a.equal((await post(base,'create',{slot:1,command:{team:0}})).status,200);
  const before=await post(base,'read',{slot:1});a.equal(before.status,200);await close();
  base=await open(config);a.deepEqual(await post(base,'read',{slot:1}),before);a.equal((await post(base,'read',{slot:1},'b')).status,403);
  const next=await post(base,'advance',{slot:1,world:before.body.world,revision:before.body.revision,command:{calendar:'day'}});a.equal(next.status,200);
  const after=await post(base,'read',{slot:1});a.equal(after.status,200);a.equal(after.body.revision,before.body.revision+1);
  a.equal(runtime.metrics().gameAdmission.heavy.peak,1);await close();
  base=await open({});a.deepEqual(await post(base,'read',{slot:1}),after);await close();
  console.log('PASS explicit staging direct-text composition, invalid configuration refusal before database creation, real HTTP read and mutation parity, restart with default mode');
 }finally{await close();fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
