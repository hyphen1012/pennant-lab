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
  // Selection only; server owns all state and the seed.
  for(const teamId of [0,11]){const w=engine.newWorld({team:teamId});a.equal(w.selectedId,teamId);a.equal(engine.view(w).team.id,teamId);a.notEqual(w.seed,w.clubLogoSeed,'generation must preserve consumed RNG cursor');}
  for(const cmd of [{team:-1},{team:12},{team:'2'},{team:2,seed:1},{team:2,vip:true}])a.throws(()=>engine.newWorld(cmd));
  const career=engine.newWorld({}),cp=career.players.find(p=>p.teamId===career.selectedId);
  career.day=75;cp.retirePlan={year:career.year,teamId:career.selectedId,status:'consult',options:[],date:career.year+'-07-15'};
  career.careerEventQueue=[{year:career.year,teamId:career.selectedId,id:cp.id,type:'consult',date:cp.retirePlan.date}];
  const choice=engine.actions(career).find(x=>x.route==='retirement');a.ok(choice);
  const retained=engine.applyAction(career,choice);a.equal(retained.result.playerId,cp.id);a.equal(retained.state.players.find(p=>p.id===cp.id).retirePlan.status,'continued');a.equal(retained.state.careerEventQueue.length,0);
  a.equal(cp.retirePlan.status,'consult');a.throws(()=>engine.applyAction(retained.state,choice));
  career.careerEventQueue[0].type='plan';a.ok(!engine.actions(career).some(x=>x.route==='retirement'));
  a.throws(()=>engine.applyAction(career,choice));career.careerEventQueue[0].type='consult';cp.teamId=(career.selectedId+1)%12;a.ok(!engine.actions(career).some(x=>x.route==='retirement'));
  // An identical persisted snapshot must replay the same transition.
  const fresh=engine.newWorld({team:0});
  a.deepEqual(engine.advance(fresh,{step:1}),engine.advance(JSON.parse(JSON.stringify(fresh)),{step:1}));
  a.throws(()=>engine.advance(fresh,{step:1,vip:true}));
  // Compare actual monthly game accounting from identical snapshots. Do not
  // inject cash or mock the game economy. Retry fresh worlds if a rare event
  // intentionally stops the limited pilot before a monthly settlement.
  let checkedVip=false;
  for(let attempt=0;attempt<5&&!checkedVip;attempt++){
   let w=engine.newWorld({team:attempt});
   for(let day=0;day<80;day++){
    const v=engine.view(w);
    if(v.acknowledgements.month){w=engine.advance(w,{acknowledge:'month'});continue;}
    if(v.acknowledgements.milestones){w=engine.advance(w,{acknowledge:'milestones'});continue;}
    if(v.blocked)break;
    const normal=engine.advance(w,{step:1},{verified:true,vip:false});
    const paid=engine.advance(w,{step:1},{verified:true,vip:true});
    const earned=engine.view(paid).vipIncome;
    a.equal(engine.view(normal).vipIncome,0);
    if(earned>0){a.equal(engine.view(engine.advance(w,{step:1},{verified:false,vip:true})).vipIncome,0);for(const t of paid.teams.filter(t=>t.id!==w.selectedId))a.equal(t.cash,normal.teams.find(x=>x.id===t.id).cash);checkedVip=true;break;}
    w=normal;
   }
  }
  a.ok(checkedVip,'actual VIP settlement required');
  // Use actual generated candidates; only event/offer states are fixtures.
  // No public command or endpoint accepts these test snapshots.
  {
  const base=engine.advance(engine.newWorld({}),{step:1});
  const clone=()=>JSON.parse(JSON.stringify(base));
  const action=(w,route)=>engine.actions(w).find(x=>x.route===route);
  const club=w=>w.teams.find(t=>t.id===w.selectedId);
  const ownPlayer=w=>w.players.find(p=>p.teamId===w.selectedId);
  const verify=(w,route)=>{const op=action(w,route);a.ok(op,route+' available');const snapshot=JSON.stringify(w);const result=engine.applyAction(w,op);a.equal(JSON.stringify(w),snapshot);a.throws(()=>engine.applyAction(result.state,op),/unavailable/);return result;};
  const d=clone(),dc=d.draft.candidates.find(c=>c.status==='available'),fee=.1,salary=.2;
  d.ceremonyStage='draft';d.draft.phase='negotiate';d.draft.picks=[{teamId:d.selectedId,candidateId:dc.id,status:'refused',recoveryPending:true,offers:[{fee,salary,accepted:false}]}];dc.status='refused';
  const low=JSON.parse(JSON.stringify(d));club(low).cash=0;a.ok(!action(low,'draft-revival'));
  const wrong=JSON.parse(JSON.stringify(d));wrong.draft.picks[0].teamId=(d.selectedId+1)%12;a.ok(!action(wrong,'draft-revival'));
  const drafted=verify(d,'draft-revival');a.equal(drafted.state.draft.picks[0].status,'signed');a.ok(Math.abs(club(d).cash-club(drafted.state).cash-fee)<1e-7);
  const draw=clone(),cid=draw.draft.candidates[0].id;draw.ceremonyStage='draft';Object.assign(draw.draft,{phase:'lottery',round:1,autoRequested:false,lotteryRewardUsed:false,pendingLottery:{stage:'choose',attempt:1,cursor:0,groups:[{cid,ids:[draw.selectedId,(draw.selectedId+1)%12]}]}});
  const drawn=verify(draw,'lottery');a.equal(drawn.result.winner,draw.selectedId);a.equal(drawn.result.stage,'sealed');a.equal(drawn.state.draft.lotteryRewardUsed,true);
  const f=clone(),fc=f.foreignMarket.candidates.find(c=>c.status==='available');fc.status='refused';
  f.foreignMarket.negotiations??={};
  f.foreignMarket.negotiations[f.selectedId]={candidateId:fc.id,resultOpened:true,status:'refused',offer:{fee:.1,salary:.2,level:1,supportCost:0,benefits:{interpreter:false,housing:false}}};
  const noRoom=JSON.parse(JSON.stringify(f));club(noRoom).cash=0;a.ok(!action(noRoom,'foreign-revival'));
  const signed=verify(f,'foreign-revival');a.equal(signed.state.players.find(p=>p.id===fc.id).teamId,f.selectedId);a.ok(Math.abs(club(f).cash-club(signed.state).cash-.1)<1e-7);
  for(const kind of ['fa','posting','overseas-fa']){
   const w=clone(),p=ownPlayer(w);w.ceremonyStage='movement-declarations';w.movement={year:w.year,requests:[{id:p.id,from:w.selectedId,year:w.year,kind,status:'refused',demand:1,offer:1,minimum:1.1}],deals:[],offers:{},history:[],declared:true,closed:false};
   const result=verify(w,'fa-retention');a.equal(result.state.movement.requests[0].status,'retained');a.equal(club(w).cash,club(result.state).cash);
  }
  const fa=clone(),p=fa.players.find(p=>p.teamId!==fa.selectedId&&p.teamId>=0);
  fa.ceremonyStage='movement-market';fa.movement={year:fa.year,requests:[{id:p.id,from:p.teamId,year:fa.year,kind:'fa',status:'declared',demand:.2}],deals:[],offers:{[p.id]:{status:'refused',salary:.2,years:3}},history:[],declared:true,closed:false};
  const rival=JSON.parse(JSON.stringify(fa));rival.movement.deals.push({id:p.id,from:p.teamId,to:(fa.selectedId+1)%12,kind:'fa',salary:.2,years:1});a.ok(!action(rival,'fa-sign'));
  const deal=verify(fa,'fa-sign');a.equal(deal.state.movement.deals[0].to,fa.selectedId);a.equal(deal.state.movement.deals[0].years,3);
  }
  {
   // Isolated saved inbox fixtures; server API never accepts injected state.
   const w=engine.newWorld({}),p=w.players.find(x=>x.teamId===w.selectedId),date=w.year+'-04-01';
   w.pendingEvent={type:'injury',year:w.year,playerId:p.id,teamId:w.selectedId,date,days:40};
   w.injuryArchive=[{...w.pendingEvent}];p.injury={date,daysLeft:40,totalDays:40,level:'serious'};
   const key=engine.view(w).inbox.injury.eventKey;
   a.throws(()=>engine.advance(w,{step:1}));a.throws(()=>engine.advance(w,{acknowledge:'injury',eventKey:'wrong'}));
   const treated=engine.advance(w,{acknowledge:'injury',eventKey:key});a.equal(treated.pendingEvent,null);a.equal(treated.injuryArchive.length,1);a.equal(treated.players.find(x=>x.id===p.id).injury.daysLeft,40);
   a.throws(()=>engine.advance(treated,{acknowledge:'injury',eventKey:key}));
   const x=engine.newWorld({});x.rareNews=[{id:'2027:fixture:1',year:x.year,date:'2027-04-01',category:'STAR',name:'not exposed',title:'fixture'},{id:'2027:fixture:2',year:x.year,date:'2027-04-02',category:'LEGEND',title:'fixture'}];x.pendingRareIds=x.rareNews.map(e=>e.id);
   a.equal(engine.view(x).inbox.rare.name,undefined);a.throws(()=>engine.advance(x,{acknowledge:'rare',eventKey:x.rareNews[1].id}));
   const first=engine.advance(x,{acknowledge:'rare',eventKey:x.rareNews[0].id});a.equal(first.rareNews.length,2);a.deepEqual(first.pendingRareIds,[x.rareNews[1].id]);
   a.throws(()=>engine.advance(first,{step:1}));const second=engine.advance(first,{acknowledge:'rare',eventKey:x.rareNews[1].id});a.equal(second.pendingRareIds.length,0);
   const c=engine.newWorld({}),cp=c.players.find(x=>x.teamId===c.selectedId);
   cp.retirePlan={year:c.year,teamId:c.selectedId,status:'consult',options:[],date:'2027-07-01',eventDate:'2027-09-20'};
   c.careerEventQueue=[{year:c.year,teamId:c.selectedId,id:cp.id,type:'consult',date:cp.retirePlan.date}];
   a.throws(()=>engine.advance(c,{step:1}));a.throws(()=>engine.advance(c,{career:'dismiss',playerId:cp.id}));a.throws(()=>engine.advance(c,{career:'accept',playerId:cp.id,options:['fake']}));
   const opt=engine.view(c).inbox.career.options[0];a.ok(opt);
   const cost=opt.cost,poor=JSON.parse(JSON.stringify(c));poor.teams.find(t=>t.id===poor.selectedId).cash=0;
   a.throws(()=>engine.advance(poor,{career:'accept',playerId:cp.id,options:[opt.key]}));
   const result=engine.advance(c,{career:'accept',playerId:cp.id,options:[opt.key]});a.equal(result.careerEventQueue[0].type,'thanks');a.equal(result.players.find(x=>x.id===cp.id).retirePlan.cost,Math.round(cost*100)/100);
   a.throws(()=>engine.advance(result,{career:'accept',playerId:cp.id,options:[]}));
   const done=engine.advance(result,{career:'dismiss',playerId:cp.id});a.equal(done.careerEventQueue.length,0);a.equal(done.players.find(x=>x.id===cp.id).retirePlan.status,'accepted');
  }
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
