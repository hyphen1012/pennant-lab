const a=require('node:assert/strict'),{createHeadlessEngine}=require('../server/headless-engine.cjs'),{createGameAuthority}=require('../server/game-authority.cjs'),{openLedger}=require('../server/account-ledger.cjs');
(async()=>{
 const engine=createHeadlessEngine(),ledger=openLedger(':memory:'),owner='a'.repeat(64),other='b'.repeat(64);
 const service=createGameAuthority({ledger,engine,authenticate:async t=>({authenticated:['a','b'].includes(t),account:t==='a'?owner:other}),verifyRights:async()=>({verified:true,vip:false,adSkip:false}),hasAdProof:()=>true});
 try{
  await a.rejects(service.create('a',1,{seed:1937}));await a.rejects(service.create('a',1,{state:{}}));
  const initial=await service.create('a',1,{});a.equal(initial.game.year,2027);a.equal(initial.game.games,0);
  await service.create('b',1,{});await a.rejects(service.advance('a',1,1,{step:2}));
  let state=initial;
  for(let i=0;i<20&&!state.game.blocked&&state.game.games===0;i++)state=await service.advance('a',1,state.revision,{step:1});
  a.ok(state.revision>1);a.equal((await service.read('a',1)).revision,state.revision);a.equal((await service.read('b',1)).game.games,0);
  await a.rejects(service.advance('a',1,1,{step:1}));
  const events=await service.achievements('a',1);a.ok(events.length<=state.game.games);for(const e of events){a.equal((await service.claim('a',1,e.eventId,'ticket')).result.ok,true);a.equal((await service.claim('a',1,e.eventId,'ticket')).result.reason,'duplicate');}
  // Test-only injury injection into an isolated server-created world; no HTTP
  // or production path accepts these snapshots. Actual game function executes.
  const s=engine.newWorld({}),p=s.players.find(p=>p.teamId===s.selectedId),date=s.year+'-04-01';
  p.injury={date,daysLeft:21,totalDays:21,level:'serious'};s.injuryArchive=[{year:s.year,teamId:s.selectedId,playerId:p.id,date,days:21}];
  const medical=engine.actions(s).find(x=>x.playerId===p.id);a.ok(medical);
  const result=engine.applyAction(s,medical);a.equal(result.result.after,11);a.equal(result.state.players.find(x=>x.id===p.id).injury.daysLeft,11);a.equal(result.state.injuryArchive[0].days,21);a.equal(s.players.find(x=>x.id===p.id).injury.daysLeft,21);
  a.throws(()=>engine.applyAction(result.state,medical));a.throws(()=>engine.applyAction(s,{route:'lottery',eventKey:'x'}));
  console.log('PASS actual checked-in headless engine pilot: initial world, calendar, own-club achievements, real medical mutation, isolation; not full season integration');
 }finally{ledger.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
