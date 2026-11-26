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
 const initial=JSON.stringify(w),step=(cmd)=>{w=engine.advance(w,cmd);a.equal(w.year,year);a.equal(w.games.length,858);a.equal(w.day,143);};
 step({annual:'start'});a.equal(engine.view(w).annual.mode,'off');a.throws(()=>engine.advance(w,{annual:'start'}));a.throws(()=>engine.advance(w,{annual:'open',job:'settlement'}));a.throws(()=>engine.advance(w,{step:1}));
 const ready=id=>{for(let i=0;i<100&&engine.view(w).annual.tasks.find(j=>j.id===id).status!=='ready';i++)step({annual:'day'});a.equal(engine.view(w).annual.tasks.find(j=>j.id===id).status,'ready');};
 for(const id of ['awards-all','settlement','movement-declarations']){
  ready(id);a.throws(()=>engine.advance(w,{annual:'day'}));step({annual:'open',job:id});
  a.equal(engine.view(w).annual.active,id);a.throws(()=>engine.advance(w,{annual:'day'}));
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
 a.throws(()=>engine.advance(w,{annual:'complete',job:'draft'}));draft('start');
 let rounds=0,ownNominations=0,ownContracts=0;
 for(let guard=0;guard<300;guard++){
  const v=engine.view(w).annual.draft;
  if(v.phase==='done')break;
  if(v.rareIntro){a.throws(()=>engine.advance(w,{annual:'draft',decision:'pass'}));draft('intro');}
  else if(v.announcement)draft('announcement');
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
   commerce('confirm');c=engine.view(w).annual.commerce;
  }
  if(c.stage==='scheduled'){commerce('park');continue;}
  if(c.stage==='live'){commerce(j.id==='tv'?'tv':'live');c=engine.view(w).annual.commerce;}
  a.equal(c.stage,'result');a.throws(()=>engine.advance(w,{annual:'commerce',decision:'confirm'}));
  commerce('finish');completed.add(j.id);
 }
 a.ok(secondRound);for(const id of ['fan-fest','tv','fanclub','sponsor','broadcast','naming','autumn'])a.ok(completed.has(id),'missing '+id);
 a.equal(w.calendarFlow.jobs['movement-market'].status,'ready');
 console.log('PASS commercial jobs and actual second renewal round',JSON.stringify([...completed]));
 const market=(decision,extra={})=>step({annual:'market',decision,...extra});
 a.throws(()=>engine.advance(w,{annual:'open',job:'movement-market'}));
 a.throws(()=>engine.advance(w,{annual:'day'}));
 a.throws(()=>engine.advance(w,{annual:'market',decision:'open',room:'other'}));
 market('open',{room:'news'});a.equal(engine.view(w).annual.market.news,'eve');
 a.throws(()=>engine.advance(w,{annual:'market',decision:'home'}));
 market('news');a.equal(w.calendarFlow.jobs['movement-market'].state.news,'opening-wait');
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
   a.equal(engine.view(w).annual.market.rows.find(r=>r.id===row.id).talk.years,3);
   dialogue++;
  }
  market('home');
 }
 market('open',{room:'other'});a.throws(()=>engine.advance(w,{annual:'complete',job:'movement-market'}));
 a.throws(()=>engine.advance(w,{annual:'market',decision:'finish'}));
 a.throws(()=>engine.advance(w,{annual:'market',decision:'free',playerId:999999999,salary:1}));
 market('close');a.equal(w.calendarFlow.jobs['movement-market'].state.news,'results');
 market('open',{room:'news'});
 for(const r of engine.view(w).annual.market.specialResults){a.throws(()=>engine.advance(w,{annual:'market',decision:'news'}));market('special-result',{playerId:r.id});a.throws(()=>engine.advance(w,{annual:'market',decision:'special-result',playerId:r.id}));}
 market('news');
 market('open',{room:'other'});a.equal(engine.view(w).annual.market.cpuDone,true);
 market('finish');a.equal(w.calendarFlow.jobs['movement-market'].status,'done');
 a.throws(()=>engine.advance(w,{annual:'market',decision:'finish'}));
 console.log('PASS actual market opening news, room validation, CPU closure, results and compensation confirmation',JSON.stringify({dialogue,date:w.calendarFlow.date}));
 a.equal(w.financeLedger.through,w.calendar.days.length);
 a.equal(JSON.parse(initial).year,w.year);checked=true;console.log('PASS actual 143-game season to awards, finance and FA declarations through persisted calendar; draft, renewal, training and commerce and market through compensation confirmation, no rollover');
};
let source=fs.readFileSync('scripts/long-run.cjs','utf8');
const anchor="  assert(game.day===143&&game.games.length===858,'regular-season game count');";
a.equal(source.split(anchor).length,2);
source=source.replace(anchor,"  globalThis.__plAnnualEntryCheck(JSON.stringify(game));"+anchor);
process.argv[2]='1';process.argv[3]='1937';process.env.NO_RESERVE='0';process.env.SAVE_PROFILE='0';
try{new Function('require','process','console',source)(require,process,console);a.ok(checked);}
finally{delete globalThis.__plAnnualEntryCheck;}
