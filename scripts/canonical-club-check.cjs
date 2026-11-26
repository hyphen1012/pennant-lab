const a=require('node:assert/strict'),{createHeadlessEngine}=require('../server/headless-engine.cjs');
const engine=createHeadlessEngine();
let w=engine.newWorld({team:0});
const club=()=>w.teams.find(t=>t.id===w.selectedId),view=()=>engine.view(w).club;
const go=(op,extra={})=>{w=engine.advance(w,{club:op,...extra});return view();};
let v=view();a.ok(v.canManage);a.equal(v.facilities.length,8);a.equal(v.standings.length,12);a.ok(v.lineup.length>1&&v.rotation.length>1);
const other=w.players.find(p=>p.teamId!==null&&p.teamId!==w.selectedId&&p.teamId>=0),ownId=v.lineup[0],sp=v.rotation[0];
a.throws(()=>engine.advance(w,{club:'lineup',playerId:other.id,slot:0}));
a.throws(()=>engine.advance(w,{club:'lineup',playerId:sp,slot:0}));
a.throws(()=>engine.advance(w,{club:'rotation',playerId:ownId,slot:0}));
a.throws(()=>engine.advance(w,{club:'facility',key:'medical',direction:1,cash:1000}));
let before=v.lineup.slice();v=go('order',{kind:'lineup',slot:0,target:1});a.equal(v.lineup[0],before[1]);a.equal(v.lineup[1],before[0]);a.equal(new Set(v.lineup).size,v.lineup.length);
before=v.rotation.slice();v=go('rotation',{slot:0,playerId:before[1]});a.equal(v.rotation[0],before[1]);a.equal(v.rotation[1],before[0]);
a.throws(()=>engine.advance(w,{club:'order',kind:'rotation',slot:0,target:8}));
const change=v.fieldingOptions.find(x=>x.roles.length);a.ok(change);v=go('fielding',{playerId:change.id,key:change.roles[0]});a.equal(v.fieldingRoles[change.id],change.roles[0]);a.equal(new Set(Object.values(v.fieldingRoles)).size,Object.values(v.fieldingRoles).length);
v=go('farm-mode',{value:'manual'});a.equal(v.farmMode,'manual');
const p=v.roster.find(p=>p.tier===2&&!p.injured);a.ok(p);if(v.roster.filter(x=>x.tier===1).length<v.farmLimit){v=go('farm-move',{playerId:p.id});a.equal(v.roster.find(x=>x.id===p.id).tier,1);}
a.throws(()=>engine.advance(w,{club:'focus',playerId:other.id,key:'balanced'}));
v=go('focus',{playerId:p.id,key:'balanced'});a.equal(v.roster.find(x=>x.id===p.id).focus,'balanced');
const f=v.facilities.find(x=>x.key==='medical'),cash=club().cash;
v=go('facility',{key:'medical',direction:1});a.equal(v.facilities.find(x=>x.key==='medical').level,f.level+1);a.ok(Math.abs(club().cash-cash+f.nextCost)<.011);
const paid=club().cash;v=go('facility',{key:'medical',direction:-1});a.equal(v.facilities.find(x=>x.key==='medical').level,f.level);a.equal(club().cash,paid);
const park=v.facilities.find(x=>x.key==='park');v=go('facility',{key:'park',direction:1});a.equal(v.facilities.find(x=>x.key==='park').level,park.level+1);
a.throws(()=>engine.advance(w,{club:'prices',values:[1,2,3,4,5]}));
const prices=v.prices.slice();prices[0]+=100;v=go('prices',{values:prices});a.deepEqual(v.prices,prices);
v=go('travel',{value:2});a.equal(v.travel,2);
const support=v.support.find(x=>x.eligible);if(support){const old=club().cash;v=go('support',{key:support.key});a.ok(Math.abs(club().cash-old+support.cost)<.011);a.throws(()=>engine.advance(w,{club:'support',key:support.key}));}
const order=v.manager.orders[0];v=go('manager-order',{key:order.key,value:'attack'});a.equal(v.manager.orders.find(x=>x.key===order.key).value,'attack');
const noCash=JSON.parse(JSON.stringify(w));noCash.teams.find(t=>t.id===w.selectedId).cash=0;a.throws(()=>engine.advance(noCash,{club:'facility',key:'park',direction:1}));
const pending=JSON.parse(JSON.stringify(w));pending.pendingEvent={playerId:ownId,date:'2027-05-01',days:9};a.equal(engine.view(pending).club.canManage,false);a.throws(()=>engine.advance(pending,{club:'travel',value:1}));
const snapshot=JSON.stringify(w);engine.view(w);a.equal(JSON.stringify(w),snapshot);
a.ok(Buffer.byteLength(JSON.stringify(engine.view(w)))<262144);
console.log('PASS authoritative club roster, lineup/fielding, farm, facilities, price, support, manager policy, cash and event guards');

// v190 manager recommendation and position-aware roster commands use the
// actual UI engine helpers, not client-supplied assignments or RNG.
w=engine.newWorld({team:0});v=view();
a.throws(()=>engine.advance(w,{club:'lineup-recommend',confirmed:false}));
a.throws(()=>engine.advance(w,{club:'lineup-recommend',confirmed:true,lineup:[]}));
let initial=JSON.stringify(w),recommended;
try{recommended=engine.advance(w,{club:'lineup-recommend',confirmed:true});}
catch(e){a.match(String(e),/lineup unchanged/);w=engine.advance(w,{club:'lineup-move',slot:0,target:1});initial=JSON.stringify(w);recommended=engine.advance(w,{club:'lineup-recommend',confirmed:true});}
a.equal(JSON.stringify(w),initial);
a.deepEqual(engine.advance(w,{club:'lineup-recommend',confirmed:true}),recommended);
w=recommended;v=view();a.equal(v.lineup.length,9);a.equal(new Set(v.lineup).size,9);a.equal(new Set(Object.values(v.fieldingRoles)).size,9);a.deepEqual(v.lineupWarnings,{missing:0,off:[]});
a.throws(()=>engine.advance(w,{club:'lineup-recommend',confirmed:true}),/lineup unchanged/);
let ids=v.lineup.slice(),assignments=v.fieldingRoles;
v=go('lineup-move',{slot:0,target:3});a.deepEqual(v.lineup.slice(0,4),[ids[1],ids[2],ids[3],ids[0]]);a.deepEqual(v.fieldingRoles,assignments);
a.throws(()=>engine.advance(w,{club:'lineup-move',slot:0,target:0}));
a.throws(()=>engine.advance(w,{club:'lineup-replace',key:'C',playerId:other.id}));
const eligible=v.lineupCandidates.find(x=>!v.lineup.includes(x.id)&&x.roles.length);
a.ok(eligible);const role=eligible.roles[0],oldId=v.lineup.find(id=>v.fieldingRoles[id]===role),oldIndex=v.lineup.indexOf(oldId);
v=go('lineup-replace',{key:role,playerId:eligible.id});a.equal(v.lineup[oldIndex],eligible.id);a.equal(v.fieldingRoles[eligible.id],role);a.equal(Object.hasOwn(v.fieldingRoles,oldId),false);
a.throws(()=>engine.advance(w,{club:'lineup-replace',key:role,playerId:eligible.id}));
const injured=JSON.parse(JSON.stringify(w));injured.players.find(p=>p.id===eligible.id).injury={daysLeft:5};a.throws(()=>engine.advance(injured,{club:'lineup-replace',key:role,playerId:eligible.id}));
const blocked=JSON.parse(JSON.stringify(w));blocked.pendingDraftReveal={year:w.year,entries:[]};a.throws(()=>engine.advance(blocked,{club:'lineup-move',slot:0,target:1}));
console.log('PASS server v190 recommendation, move, eligibility, role replacement and reveal boundary');

a.equal(v.lineupUndoAvailable,true);
const replaced=JSON.stringify(w);a.throws(()=>engine.advance(w,{club:'lineup-undo',lineup:[]}));a.equal(JSON.stringify(w),replaced);
v=go('lineup-undo');a.equal(v.lineup[oldIndex],oldId);a.equal(v.fieldingRoles[oldId],role);a.equal(v.lineupUndoAvailable,false);
a.throws(()=>engine.advance(w,{club:'lineup-undo'}));
v=go('lineup-move',{slot:0,target:2});a.equal(v.lineupUndoAvailable,true);
const saved=JSON.parse(JSON.stringify(w));a.equal(engine.view(saved).club.lineupUndoAvailable,true);
const tampered=JSON.parse(JSON.stringify(w));const t=tampered.teams.find(t=>t.id===tampered.selectedId);[t.lineup[0],t.lineup[1]]=[t.lineup[1],t.lineup[0]];a.equal(engine.view(tampered).club.lineupUndoAvailable,false);a.throws(()=>engine.advance(tampered,{club:'lineup-undo'}));
const hurt=JSON.parse(JSON.stringify(w));hurt.players.find(p=>p.id===hurt.canonicalRosterUndo.before.lineup[0]).injury={daysLeft:5};a.equal(engine.view(hurt).club.lineupUndoAvailable,false);a.throws(()=>engine.advance(hurt,{club:'lineup-undo'}));
v=go('travel',{value:2});a.equal(v.lineupUndoAvailable,false);a.throws(()=>engine.advance(w,{club:'lineup-undo'}));
console.log('PASS trusted one-step lineup undo, restart, tamper, injury and unrelated-operation invalidation');

const freshHq=engine.newWorld({team:0}),hq=engine.view(freshHq).headquarters;a.equal(hq.canStep,true);a.equal(hq.last,null);a.ok(hq.fans>0&&hq.salary>0&&hq.rank>=1);const afterHq=engine.advance(freshHq,{step:1});a.equal(afterHq.calendarIndex,freshHq.calendarIndex+1);a.notEqual(engine.view(afterHq).headquarters.dateText,hq.dateText);a.equal(engine.view(afterHq).headquarters.fans,afterHq.fans);const heldHq=JSON.parse(JSON.stringify(freshHq));heldHq.pendingDraftReveal={year:heldHq.year,entries:[]};a.equal(engine.view(heldHq).headquarters.canStep,false);a.throws(()=>engine.advance(heldHq,{step:1}));console.log('PASS bounded headquarters projection and authoritative daily guard');

// Real engine: targets share the original calendar calculation. Routine notices can be deferred only when durably archived.
const calendarWorld=engine.newWorld({team:0}),calendarView=engine.view(calendarWorld).headquarters;a.equal(calendarView.canCalendar,true);a.equal(calendarView.goals.date,calendarWorld.calendarIndex+1);a.equal(calendarView.goals.season,calendarWorld.calendar.days.length);a.ok(calendarView.goals.weekly<=calendarView.goals.month);
const routine=JSON.parse(JSON.stringify(calendarWorld));routine.milestoneNews=[{id:'fixture-routine',year:routine.year,title:'fixture',date:routine.calendar.days[0].date}];routine.pendingMilestoneIds=['fixture-routine'];a.equal(engine.view(routine).headquarters.canCalendar,true);const acked=engine.advance(routine,{acknowledge:'milestones'});a.equal(acked.milestoneNews.length,1);a.equal(acked.pendingMilestoneIds.length,0);const continued=engine.advance(routine,{calendar:'day'});a.equal(continued.calendarIndex,routine.calendarIndex+1);a.ok(continued.milestoneNews.some(m=>m.id==='fixture-routine'));a.ok(!continued.pendingMilestoneIds.includes('fixture-routine'));
const missing=JSON.parse(JSON.stringify(routine));missing.pendingMilestoneIds=['not-archived'];a.equal(engine.view(missing).headquarters.canCalendar,false);a.throws(()=>engine.advance(missing,{calendar:'day'}));a.throws(()=>engine.advance(missing,{acknowledge:'milestones'}));
const important=JSON.parse(JSON.stringify(calendarWorld));important.pendingDraftReveal={year:important.year,entries:[]};a.equal(engine.view(important).headquarters.canCalendar,false);a.throws(()=>engine.advance(important,{calendar:'day'}));a.throws(()=>engine.advance(calendarWorld,{calendar:'day',days:100}));console.log('PASS calendar targets, archived routine deferral and important-event boundary');
