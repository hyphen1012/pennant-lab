'use strict';
const a=require('node:assert/strict'),{openLedger}=require('../server/account-ledger.cjs'),{createGameAuthority}=require('../server/game-authority.cjs'),{createHeadlessEngine}=require('../server/headless-engine.cjs'),{createProjectionWorkerTrial}=require('../server/projection-worker-trial.cjs');
(async()=>{
 const owner='a'.repeat(64),other='b'.repeat(64),ledger=openLedger(':memory:'),engine=createHeadlessEngine(),actual=createProjectionWorkerTrial();
 let allowed=true,account=owner,hold=false,started,resume,fail=false,calls=0;
 const adapter={project(){throw Error('decoded fallback must not be called');},async projectEncoded(state){a.equal(typeof state,'string');calls++;if(hold){await new Promise(r=>{resume=r;started();});}if(fail)throw Error('fixture worker failure');return actual.projectEncoded(state);}};
 const args={ledger,engine,authenticate:async token=>({authenticated:allowed&&token==='a',account}),verifyRights:async()=>({verified:true,vip:false,adSkip:false}),hasAdProof:()=>false};
 const direct=createGameAuthority(args),asyncRead=createGameAuthority({...args,projectionWorker:adapter});
 try{
  const created=await direct.create('a',1,{team:0});
  a.deepEqual(await asyncRead.read('a',1),await direct.read('a',1));
  const gate=()=>{hold=true;return new Promise(r=>{started=r;});};
  let entered=gate(),read=asyncRead.read('a',1);await entered;
  const count=calls;await a.rejects(asyncRead.read('a',1),/busy/);a.equal(calls,count);
  a.equal((await direct.slots('a'))[0].world,created.world);
  ledger.transact(owner,(s,db)=>db.prepare('UPDATE authority_worlds SET revision=revision+1 WHERE account=? AND slot=1').run(owner));
  hold=false;resume();await a.rejects(read,/revision conflict/);
  a.equal((await asyncRead.read('a',1)).revision,2);
  entered=gate();read=asyncRead.read('a',1);await entered;allowed=false;hold=false;resume();await a.rejects(read,/unauthorized/);allowed=true;
  entered=gate();read=asyncRead.read('a',1);await entered;account=other;hold=false;resume();await a.rejects(read,/unauthorized/);account=owner;
  entered=gate();read=asyncRead.read('a',1);await entered;
  await direct.deleteWorld('a',1,created.world,2,true);const replacement=await direct.create('a',1,{team:1});
  hold=false;resume();await a.rejects(read,/revision conflict/);
  a.equal((await asyncRead.read('a',1)).world,replacement.world);
  fail=true;await a.rejects(asyncRead.read('a',1),/fixture worker failure/);fail=false;
  a.deepEqual(await asyncRead.read('a',1),await direct.read('a',1));
  entered=gate();read=asyncRead.read('a',1);await entered;
  ledger.transact(owner,s=>{s.points=5;});hold=false;resume();a.equal((await read).wallet.points,5);
  const stored=ledger.inspect(owner,(s,db)=>db.prepare('SELECT state FROM authority_worlds WHERE account=? AND slot=1').get(owner).state);
  ledger.transact(owner,(s,db)=>db.prepare('UPDATE authority_worlds SET state=? WHERE account=? AND slot=1').run('pl-gzip-v1:999:bad',owner));
  await a.rejects(asyncRead.read('a',1),/failed|exited/);a.equal((await direct.slots('a'))[0].world,replacement.world);
  ledger.transact(owner,(s,db)=>db.prepare('UPDATE authority_worlds SET state=? WHERE account=? AND slot=1').run(stored,owner));
  a.deepEqual(await asyncRead.read('a',1),await direct.read('a',1));
  console.log('PASS actual engine worker and authority: equal response, pre-decode admission, stale revision, revoked identity, account switch, delete/recreate, failure recovery');
 }finally{ledger.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
