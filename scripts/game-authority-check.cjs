const assert=require('node:assert/strict'),{openLedger,createAccountService}=require('../server/account-ledger.cjs'),{createGameAuthority}=require('../server/game-authority.cjs'),{rosterTreatment,retainManager}=require('../server/canonical-care.cjs');
(async()=>{
 const ledger=openLedger(':memory:'),owner='a'.repeat(64),other='b'.repeat(64);let now=1700000000000,paid=false,proofs=new Set(),fail=false;
 const routeKeys=['draft-revival','foreign-revival','lottery','fa-retention','fa-sign','retirement','manager','medical'];
 const engine={
  newWorld(command){if(Object.keys(command).join(',')!=='team'||command.team!==0)throw Error('invalid setup');return {year:2033,day:100,selectedId:0,teams:[{id:0,manager:{id:'mgr',joinedYear:2027}}],players:[{id:1,teamId:0,injury:{date:'2033-05-01',daysLeft:9}}],done:[],tick:0};},
  actions(s){return routeKeys.filter(k=>!s.done.includes(k)).map(route=>({route,year:s.year,eventKey:route==='medical'?'1:2033-05-01':route==='manager'?'mgr':'evt',label:route}));},
  achievements(s){return Array.from({length:s.tick},(_,i)=>({key:'win:'+i,label:'win',eligible:true}));},
  applyAction(s,a){
   if(fail)throw Error('engine mutation failed');
   let result={route:a.route};
   if(a.route==='medical')result=rosterTreatment(s,1,'2033-05-01');
   if(a.route==='manager')result=retainManager(s,'mgr',s.year);
   if(!result)throw Error('ineligible');s.done.push(a.route);return {state:s,result};
  },
  advance(s,cmd,rights){assert.deepEqual(rights,{verified:true,vip:paid,adSkip:false});if(Object.keys(cmd).join(',')!=='step'||cmd.step!==1)throw Error('bad command');s.tick++;return s;},
  view(s){return {done:s.done,tick:s.tick,days:s.players[0].injury.daysLeft,manager:s.teams[0].manager.tenureContinuedYear??null};}
 };
 const service=createGameAuthority({ledger,engine,authenticate:async t=>({authenticated:true,account:t==='owner'?owner:other}),verifyRights:async()=>({verified:true,vip:paid,adSkip:false}),hasAdProof:x=>proofs.has(x.operationId+':'+x.attempt),now:()=>now});
 try{
  await assert.rejects(service.create('owner',1,{team:0,state:{}}));
  const w=await service.create('owner',1,{team:0});await service.create('other',1,{team:0});await assert.rejects(service.create('owner',1,{team:0}));
  await assert.rejects(service.advance('owner',1,w.world,w.revision,{step:2}));assert.equal((await service.read('owner',1)).revision,1);
  for(let i=0;i<4;i++){let r=await service.read('owner',1);await service.advance('owner',1,r.world,r.revision,{step:1});}
  const events=await service.achievements('owner',1);assert.equal(events.length,4);
  await assert.rejects(service.claim('other',1,events[0].eventId,'ticket'));
  for(let i=0;i<3;i++)assert.equal((await service.claim('owner',1,events[i].eventId,'ticket')).result.ok,true);
  assert.equal((await service.claim('owner',1,events[0].eventId,'ticket')).result.reason,'duplicate');
  assert.equal((await service.claim('owner',1,events[3].eventId,'ticket')).result.reason,'cooldown');
  now+=3600000;assert.equal((await service.claim('owner',1,events[3].eventId,'ticket')).result.ok,true);
  const opts=(await service.read('owner',1)).actions,med=opts.find(x=>x.route==='medical').operationId,mgr=opts.find(x=>x.route==='manager').operationId;
  await assert.rejects(service.reserve('other',1,med,'ticket'));
  const before=await service.read('owner',1),r=await service.reserve('owner',1,med,'ticket');assert.equal(r.mode,'ticket');
  const legacy=createAccountService({ledger,authenticate:async()=>({authenticated:true,account:owner}),verifyEntitlements:async()=>null,verifyEvent:async()=>null,verifyAction:async()=>({verified:true,eligible:true,account:owner,id:med}),verifyCompletion:async()=>({verified:true,account:owner,id:med,mode:'ticket',attempt:r.attempt,applied:true})});
  await assert.rejects(legacy.finish('owner','fixture'),/canonical action/);
  await assert.rejects(service.advance('owner',1,before.world,before.revision,{step:1}));await assert.rejects(service.reserve('owner',1,mgr,'ticket'));
  fail=true;await assert.rejects(service.settle('owner',1,med,r.attempt));assert.equal((await service.read('owner',1)).wallet.tickets,4);assert.equal((await service.read('owner',1)).game.days,9);
  fail=false;const treatment=await service.settle('owner',1,med,r.attempt);assert.equal(treatment.result.after,5);assert.equal(treatment.wallet.tickets,3);
  assert.equal((await service.settle('owner',1,med,r.attempt)).replay,true);assert.equal((await service.read('owner',1)).wallet.tickets,3);
  const ad=await service.reserve('owner',1,mgr,'ad');assert.equal((await service.settle('owner',1,mgr,ad.attempt)).status,'awaiting_proof');proofs.add(mgr+':'+ad.attempt);
  assert.equal((await service.cancel('owner',1,mgr,ad.attempt,true)).status,'settlement_required');assert.equal((await service.settle('owner',1,mgr,ad.attempt)).result.continuedThrough,2034);
  paid=true;const a=opts.find(x=>x.route==='lottery').operationId,ent=await service.reserve('owner',1,a,'ad');assert.equal(ent.mode,'entitlement');paid=false;
  assert.equal((await service.settle('owner',1,a,ent.attempt)).status,'entitlement_expired');await service.cancel('owner',1,a,ent.attempt,true);
  paid=true;const retry=await service.reserve('owner',1,a,'ad');assert.equal(retry.attempt,2);await assert.rejects(service.settle('owner',1,a,1));assert.equal((await service.settle('owner',1,a,2)).status,'committed');
  for(const k of routeKeys.filter(x=>!['medical','manager','lottery'].includes(x))){const op=opts.find(x=>x.route===k).operationId,r=await service.reserve('owner',1,op,'ad');assert.equal((await service.settle('owner',1,op,r.attempt)).status,'committed');}
  assert.equal((await service.read('owner',1)).actions.length,0);assert.equal((await service.read('other',1)).game.done.length,0);
  console.log('PASS canonical action/achievement identity, atomic game+wallet commit, rollback/replay, ticket, SSV evidence, expiry and account isolation (fixture engine; real medical/manager rules)');
 }finally{ledger.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
