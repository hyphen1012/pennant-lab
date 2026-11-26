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
 a.equal(w.financeLedger.through,w.calendar.days.length);
 a.equal(JSON.parse(initial).year,w.year);checked=true;console.log('PASS actual 143-game season to awards, finance and FA declarations through persisted calendar; draft and roster cut, no rollover');
};
let source=fs.readFileSync('scripts/long-run.cjs','utf8');
const anchor="  assert(game.day===143&&game.games.length===858,'regular-season game count');";
a.equal(source.split(anchor).length,2);
source=source.replace(anchor,"  globalThis.__plAnnualEntryCheck(JSON.stringify(game));"+anchor);
process.argv[2]='1';process.argv[3]='1937';process.env.NO_RESERVE='0';process.env.SAVE_PROFILE='0';
try{new Function('require','process','console',source)(require,process,console);a.ok(checked);}
finally{delete globalThis.__plAnnualEntryCheck;}
