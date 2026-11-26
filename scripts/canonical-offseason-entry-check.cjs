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
 a.equal(w.calendarFlow.jobs.draft.status,'scheduled');
 a.equal(w.financeLedger.through,w.calendar.days.length);
 a.equal(JSON.parse(initial).year,w.year);checked=true;console.log('PASS actual 143-game season to awards, finance and FA declarations through persisted calendar; no rollover');
};
let source=fs.readFileSync('scripts/long-run.cjs','utf8');
const anchor="  assert(game.day===143&&game.games.length===858,'regular-season game count');";
a.equal(source.split(anchor).length,2);
source=source.replace(anchor,"  globalThis.__plAnnualEntryCheck(JSON.stringify(game));"+anchor);
process.argv[2]='1';process.argv[3]='1937';process.env.NO_RESERVE='0';process.env.SAVE_PROFILE='0';
try{new Function('require','process','console',source)(require,process,console);a.ok(checked);}
finally{delete globalThis.__plAnnualEntryCheck;}
