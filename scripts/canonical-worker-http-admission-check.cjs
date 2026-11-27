'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServiceRuntime}=require('../server/service-runtime.cjs'),{createHeadlessEngine}=require('../server/headless-engine.cjs'),{createProjectionWorkerTrial}=require('../server/projection-worker-trial.cjs'),{createGameAdmission}=require('../server/game-admission.cjs');
(async()=>{
 let rss=1;const g=createGameAdmission({rssLimitBytes:100,readRss:()=>rss});rss=100;a.equal(g.enter('heavy'),null);g.enter('metadata')(true);rss=NaN;a.equal(g.enter('heavy'),null);rss=99;g.enter('heavy')(true);a.equal(g.metrics().memory.rejected,2);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pl-worker-http-')),owner='a'.repeat(64),other='b'.repeat(64),deny=async()=>null,actual=createProjectionWorkerTrial(),engine=createHeadlessEngine();
 let hold=false,started,resume,calls=0,auths=0,fail=false;rss=1;
 const worker={async project(state){calls++;if(hold)await new Promise(r=>{resume=r;started();});if(fail)throw Error('fixture worker failure');return actual.project(state);}};
 const opts={dataDir:dir,authenticate:async t=>{auths++;return ['a','b'].includes(t)?{authenticated:true,account:t==='a'?owner:other}:{authenticated:false};},verifyRecentReauth:deny,verifyReceipt:deny,verifyCurrent:deny,verifyNotification:deny,verifyEvent:deny,verifyAction:deny,verifyCompletion:deny,canonicalEngine:engine,units:{android:{unit:'123',item:'ticket',amount:1}},projectionWorker:worker};
 a.throws(()=>createServiceRuntime(opts),/explicit RSS/);a.throws(()=>createServiceRuntime({...opts,gameLimits:{rssLimitBytes:100,heavyLimit:2}}),/single heavy/);
 const runtime=createServiceRuntime({...opts,gameLimits:{rssLimitBytes:100,readRss:()=>rss}});
 try{
  await new Promise(r=>runtime.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+runtime.server.address().port;
  const post=async(route,body,token='a')=>{const res=await fetch(base+'/v1/game/'+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,retry:res.headers.get('retry-after'),body:await res.json()};};
  const A=await post('create',{slot:1,command:{team:0}}),B=await post('create',{slot:1,command:{team:1}},'b');a.equal(A.status,200);a.equal(B.status,200);
  hold=true;const entered=new Promise(r=>{started=r;});const first=post('read',{slot:1});await entered;
  const before=auths;
  const blocked=await Promise.all([post('read',{slot:1},'b'),post('advance',{slot:1,world:B.body.world,revision:1,command:{step:1}},'b')]);
  a.ok(blocked.every(x=>x.status===503&&x.retry==='2'&&x.body.error==='game_busy'));a.equal(auths,before);a.equal(calls,1);
  a.equal((await post('slots',{},'b')).body[0].revision,1);a.equal((await fetch(base+'/healthz')).status,200);
  hold=false;resume();a.equal((await first).status,200);
  rss=100;const count=auths;a.equal((await post('read',{slot:1})).status,503);a.equal(auths,count);a.equal((await post('slots',{})).status,200);
  rss=1;fail=true;a.equal((await post('read',{slot:1})).status,403);fail=false;
  const recovered=await post('read',{slot:1});a.equal(recovered.status,200);a.equal(recovered.body.world,A.body.world);a.equal(recovered.body.revision,1);
  const metrics=runtime.metrics().gameAdmission;a.equal(metrics.heavy.peak,1);a.equal(metrics.heavy.active,0);a.equal(metrics.memory.rejected,1);a.equal(metrics.heavy.rejected,3);
  console.log('PASS actual engine HTTP worker: no concurrent heavy world operation, metadata/health available, soft RSS gate before auth, failure recovery and unchanged revision');
 }finally{if(hold&&resume){hold=false;resume();}await runtime.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
