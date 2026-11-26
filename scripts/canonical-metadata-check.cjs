const a=require('node:assert/strict'),{openLedger}=require('../server/account-ledger.cjs'),{createGameAuthority}=require('../server/game-authority.cjs');
(async()=>{
 const ledger=openLedger(':memory:'),owner='a'.repeat(64),other='b'.repeat(64);
 const engine={preview:s=>({tick:s.tick}),newWorld:()=>({tick:0}),actions:()=>[{route:'medical',year:2027,eventKey:'1:2027-01-01',label:'treatment'}],achievements:()=>[],view:s=>({tick:s.tick}),advance:s=>({...s,tick:s.tick+1}),applyAction:s=>({state:{tick:s.tick+1},result:{done:true}})};
 const service=createGameAuthority({ledger,engine,authenticate:async t=>({authenticated:true,account:t==='a'?owner:other}),verifyRights:async()=>({verified:true,vip:false,adSkip:false}),hasAdProof:()=>false});
 try{
  const w=await service.create('a',1,{});await service.create('a',3,{});const otherWorld=await service.create('b',2,{});
  a.deepEqual((await service.slots('a')).map(x=>x.slot),[1,3]);a.deepEqual((await service.slots('b')).map(x=>x.slot),[2]);
  const op=(await service.read('a',1)).actions[0].operationId,r=await service.reserve('a',1,op,'ad');
  // Only metadata can be read with a deliberately invalid compressed state.
  ledger.transact(owner,(s,db)=>db.prepare('UPDATE authority_worlds SET state=? WHERE account=? AND slot=1').run('pl-gzip-v1:INVALID',owner));
  a.equal((await service.slots('a'))[0].world,w.world);
  a.deepEqual((await service.slots('a'))[0].preview,{tick:0});
  // Old rows without previews are still visible and never decoded for listing.
  ledger.transact(owner,(s,db)=>db.prepare('UPDATE authority_worlds SET preview=NULL WHERE account=? AND slot=3').run(owner));
  a.equal(Object.hasOwn((await service.slots('a'))[1],'preview'),false);
  a.equal((await service.orderStatus('a',1,op)).order.status,'pending');
  a.equal((await service.settle('a',1,op,r.attempt)).status,'awaiting_proof');
  await a.rejects(service.advance('a',1,w.world,0,{step:1}),/revision conflict/);
  await a.rejects(service.advance('a',1,otherWorld.world,1,{step:1}),/revision conflict/);
  await a.rejects(service.advance('a',1,w.world,1,{step:1}),/reward reconciliation/);
  await a.rejects(service.read('a',1),/compressed state/);
  a.equal((await service.cancel('a',1,op,r.attempt,true)).status,'cancelled');
  await a.rejects(service.advance('a',1,w.world,1,{step:1}),/compressed state/);
  ledger.inspect(owner,(s,db)=>{s.tickets=30;db.prepare('UPDATE authority_worlds SET revision=999 WHERE account=?').run(owner);});
  a.equal((await service.slots('a'))[0].revision,1);
  a.equal((await service.orderStatus('a',1,op)).wallet.tickets,0);
  a.equal((await service.read('b',2)).revision,1);
  await service.advance('b',2,otherWorld.world,1,{step:1});a.deepEqual((await service.slots('b'))[0].preview,{tick:1});
  console.log('PASS metadata-only slots, order recovery, stale revision and pending guards; read-only rollback and isolation');
 }finally{ledger.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
