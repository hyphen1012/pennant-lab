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
  const events=await service.achievements('a',1);a.ok(Array.isArray(events));for(const e of events.slice(0,3)){a.equal((await service.claim('a',1,e.eventId,'ticket')).result.ok,true);a.equal((await service.claim('a',1,e.eventId,'ticket')).result.reason,'duplicate');}
  // Test-only injury injection into an isolated server-created world; no HTTP
  // or production path accepts these snapshots. Actual game function executes.
  const s=engine.newWorld({}),p=s.players.find(p=>p.teamId===s.selectedId),date=s.year+'-04-01';
  p.injury={date,daysLeft:21,totalDays:21,level:'serious'};s.injuryArchive=[{year:s.year,teamId:s.selectedId,playerId:p.id,date,days:21}];
  const medical=engine.actions(s).find(x=>x.playerId===p.id);a.ok(medical);
  const result=engine.applyAction(s,medical);a.equal(result.result.after,11);a.equal(result.state.players.find(x=>x.id===p.id).injury.daysLeft,11);a.equal(result.state.injuryArchive[0].days,21);a.equal(s.players.find(x=>x.id===p.id).injury.daysLeft,21);
  a.throws(()=>engine.applyAction(result.state,medical));a.throws(()=>engine.applyAction(s,{route:'lottery',eventKey:'x'}));
  // Manager continuation uses the existing tenure rule. A new year has a
  // new eligible action; no lifetime cap. Synthetic years are isolated tests.
  const staff=engine.newWorld({}),team=staff.teams.find(t=>t.id===staff.selectedId),mgr=team.manager;
  staff.year=mgr.joinedYear+6;staff.day=97;a.equal(engine.actions(staff).some(x=>x.route==='manager'),false);
  staff.day=98;const retention=engine.actions(staff).find(x=>x.route==='manager');a.ok(retention);
  const continued=engine.applyAction(staff,retention);a.equal(continued.result.continuedThrough,staff.year+1);
  a.equal(continued.state.teams.find(t=>t.id===staff.selectedId).manager.tenureContinuedYear,staff.year);
  a.throws(()=>engine.applyAction(continued.state,retention));
  continued.state.year++;a.ok(engine.actions(continued.state).some(x=>x.route==='manager'));
  const archived=engine.newWorld({});archived.pendingMonth={year:archived.year,id:'fixture'};archived.monthlyArchive=[];
  a.throws(()=>engine.advance(archived,{acknowledge:'month'}),/not archived/);
  archived.monthlyArchive.push({...archived.pendingMonth});const ack=engine.advance(archived,{acknowledge:'month'});
  a.equal(ack.pendingMonth,null);a.equal(ack.monthlyArchive.length,1);a.equal(ack.day,archived.day);
  a.throws(()=>engine.advance(ack,{acknowledge:'rare'}));a.throws(()=>engine.advance(ack,{acknowledge:'month'}));
  // Actual server-origin results, not client-provided scores: compare the
  // engine's own recorded win IDs with its achievement projection.
  let actual=engine.newWorld({});for(let i=0;i<100&&actual.games.length===0;i++){
   const v=engine.view(actual);
   if(v.acknowledgements.month)actual=engine.advance(actual,{acknowledge:'month'});
   else if(v.acknowledgements.milestones)actual=engine.advance(actual,{acknowledge:'milestones'});
   else if(v.blocked)break;
   else actual=engine.advance(actual,{step:1});
  }
  a.ok(actual.games.length>0,'actual match required, not only calendar advancement');
  const expected=actual.games.filter(g=>(g.home===actual.selectedId&&g.homeScore>g.awayScore)||(g.away===actual.selectedId&&g.awayScore>g.homeScore)).map(g=>'win:'+g.year+':'+g.day);
  a.deepEqual(engine.achievements(actual).filter(x=>x.key.startsWith('win:')).map(x=>x.key).sort(),expected.sort());
  console.log('PASS actual checked-in headless engine pilot: initial world, calendar, own-club achievements, real medical mutation, isolation; not full season integration');
 }finally{ledger.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
