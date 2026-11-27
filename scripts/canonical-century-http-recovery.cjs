'use strict';
// CI-only synthetic database. Never expose a state-import route or persist raw artifacts.
const a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto'),{performance}=require('node:perf_hooks');
const {openLedger}=require('../server/account-ledger.cjs'),{createServiceRuntime}=require('../server/service-runtime.cjs'),{createHeadlessEngine}=require('../server/headless-engine.cjs'),{createProjectionWorkerTrial}=require('../server/projection-worker-trial.cjs');
const hash=x=>createHash('sha256').update(x).digest('hex');
const root=process.argv[5],owner='a'.repeat(64),other='b'.repeat(64),world=randomUUID(),revision=17,dir=path.join(root,'http-db'),file=path.join(dir,'account.sqlite');
const meta=JSON.parse(fs.readFileSync(path.join(root,'world-meta.json'),'utf8')),encoded=fs.readFileSync(path.join(root,'world.stored'),'utf8'),stored=JSON.parse(fs.readFileSync(path.join(root,'encode.json'),'utf8'));
const expected=JSON.parse(fs.readFileSync(path.join(root,'sync.json'),'utf8')),report={mode:'http',years:meta.years,passed:false,storedBytes:stored.bytes,world:meta};
const deny=async()=>null,engine=createHeadlessEngine(),actual=createProjectionWorkerTrial();
let runtime,release,entered,gate,first,hold=true,calls=0,timer,projectionHash,gameHash;
const edit=fn=>{const ledger=openLedger(file);try{return ledger.transact(owner,fn);}finally{ledger.close();}};
const inspect=()=>{const ledger=openLedger(file);try{return ledger.inspect(owner,(s,db)=>{const row=db.prepare('SELECT world,revision,state FROM authority_worlds WHERE account=? AND slot=1').get(owner);return {world:row.world,revision:row.revision,stateHash:hash(row.state),points:s.points};});}finally{ledger.close();}};
const worker={project(){throw Error('decoded fallback forbidden in this fixture');},async projectEncoded(state){
 a.equal(typeof state,'string');calls++;
 if(hold){
  const pending=actual.projectEncoded(state);pending.catch(()=>{});
  entered();await gate;const p=await pending;projectionHash=hash(JSON.stringify(p));gameHash=hash(JSON.stringify(p.game));return p;
 }
 return actual.projectEncoded(state);
}};
const opts={dataDir:dir,authenticate:async t=>['a','b'].includes(t)?{authenticated:true,account:t==='a'?owner:other}:{authenticated:false},verifyRecentReauth:deny,verifyReceipt:deny,verifyCurrent:deny,verifyNotification:deny,verifyEvent:deny,verifyAction:deny,verifyCompletion:deny,canonicalEngine:engine,units:{android:{unit:'123',item:'ticket',amount:1}},projectionWorker:worker,gameLimits:{rssLimitBytes:4*1024**3}};
async function start(){runtime=createServiceRuntime(opts);await new Promise((ok,bad)=>{runtime.server.once('error',bad);runtime.server.listen(0,'127.0.0.1',ok);});return 'http://127.0.0.1:'+runtime.server.address().port;}
async function post(base,route,body,token='a'){const res=await fetch(base+'/v1/game/'+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,retry:res.headers.get('retry-after'),body:await res.json()};}
(async()=>{
 try{
  a.equal(hash(encoded),stored.sha256);a.equal(Buffer.byteLength(encoded),stored.bytes);a.equal(engine.sourceHash,expected.sourceHash);
  fs.mkdirSync(dir,{mode:0o700});edit((s,db)=>{s.points=5;db.prepare('INSERT INTO authority_worlds(account,slot,world,revision,state) VALUES(?,?,?,?,?)').run(owner,1,world,revision,encoded);});
  const initial=inspect();let base=await start(),ticks=0;
  gate=new Promise(r=>{release=r;});const ready=new Promise(r=>{entered=r;});
  timer=setInterval(()=>ticks++,20);const begin=performance.now();
  first=post(base,'read',{slot:1});first.catch(()=>{});await Promise.race([ready,first.then(()=>{throw Error('read did not enter encoded worker');})]);
  const metaStart=performance.now();
  const [health,slots,blocked,mutation]=await Promise.all([fetch(base+'/healthz'),post(base,'slots',{}),post(base,'read',{slot:1},'b'),post(base,'advance',{slot:1,world,revision,command:{step:1}},'b')]);
  report.metadataProbeMs=performance.now()-metaStart;
  a.equal(health.status,200);await health.json();a.equal(slots.status,200);a.equal(slots.body[0].world,world);a.equal(slots.body[0].revision,revision);
  for(const x of [blocked,mutation]){a.equal(x.status,503);a.equal(x.retry,'2');a.equal(x.body.error,'game_busy');}
  a.equal(calls,1);hold=false;release();const result=await first;clearInterval(timer);timer=null;
  report.httpReadMs=performance.now()-begin;report.intervalTicks=ticks;
  a.equal(result.status,200);a.equal(result.body.world,world);a.equal(result.body.revision,revision);a.equal(result.body.game.year,meta.year);a.equal(result.body.game.team.id,meta.selectedId);a.equal(result.body.wallet.points,5);
  a.equal(projectionHash,expected.projectionSha256);a.equal(hash(JSON.stringify(result.body.game)),gameHash);a.ok(ticks>0);a.deepEqual(inspect(),initial);
  a.equal((await post(base,'read',{slot:1},'b')).status,403);
  edit((s,db)=>db.prepare('UPDATE authority_worlds SET state=? WHERE account=? AND slot=1').run('pl-gzip-v1:999:bad',owner));
  a.equal((await post(base,'read',{slot:1})).status,403);a.equal((await post(base,'slots',{})).body[0].revision,revision);
  edit((s,db)=>db.prepare('UPDATE authority_worlds SET state=? WHERE account=? AND slot=1').run(encoded,owner));
  const recovered=await post(base,'read',{slot:1});a.deepEqual(recovered,result);a.deepEqual(inspect(),initial);
  report.admission=runtime.metrics().gameAdmission;a.equal(report.admission.heavy.peak,1);a.equal(report.admission.heavy.active,0);a.equal(report.admission.heavy.rejected,2);
  await runtime.close();runtime=null;base=await start();const restarted=await post(base,'read',{slot:1});a.deepEqual(restarted,result);a.deepEqual(inspect(),initial);
  report.projectionSha256=projectionHash;report.sourceHash=engine.sourceHash;report.gameSha256=gameHash;report.calls=calls;report.passed=true;
 }catch(e){report.error=String(e);throw e;}
 finally{clearInterval(timer);hold=false;release?.();if(first)await first.catch(()=>{});if(runtime)await runtime.close();report.maxRssKiB=process.resourceUsage().maxRSS;fs.writeFileSync(path.join(root,'http.json'),JSON.stringify(report,null,2));console.log('CENTURY HTTP',JSON.stringify(report));}
})().catch(e=>{console.error(e);process.exitCode=1;});
