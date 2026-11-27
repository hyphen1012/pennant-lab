// Test-only real regular season -> authoritative annual entry. No client state import.
const fs=require('node:fs'),a=require('node:assert/strict'),{createHeadlessEngine}=require('../server/headless-engine.cjs');
const engine=createHeadlessEngine();
let checked=false;
globalThis.__plAnnualEntryCheck=saved=>{
 let w=JSON.parse(saved),year=w.year;
 a.equal(w.day,143);a.equal(w.games.length,858);a.ok(w.postseason);a.ok(Array.isArray(w.awards));
 // Test harness already acknowledged ordinary and rare reports as part of its simulation.
 // If a durable event remains, do not silently clear it.
 a.ok(engine.view(w).annual.canStart,'actual full season must allow annual entry');
 // Use the real completed season's saved match and monthly archive, then reattach ordinary pointers in a fixture.
 const match=w.games.find(g=>g.home===w.selectedId||g.away===w.selectedId);
 const month=w.monthlyArchive?.find(m=>m.teamId===w.selectedId&&m.year===year);
 a.ok(match&&month,'real saved match/month report required');
 const routine=structuredClone(w);routine.pendingReview={year:match.year,gameId:match.id,explicit:false};routine.pendingMonth={year:month.year,id:month.id,explicit:false};
 a.equal(engine.view(routine).annual.routineClearable,true);a.equal(engine.view(routine).annual.canStart,true);
 const deferred=engine.advance(routine,{annual:'start'});a.equal(deferred.pendingReview,null);a.equal(deferred.pendingMonth,null);
 a.deepEqual(deferred.games,routine.games);a.deepEqual(deferred.monthlyArchive,routine.monthlyArchive);
 // The existing save normalizer clears a dangling match pointer before annual logic; test an existing but wrong-club match instead.
 const otherMatch=w.games.find(g=>g.home!==w.selectedId&&g.away!==w.selectedId);a.ok(otherMatch);
 for(const [label,invalid] of [['explicit review',{...routine,pendingReview:{...routine.pendingReview,explicit:true}}],['explicit month',{...routine,pendingMonth:{...routine.pendingMonth,explicit:true}}],['wrong club review',{...routine,pendingReview:{year:otherMatch.year,gameId:otherMatch.id,explicit:false}}],['missing month',{...routine,pendingMonth:{...routine.pendingMonth,id:'absent'}}],['wrong club month',{...routine,monthlyArchive:routine.monthlyArchive.map(m=>m.id===month.id&&m.year===month.year?{...m,teamId:(w.selectedId+1)%12}:m)}],['missing milestone',{...routine,pendingMilestoneIds:['absent']}]]){
  a.equal(engine.view(invalid).annual.canStart,false,label);a.throws(()=>engine.advance(invalid,{annual:'start'}),/inbox unresolved/,label);
 }
 const important={...routine,pendingDecade:year};a.equal(engine.view(important).annual.canStart,false);a.throws(()=>engine.advance(important,{annual:'start'}),/inbox unresolved/);
 const off={...deferred,pendingReview:{...routine.pendingReview},pendingMonth:{...routine.pendingMonth}};
 const readyTask=engine.view(off).annual.tasks.find(j=>j.status==='ready');a.ok(engine.view(off).annual.routineClearable);
 const routineNext=readyTask?engine.advance(off,{annual:'open',job:readyTask.id}):engine.advance(off,{annual:'day'});
 a.equal(routineNext.pendingReview,null);a.equal(routineNext.pendingMonth,null);a.deepEqual(routineNext.games,off.games);
 console.log('PASS annual boundary ordinary reports defer, archive preserved, explicit/missing/important notices block');
 const initial=JSON.stringify(w),step=(cmd)=>{w=engine.advance(w,cmd);a.equal(w.year,year);a.equal(w.games.length,858);a.equal(w.day,143);};
 step({annual:'start'});a.equal(engine.view(w).annual.mode,'off');a.throws(()=>engine.advance(w,{annual:'start'}));a.throws(()=>engine.advance(w,{annual:'open',job:'settlement'}));a.throws(()=>engine.advance(w,{step:1}));
 const ready=id=>{for(let i=0;i<100&&engine.view(w).annual.tasks.find(j=>j.id===id).status!=='ready';i++)step({annual:'day'});a.equal(engine.view(w).annual.tasks.find(j=>j.id===id).status,'ready');};
 for(const id of ['awards-all','settlement','movement-declarations']){
  ready(id);a.throws(()=>engine.advance(w,{annual:'day'}));step({annual:'open',job:id});
  a.equal(engine.view(w).annual.active,id);a.throws(()=>engine.advance(w,{annual:'day'}));
  const report=engine.view(w).annual;
  if(id==='awards-all'){a.ok(report.awardReport);a.equal(report.awardReport.awards.length,w.awards.filter(x=>x.year===w.year).length);a.ok(report.awardReport.awards.length>0);a.ok(report.awardReport.awards.every(x=>x.player&&typeof x.title==='string'&&typeof x.stat==='string'));a.equal(report.financeReport,null);}
  if(id==='settlement'){const r=report.financeReport;a.ok(r);a.ok([r.income,r.expense,r.net,r.operating,r.cash].every(Number.isFinite));a.ok(Math.abs(r.income-r.expense-r.net)<.021);a.ok(Math.abs(r.incomeRows.reduce((n,x)=>n+x[1],0)-r.income)<.1);a.ok(Math.abs(r.expenseRows.reduce((n,x)=>n+x[1],0)-r.expense)<.1);a.equal(r.cash,w.teams.find(t=>t.id===w.selectedId).cash);a.equal(report.awardReport,null);}

  if(id==='movement-declarations'){
   for(const r of engine.view(w).annual.requests.filter(x=>['request','refused'].includes(x.status))){
    a.throws(()=>engine.advance(w,{annual:'complete',job:id}));step({annual:'movement',playerId:r.id,decision:'allow'});
    a.throws(()=>engine.advance(w,{annual:'movement',playerId:r.id,decision:'allow'}));
   }
  }
  step({annual:'complete',job:id});a.throws(()=>engine.advance(w,{annual:'complete',job:id}));
 }
 a.throws(()=>engine.advance(w,{annual:'open',job:'draft'}));
 ready('draft');step({annual:'open',job:'draft'});
 const draft=(decision,extra={})=>step({annual:'draft',decision,...extra});
 a.throws(()=>engine.advance(w,{annual:'complete',job:'draft'}));
 const scouted=engine.view(w).annual.draft,prospect=scouted.candidates.find(c=>c.canResearch);a.ok(prospect);
 a.ok(scouted.candidates.filter(c=>c.hidden).every(c=>c.report===null&&c.name==='????'&&c.appearanceSeed===null));
 draft('research',{playerId:prospect.id,key:'field'});const afterResearch=engine.view(w).annual.draft;
 a.equal(afterResearch.researchUsed,scouted.researchUsed+1);a.ok(afterResearch.candidates.find(c=>c.id===prospect.id).tasks.includes('field'));
 a.throws(()=>engine.advance(w,{annual:'draft',decision:'research',playerId:prospect.id,key:'field'}));a.throws(()=>engine.advance(w,{annual:'draft',decision:'research',playerId:-1,key:'analysis'}));
 draft('start');
 let rounds=0,ownNominations=0,ownContracts=0;
 for(let guard=0;guard<300;guard++){
  const v=engine.view(w).annual.draft;
  if(v.phase==='done')break;
  if(v.rareIntro){a.throws(()=>engine.advance(w,{annual:'draft',decision:'pass'}));draft('intro');}
  else if(v.announcement){a.ok(v.announcementRow&&v.announcementRow.cursor<v.announcementRow.total);const cursor=v.announcementRow.cursor;draft('announcement-next');const next=engine.view(w).annual.draft;if(next.announcement)a.equal(next.announcementRow.cursor,cursor+1);}
  else if(v.phase==='first'||v.phase==='later'){
   if(v.canNominate){const c=v.candidates[0];a.ok(c);a.throws(()=>engine.advance(w,{annual:'draft',decision:'nominate',playerId:-1}));draft('nominate',{playerId:c.id});ownNominations++;}
   else draft('cpu');
  }else if(v.phase==='lottery'){
   if(v.lottery.stage==='choose'){a.equal(v.lottery.winner,undefined);draft(v.lottery.own?'ticket':'delegate',v.lottery.own?{ticket:0}:{});}
   else if(v.lottery.stage==='sealed'){a.equal(v.lottery.winner,undefined);draft('reveal');}
   else {a.ok(Number.isInteger(v.lottery.winner));draft('next-draw');}
  }else if(v.phase==='first-result'){draft('next-round');rounds++;}
  else if(v.phase==='negotiate'){
   const n=v.negotiation;
   if(!n){draft('finish');continue;}
   if(n.recoveryPending||n.recoveryCelebration){draft('dismiss',{playerId:n.id});continue;}
   if(n.question){draft('reply',{playerId:n.id,answer:n.question.options[0].key});continue;}
   draft('offer',{playerId:n.id,level:1,role:'develop'});ownContracts++;
  }else throw Error('unexpected draft phase '+v.phase);
 }
 a.equal(w.draft.phase,'done');a.ok(ownNominations>0&&ownContracts>0);a.equal(new Set(w.draft.picks.map(x=>x.candidateId)).size,w.draft.picks.length);
 step({annual:'complete',job:'draft'});ready('roster-cut');step({annual:'open',job:'roster-cut'});
 for(let i=0;i<50;i++){
  const v=engine.view(w).annual.roster;if(!v.projection.excess)break;
  a.throws(()=>engine.advance(w,{annual:'complete',job:'roster-cut'}));
  const candidate=v.eligible.find(x=>!v.selected.includes(x.id));a.ok(candidate);step({annual:'cut',playerId:candidate.id});
 }
 a.equal(engine.view(w).annual.roster.projection.excess,0);step({annual:'complete',job:'roster-cut'});a.equal(w.draft.cutConfirmed,true);
 a.throws(()=>engine.advance(w,{annual:'cut',playerId:w.players[0].id}));
 a.equal(w.calendarFlow.jobs['roster-cut'].status,'done');
 console.log('PASS draft nominations, ordinary lottery, contract and roster cut',JSON.stringify({ownNominations,ownContracts,rounds,picks:w.draft.picks.length,cutPlan:w.draft.cutPlan}));
 ready('renewal1');step({annual:'open',job:'renewal1'});
 const renewal=(decision,extra={})=>step({annual:'renewal',decision,...extra});
 const training=(decision,extra={})=>step({annual:'training',decision,...extra});
 a.throws(()=>engine.advance(w,{annual:'open',job:'renewal2'}));
 a.throws(()=>engine.advance(w,{annual:'complete',job:'renewal1'}));
 const d=w.contractRenewals[year+':'+w.selectedId],row=d.rows.find(r=>r.minimum>.06&&r.status==='unoffered');a.ok(row);
 const pId=row.id;renewal('offer',{playerId:pId,salary:.05,bonuses:[]});
 a.equal(engine.view(w).annual.renewal.rows.find(r=>r.id===pId).status,'pending');
 a.throws(()=>engine.advance(w,{annual:'renewal',decision:'offer',playerId:pId,salary:1,bonuses:[]}));
 for(const r of engine.view(w).annual.renewal.rows.filter(r=>r.status==='retire-intent'))renewal('retire',{playerId:r.id});
 renewal('bulk',{mode:'desired'});renewal('submit',{bonus:true});
 renewal('next');a.equal(w.calendarFlow.jobs.renewal1.status,'done');a.equal(w.contractRenewals[year+':'+w.selectedId].waiting,true);
 a.throws(()=>engine.advance(w,{annual:'open',job:'renewal2'}));
 ready('autumn');step({annual:'open',job:'autumn'});
 a.throws(()=>engine.advance(w,{annual:'complete',job:'autumn'}));
 const trainee=engine.view(w).annual.training.players.find(p=>!p.injured);a.ok(trainee);
 training('menu',{playerId:trainee.id,focus:trainee.focus[0],intensity:'normal'});
 training('run');a.equal(w.calendarFlow.jobs.autumn.status,'waiting');
 a.throws(()=>engine.advance(w,{annual:'training',decision:'run'}));
 ready('winter');step({annual:'open',job:'winter'});
 const eligible=engine.view(w).annual.training.eligible;
 if(eligible.length){training('assign',{playerId:eligible[0].id,destination:'taiwan'});}
 a.throws(()=>engine.advance(w,{annual:'training',decision:'assign',playerId:-1,destination:'taiwan'}));
 const beforeWinter=w.teams.find(t=>t.id===w.selectedId).cash;
 training('run');const report=engine.view(w).annual.training.report;a.ok(report);a.ok(report.entries.length<=4);
 a.ok(Math.abs(beforeWinter-w.teams.find(t=>t.id===w.selectedId).cash-(report.cost||0))<.0011);
 a.throws(()=>engine.advance(w,{annual:'training',decision:'run'}));
 step({annual:'complete',job:'winter'});
 a.equal(w.calendarFlow.jobs.winter.status,'done');
 // Fan festival is ready on the same date; do not skip the unsupported job.
 a.throws(()=>engine.advance(w,{annual:'day'}));
 console.log('PASS renewal round one and pending second round, autumn scheduled, winter dispatch with exact costs, no skipped fan festival');
 const commerce=(decision,extra={})=>step({annual:'commerce',decision,...extra});
 let completed=new Set(),secondRound=false;
 for(let i=0;i<120;i++){
  const v=engine.view(w).annual;
  if(v.tasks.find(j=>j.id==='movement-market').status==='ready')break;
  const j=v.tasks.find(x=>x.status==='ready');
  if(!j){step({annual:'day'});continue;}
  a.ok(j.supported,'unexpected unsupported '+j.id);
  step({annual:'open',job:j.id});
  if(j.id==='autumn'){
   a.ok(engine.view(w).annual.training.report);step({annual:'complete',job:j.id});completed.add(j.id);continue;
  }
  if(j.id==='renewal2'){
   const d=engine.view(w).annual.renewal;a.equal(d.round,2);
   a.ok(d.rows.find(r=>r.id===pId).editable);
   renewal('bulk',{mode:'desired'});renewal('submit',{bonus:false});
   if(engine.view(w).annual.renewal.rows.some(r=>r.status==='pending'))renewal('final-release');
   step({annual:'complete',job:j.id});secondRound=true;continue;
  }
  let c=engine.view(w).annual.commerce;a.ok(c);
  a.throws(()=>engine.advance(w,{annual:'complete',job:j.id}));
  if(c.stage==='brief'||c.stage==='briefing'){commerce('start');c=engine.view(w).annual.commerce;}
  if(c.stage==='selection'){
   if(j.id==='fan-fest'){commerce('plan',{value:0});}
   else if(j.id==='tv'){for(const p of c.eligible.slice(0,5))commerce('player',{value:p.id});a.throws(()=>engine.advance(w,{annual:'commerce',decision:'player',value:-1}));}
   else if(j.id==='fanclub'){commerce('name',{value:'テストファンクラブ'});commerce('fee',{value:500});commerce('perk',{value:'towel'});commerce('color',{value:2});commerce('font',{value:1});}
   else if(j.id==='sponsor'){a.ok(c.candidates.length);commerce('toggle',{value:c.candidates[0].id});}
   else if(j.id==='broadcast'){commerce('delta',{value:1});}
   else if(j.id==='naming'){commerce('choice',{value:0});}
   else throw Error('unexpected '+j.id);
   c=engine.view(w).annual.commerce;
   if(j.id==='sponsor'){a.equal(c.risk.burden,10);a.ok(c.annual>0);}
   if(j.id==='fanclub'){a.ok(Number.isSafeInteger(c.since)&&c.estimate.members>=0);}
   commerce('confirm');c=engine.view(w).annual.commerce;
   if(j.id==='fanclub'){a.ok(c.contract&&c.contract.name==='テストファンクラブ');a.equal(c.contract.perk,'towel');a.equal(c.contract.color,2);a.equal(c.contract.font,1);a.equal(c.contract.members,c.estimate.members);}
   if(j.id==='sponsor')a.equal(c.contract.companies.length,1);
  }
  if(c.stage==='scheduled'){commerce('park');continue;}
  if(c.stage==='live'){commerce(j.id==='tv'?'tv':'live');c=engine.view(w).annual.commerce;}
  a.equal(c.stage,'result');a.throws(()=>engine.advance(w,{annual:'commerce',decision:'confirm'}));
  commerce('finish');completed.add(j.id);
 }
 a.ok(secondRound);for(const id of ['fan-fest','tv','fanclub','sponsor','broadcast','naming','autumn'])a.ok(completed.has(id),'missing '+id);
 a.equal(w.calendarFlow.jobs['movement-market'].status,'ready');
 console.log('PASS commercial jobs and actual second renewal round',JSON.stringify([...completed]));
 // Separate generated-world fixture: exercise rare negotiation outcomes
 // that did not occur in the actual first-season market. Never alter w.
 {
  let fixture=JSON.parse(JSON.stringify(w));
  const teamId=fixture.selectedId,club=fixture.teams.find(t=>t.id===teamId);
  const p=fixture.players.find(p=>p.teamId>=0&&p.teamId!==teamId&&p.age<34&&p.pos==='OF');
  a.ok(p);club.cash=100;
  // Remove competition only for deterministic branch coverage, not economics.
  for(const t of fixture.teams)if(t.id!==teamId)t.cash=0;
  const owned=fixture.players.filter(p=>p.teamId===teamId&&p.pos==='OF');
  for(const q of owned.slice(4))q.teamId=null;
  fixture.movement.requests=[{id:p.id,from:p.teamId,kind:'fa',status:'declared',demand:.2,offer:.2,minimum:.2,year}];
  fixture.movement.deals=[];fixture.movement.offers={};fixture.movement.declared=true;delete fixture.movement.eventRows;delete fixture.movement.faClock;
  const m=(decision,extra={})=>{fixture=engine.advance(fixture,{annual:'market',decision,...extra});};
  const day=()=>{fixture=engine.advance(fixture,{annual:'day'});};
  m('open',{room:'news'});m('news');day();m('open',{room:'news'});m('news');m('open',{room:'fa'});
  a.throws(()=>engine.advance(fixture,{annual:'market',decision:'submit',playerId:p.id}));
  m('years',{playerId:p.id,years:3});m('talk',{playerId:p.id,key:'listen'});m('salary',{playerId:p.id,million:5});m('submit',{playerId:p.id});m('home');
  a.equal(fixture.movement.offers[p.id].status,'waiting');
  for(let n=0;n<5&&fixture.movement.offers[p.id].status==='waiting';n++)day();
  a.equal(fixture.movement.offers[p.id].status,'counter');a.throws(()=>engine.advance(fixture,{annual:'day'}));
  m('open',{room:'fa'});a.throws(()=>engine.advance(fixture,{annual:'market',decision:'talk',playerId:p.id,key:'listen'}));m('ack',{playerId:p.id});
  a.throws(()=>engine.advance(fixture,{annual:'market',decision:'ack',playerId:p.id}));
  m('years',{playerId:p.id,years:3});m('talk',{playerId:p.id,key:'listen'});
  a.throws(()=>engine.advance(fixture,{annual:'market',decision:'salary',playerId:p.id,million:999999}));
  m('salary',{playerId:p.id,million:600});m('submit',{playerId:p.id});m('home');
  for(let n=0;n<5&&fixture.movement.offers[p.id].status==='waiting';n++)day();
  a.equal(fixture.movement.offers[p.id].status,'signed');
  const deal=fixture.movement.deals.find(d=>d.id===p.id);a.ok(deal);a.equal(deal.to,teamId);a.equal(deal.years,3);a.equal(deal.salary,6);
  m('open',{room:'fa'});m('ack',{playerId:p.id});a.throws(()=>engine.advance(fixture,{annual:'market',decision:'submit',playerId:p.id}));m('home');
  a.equal(fixture.movement.deals.filter(d=>d.id===p.id).length,1);
  console.log('PASS isolated actual FA negotiation: delayed counter, required acknowledgement, exact high salary, three-year agreement');
 }
 // Isolated recorded-event fixture, never injected into the season under test.
 {
  const fixture=JSON.parse(JSON.stringify(w)),teamId=fixture.selectedId;
  const p=fixture.players.find(p=>p.teamId===teamId),other=fixture.players.find(p=>p.teamId>=0&&p.teamId!==teamId);
  a.ok(p&&other);
  const key=id=>'memorial:'+require('node:crypto').createHash('sha256').update('memorial:'+id).digest('hex');
  const base=engine.achievements(w).map(e=>e.key);
  const feat=year+':fixture-feat:'+p.id,ordinary=year+':fixture-ordinary:'+p.id,rare=year+':awakening:'+p.id,rival=year+':awakening:'+other.id,scout=year+':foreign-discovery:987654321';
  fixture.milestoneNews=[...(fixture.milestoneNews||[]),{id:ordinary,year,teamId,playerId:p.id,type:'player',title:'Fixture ordinary milestone'},{id:feat,year,teamId,playerId:p.id,type:'player',featKey:'fixture',title:'Fixture special feat'}];
  fixture.rareNews=[...(fixture.rareNews||[]),{id:rare,year,teamId,playerId:p.id,category:'awakening',title:'Fixture awakening'},{id:rival,year,teamId:other.teamId,playerId:other.id,category:'awakening',title:'Fixture rival'},{id:scout,year,playerId:987654321,scoutTeamId:teamId,kind:'foreign-discovery',category:'foreign',title:'Fixture public discovery'}];
  const snapshot=JSON.stringify(fixture),entries=engine.achievements(fixture),keys=new Set(entries.map(e=>e.key));
  for(const k of base)a.ok(keys.has(k),'prior achievement identity retained');
  for(const id of ['news:'+ordinary,'news:'+feat,'rare:'+rare,'rare:'+scout])a.ok(keys.has(key(id)),'missing '+id);
  a.ok(!keys.has(key('rare:'+rival)));a.equal(keys.size,entries.length);
  a.equal(entries.find(e=>e.key===key('rare:'+scout)).shareAllowed,false);
  const protectedFixture=JSON.parse(JSON.stringify(fixture)),pp=protectedFixture.players.find(x=>x.id===p.id);pp.originCategory='RINNE';pp.specialCategory='輪廻転生';pp.pastLifeAppearance={seed:99521,baseCategory:'IMMORTAL'};
  const protectedRows=engine.achievements(protectedFixture);a.equal(protectedRows.find(e=>e.key===key('rare:'+rare)).shareAllowed,false);a.equal(protectedRows.find(e=>e.key===key('news:'+ordinary)).shareAllowed,false);a.equal(protectedRows.find(e=>e.key===key('news:'+feat)).shareAllowed,false);a.deepEqual(protectedRows.map(e=>e.key).sort(),entries.map(e=>e.key).sort());
  a.equal(JSON.stringify(fixture),snapshot,'achievement projection must not mutate world');
  console.log('PASS canonical achievement identity, ordinary and rare coverage, own-club scope and nonmutation');
 }
 const market=(decision,extra={})=>step({annual:'market',decision,...extra});
 a.throws(()=>engine.advance(w,{annual:'open',job:'movement-market'}));
 a.throws(()=>engine.advance(w,{annual:'day'}));
 a.throws(()=>engine.advance(w,{annual:'market',decision:'open',room:'other'}));
 a.deepEqual(engine.view(w).annual.market.roomOptions,['news']);market('open',{room:'news'});a.equal(engine.view(w).annual.market.news,'eve');
 a.throws(()=>engine.advance(w,{annual:'market',decision:'home'}));
 market('news');a.equal(w.calendarFlow.jobs['movement-market'].state.news,'opening-wait');a.deepEqual(engine.view(w).annual.market.roomOptions,[]);
 a.throws(()=>engine.advance(w,{annual:'market',decision:'open',room:'news'}));
 step({annual:'day'});a.equal(w.calendarFlow.jobs['movement-market'].state.news,'opening');
 market('open',{room:'news'});market('news');
 let dialogue=0;
 for(const room of ['fa','return']){
  // Actual generated market may have no candidates in the first season.
  try{market('open',{room});}catch(e){if(!String(e).includes('market room unavailable'))throw e;continue;}
  const row=engine.view(w).annual.market.rows.find(r=>r.canApproach);
  if(row){
   a.throws(()=>engine.advance(w,{annual:'market',decision:'submit',playerId:row.id}));
   a.throws(()=>engine.advance(w,{annual:'market',decision:'years',playerId:row.id,years:11}));
   market('years',{playerId:row.id,years:3});market('talk',{playerId:row.id,key:'listen'});market('talk',{playerId:row.id,key:'trust'});
   const talked=engine.view(w).annual.market.rows.find(r=>r.id===row.id);a.equal(talked.talk.years,3);a.ok(Number.isFinite(talked.bounds.min)&&Number.isFinite(talked.bounds.max)&&Number.isFinite(talked.cost));a.equal(typeof talked.canSubmit,'boolean');
   dialogue++;
  }
  market('home');
 }
 market('open',{room:'other'});const other=engine.view(w).annual.market;a.equal(other.tradeClubs.length,12);a.ok(other.tradeClubs.every(t=>new Set(t.players.map(p=>p.id)).size===t.players.length));a.ok(other.free.every(r=>Number.isFinite(r.cost)));a.throws(()=>engine.advance(w,{annual:'complete',job:'movement-market'}));
 a.throws(()=>engine.advance(w,{annual:'market',decision:'finish'}));
 a.throws(()=>engine.advance(w,{annual:'market',decision:'free',playerId:999999999,salary:1}));
 market('close');a.equal(w.calendarFlow.jobs['movement-market'].state.news,'results');
 market('open',{room:'news'});
 for(const r of engine.view(w).annual.market.specialResults){a.throws(()=>engine.advance(w,{annual:'market',decision:'news'}));market('special-result',{playerId:r.id});a.throws(()=>engine.advance(w,{annual:'market',decision:'special-result',playerId:r.id}));}
 market('news');
 market('open',{room:'other'});a.equal(engine.view(w).annual.market.cpuDone,true);a.equal(engine.view(w).annual.market.tradeClubs.length,0);
 market('finish');a.equal(w.calendarFlow.jobs['movement-market'].status,'done');
 a.throws(()=>engine.advance(w,{annual:'market',decision:'finish'}));
 console.log('PASS actual market opening news, room validation, CPU closure, results and compensation confirmation',JSON.stringify({dialogue,date:w.calendarFlow.date}));
 a.equal(w.financeLedger.through,w.calendar.days.length);
 a.equal(JSON.parse(initial).year,w.year);
 ready('booking');step({annual:'open',job:'booking'});
 const pre=(decision,extra={})=>{w=engine.advance(w,{annual:'preseason',decision,...extra});};
 a.throws(()=>engine.advance(w,{annual:'complete',job:'booking'}));
 pre('site',{group:'first',value:'miyazaki'});pre('site',{group:'farm',value:'club'});
 a.throws(()=>engine.advance(w,{annual:'preseason',decision:'site',group:'farm',value:'usa'}));
 const campCost=engine.view(w).annual.preseason.cost,beforeCamp=w.teams.find(t=>t.id===w.selectedId).cash;
 pre('confirm-sites');a.equal(w.calendarFlow.jobs.booking.status,'done');a.ok(Math.abs(beforeCamp-w.teams.find(t=>t.id===w.selectedId).cash-campCost)<.0011);
 a.throws(()=>engine.advance(w,{annual:'preseason',decision:'confirm-sites'}));
 const oldWins=w.teams.map(t=>[t.id,t.wins,t.losses,t.ties]),oldRookies=w.draft.picks.filter(x=>x.status==='signed'&&x.teamId===w.selectedId).map(x=>x.candidateId);
 for(let i=0;i<40&&w.year===year;i++)w=engine.advance(w,{annual:'day'});
 a.equal(w.year,year+1);a.equal(w.day,0);a.equal(w.calendarIndex,0);a.equal(w.games.length,0);a.equal(w.calendarFlow.mode,'pre');a.ok(w.seasonArchive.length);
 for(const id of oldRookies)a.ok(w.players.some(p=>p.id===id&&p.teamId===w.selectedId&&p.rookieSeason===year+1));
 a.throws(()=>engine.advance(w,{step:1}));
 const ack=cmd=>{w=engine.advance(w,cmd);};
 const drain=()=>{for(let i=0;i<100;i++){let v=engine.view(w).inbox;
  if(v.rare){ack({acknowledge:'rare',eventKey:v.rare.eventKey});continue;}
  if(v.rookie){const r=v.rookie.entries.find(e=>e.stage<2);if(r){a.throws(()=>engine.advance(w,{acknowledge:'rookie-finish'}));ack({acknowledge:'rookie-reveal',playerId:r.id});continue;}ack({acknowledge:'rookie-finish'});continue;}
  if(v.decade!=null){ack({acknowledge:'decade',eventKey:String(v.decade)});continue;}
  if(v.injury){ack({acknowledge:'injury',eventKey:v.injury.eventKey});continue;}
  const x=engine.view(w).acknowledgements;if(x.month){ack({acknowledge:'month'});continue;}if(x.milestones){ack({acknowledge:'milestones'});continue;}
  return;
 }throw Error('too many preseason inbox entries');};
 drain();
 const next=()=>{drain();w=engine.advance(w,{annual:'day'});a.equal(w.year,year+1);a.equal(w.day,0);a.equal(w.games.length,0);};
 const open=id=>{drain();w=engine.advance(w,{annual:'open',job:id});};
 const until=id=>{for(let i=0;i<130&&w.calendarFlow.jobs[id].status!=='ready';i++)next();a.equal(w.calendarFlow.jobs[id].status,'ready');open(id);};
 until('self');a.throws(()=>engine.advance(w,{annual:'preseason',decision:'finish'}));
 const trainee2=engine.view(w).annual.preseason.players.find(p=>!p.injured);a.ok(trainee2);
 w=engine.advance(w,{annual:'training',decision:'menu',playerId:trainee2.id,focus:'balanced',intensity:'rest'});
 pre('run');a.equal(engine.view(w).annual.preseason.support,true);
 pre('self-back');a.equal(engine.view(w).annual.preseason.support,false);a.throws(()=>engine.advance(w,{annual:'preseason',decision:'self-back'}));pre('run');
 if(engine.view(w).annual.preseason.supportOptions.find(o=>o.key==='drinks').eligible){pre('support',{value:'drinks'});a.throws(()=>engine.advance(w,{annual:'preseason',decision:'support',value:'drinks'}));}
 pre('run');until('self');a.ok(engine.view(w).annual.preseason.report);pre('finish');
 if(w.calendarFlow.jobs['winter-return'].status!=='done'){until('winter-return');a.ok(engine.view(w).annual.preseason.report);pre('finish');}
 until('camp');a.equal(engine.view(w).annual.preseason.step,1);a.equal(engine.view(w).annual.preseason.paid,true);
 a.throws(()=>engine.advance(w,{annual:'preseason',decision:'confirm-sites'}));pre('kickoff');until('camp');
 a.equal(engine.view(w).annual.preseason.step,2);pre('visit',{value:'rest'});a.throws(()=>engine.advance(w,{annual:'preseason',decision:'visit',value:'rest'}));pre('visit-finish');until('camp');
 a.equal(engine.view(w).annual.preseason.step,3);pre('run');until('camp');a.ok(engine.view(w).annual.preseason.report);pre('finish');
 until('exhibition');pre('policy',{value:'youth'});pre('run');a.equal(engine.view(w).annual.preseason.meeting,true);pre('run');until('exhibition');
 const exhibition=engine.view(w).annual.preseason.report;a.equal(exhibition.leagueGames,36);a.equal(exhibition.games.length,6);a.equal(w.games.length,0);a.ok(w.teams.every(t=>t.wins===0&&t.losses===0&&t.ties===0));a.equal(exhibition.clubs.length,12);a.ok(exhibition.rows.every(r=>r.teamId===w.selectedId));a.throws(()=>engine.advance(w,{annual:'preseason',decision:'finish'}));pre('digest');a.equal(engine.view(w).annual.preseason.digestSeen,true);a.throws(()=>engine.advance(w,{annual:'preseason',decision:'digest'}));pre('finish');
 until('opening-promo');const promote=(decision,extra={})=>{w=engine.advance(w,{annual:'commerce',decision,...extra});};
 promote('start');promote('plan',{value:0});promote('confirm');promote('park');until('opening-promo');promote('opening');promote('finish');
 until('offdesk-opening');a.equal(w.calendarFlow,null);a.equal(w.pendingCeremonyIntro,'opening');a.throws(()=>engine.advance(w,{step:1}));ack({acknowledge:'opening'});
 for(let i=0;i<10&&w.day===0;i++){drain();w=engine.advance(w,{step:1});}
 a.equal(w.day,1);a.equal(w.games.length,6);
 checked=true;console.log('PASS actual season, rollover, rookie registration, prepaid camp, preseason and next regular season opener',JSON.stringify({year:w.year,oldWins,rookies:oldRookies.length,exhibitionGames:exhibition.leagueGames,officialGames:w.games.length}));
};
let source=fs.readFileSync('scripts/long-run.cjs','utf8');
const anchor="  assert(game.day===143&&game.games.length===858,'regular-season game count');";
a.equal(source.split(anchor).length,2);
source=source.replace(anchor,"  globalThis.__plAnnualEntryCheck(JSON.stringify(game));"+anchor);
process.argv[2]='1';process.argv[3]='1937';process.env.NO_RESERVE='0';process.env.SAVE_PROFILE='0';
try{new Function('require','process','console',source)(require,process,console);a.ok(checked);}
finally{delete globalThis.__plAnnualEntryCheck;}
