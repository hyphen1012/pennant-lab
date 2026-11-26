'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServiceRuntime}=require('../server/service-runtime.cjs'),{createGameAdmission}=require('../server/game-admission.cjs');
(async()=>{
 let clock=0;const admission=createGameAdmission({heavyLimit:1,metadataLimit:1,now:()=>clock});
 const release=admission.enter('heavy');a.equal(admission.enter('heavy'),null);const meta=admission.enter('metadata');clock=20;release(true);release(false);meta(false);
 const m=admission.metrics();a.equal(m.heavy.active,0);a.equal(m.heavy.completed,1);a.equal(m.heavy.rejected,1);a.equal(m.heavy.meanMs,20);a.equal(m.metadata.failed,1);a.throws(()=>createGameAdmission({heavyLimit:0}));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pl-admission-')),owner='a'.repeat(64),other='b'.repeat(64),deny=async()=>null;
 let hold=false,resume,entered,authCount=0,engineCalls=0;
 const engine={newWorld:()=>({tick:0}),view:s=>({tick:s.tick}),preview:s=>({tick:s.tick}),actions:()=>[],achievements:()=>[],advance:s=>{engineCalls++;return {tick:s.tick+1};},applyAction:()=>{throw Error('unused')}};
 const runtime=createServiceRuntime({dataDir:dir,gameLimits:{heavyLimit:1,metadataLimit:1},authenticate:async token=>{authCount++;if(token==='a'&&hold){await new Promise(r=>{resume=r;entered();});}return ['a','b'].includes(token)?{authenticated:true,account:token==='a'?owner:other}:{authenticated:false};},verifyRecentReauth:deny,verifyReceipt:deny,verifyCurrent:deny,verifyNotification:deny,verifyEvent:deny,verifyAction:deny,verifyCompletion:deny,canonicalEngine:engine,units:{android:{unit:'123',item:'ticket',amount:1}},origins:[]});
 try{
  await new Promise(r=>runtime.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+runtime.server.address().port;
  const post=async(route,body,token='a')=>{const res=await fetch(base+'/v1/game/'+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,retry:res.headers.get('retry-after'),body:await res.json()};};
  const wa=(await post('create',{slot:1,command:{}})).body,wb=(await post('create',{slot:1,command:{}},'b')).body;
  hold=true;const waiting=new Promise(r=>{entered=r;});
  const first=post('advance',{slot:1,world:wa.world,revision:1,command:{step:1}});await waiting;
  const count=authCount;
  const busy=await post('advance',{slot:1,world:wb.world,revision:1,command:{step:1}},'b');
  a.equal(busy.status,503);a.equal(busy.retry,'2');a.equal(busy.body.error,'game_busy');a.equal(authCount,count);a.equal(engineCalls,0);
  const slots=await post('slots',{},'b');a.equal(slots.status,200);a.equal(slots.body[0].revision,1);
  a.equal((await fetch(base+'/healthz')).status,200);
  hold=false;resume();const done=await first;a.equal(done.status,200);a.equal(done.body.revision,2);a.equal(engineCalls,1);
  const read=await post('read',{slot:1},'b');a.equal(read.status,200);a.equal(read.body.revision,1);
  a.equal((await post('advance',{slot:1,world:wa.world,revision:1,command:{step:1}})).status,403);a.equal(engineCalls,1);
  a.equal((await post('read',{slot:9})).status,400);
  a.equal((await post('read',{slot:1})).status,200);
  const metrics=runtime.metrics().gameAdmission;a.equal(metrics.heavy.active,0);a.equal(metrics.heavy.peak,1);a.equal(metrics.heavy.rejected,1);a.equal(metrics.heavy.failed,2);a.equal(metrics.metadata.active,0);a.ok(metrics.heavy.maxMs>=metrics.heavy.meanMs);
  console.log('PASS actual HTTP admission, independent metadata/health, busy before auth, no duplicate mutation, release on errors and latency counters');
 }finally{if(hold&&resume){hold=false;resume();}await runtime.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
