const a=require('node:assert/strict'),{createHeadlessEngine}=require('../server/headless-engine.cjs');
const engine=createHeadlessEngine();
let w=engine.newWorld({team:0});
const clone=v=>JSON.parse(JSON.stringify(v)),club=()=>w.teams.find(t=>t.id===w.selectedId);
const go=(foreign,extra={})=>{w=engine.advance(w,{foreign,...extra});return engine.view(w).foreign;};
let v=engine.view(w).foreign;
if(!v.initialized)v=go('init');
a.throws(()=>engine.advance(w,{foreign:'init'}));
a.throws(()=>engine.advance(w,{foreign:'begin',playerId:99999999}));
a.throws(()=>engine.advance(w,{foreign:'begin',playerId:v.candidates[0].id,seed:1}));
const hidden=w.foreignMarket.candidates.find(c=>c.scoutDiscovered===false);a.ok(hidden);a.ok(!v.candidates.some(c=>c.id===hidden.id));a.throws(()=>engine.advance(w,{foreign:'research',playerId:hidden.id,key:'field'}));
const c=v.candidates.find(c=>c.canBegin);a.ok(c);
const cash=club().cash;v=go('research',{playerId:c.id,key:'field'});a.ok(Math.abs(cash-club().cash-.05)<.001);a.throws(()=>engine.advance(w,{foreign:'research',playerId:c.id,key:'field'}));
v=go('begin',{playerId:c.id});a.equal(v.negotiation.status,'talk');a.equal(v.negotiation.candidate.id,c.id);a.throws(()=>engine.advance(w,{foreign:'submit'}));
const interpreterCash=club().cash;v=go('interpreter');a.ok(Math.abs(interpreterCash-club().cash-.02)<.001);a.throws(()=>engine.advance(w,{foreign:'interpreter'}));
for(let i=0;i<3;i++){a.ok(v.negotiation.question);a.throws(()=>engine.advance(w,{foreign:'reply',key:'INVALID'}));v=go('reply',{key:v.negotiation.question.options[0].key});}
a.equal(v.negotiation.answerCount,3);v=go('support',{key:'housing',enabled:true});a.equal(v.negotiation.support.housing,true);
v=go('offer',{level:1});a.equal(v.negotiation.offerLevel,1);
// Controlled fixture: ensure sufficient room and a deterministic signed outcome.
// All actions and money changes after this point use real game functions.
let conv=w.foreignMarket.negotiations[w.selectedId];conv.interest=86;conv.rivals=[];conv.overseas=false;club().cash=100;
v=go('offer',{level:0});const offer=v.negotiation.offers.find(o=>o.level===0);const before=club().cash;v=go('submit');
a.equal(v.negotiation.status,'waiting');a.equal(club().cash,before);a.throws(()=>engine.advance(w,{foreign:'submit'}));
conv=w.foreignMarket.negotiations[w.selectedId];
// If the original rules choose a non-immediate response, step to the actual due day.
if(conv.waitDays){a.throws(()=>engine.advance(w,{foreign:'open'}));for(let i=0;i<20;i++){let state=engine.view(w),x=state.foreign.negotiation;if(x.status!=='waiting')break;
 if(state.inbox.injury)w=engine.advance(w,{acknowledge:'injury',eventKey:state.inbox.injury.eventKey});
 else if(state.inbox.rare)w=engine.advance(w,{acknowledge:'rare',eventKey:state.inbox.rare.eventKey});
 else if(state.acknowledgements.month)w=engine.advance(w,{acknowledge:'month'});
 else if(state.acknowledgements.milestones)w=engine.advance(w,{acknowledge:'milestones'});
 else w=engine.advance(w,{step:1});
}}
v=engine.view(w).foreign;a.ok(['response','waiting'].includes(v.negotiation.status));a.equal(v.negotiation.result,null);
a.throws(()=>engine.advance(w,{foreign:'finish'}));a.throws(()=>engine.advance(w,{step:1}));
v=go('open');a.equal(v.negotiation.status,'signed');a.equal(v.negotiation.result.winner,w.selectedId);
a.equal(w.players.filter(p=>p.id===c.id).length,1);a.ok(w.players.find(p=>p.id===c.id).foreignContract);
a.throws(()=>engine.advance(w,{foreign:'finish'}));a.throws(()=>engine.advance(w,{foreign:'open'}));
v=go('reveal');a.equal(v.negotiation.stage,1);v=go('reveal');a.equal(v.negotiation.stage,2);a.ok(Object.values(v.negotiation.candidate.abilities).every(x=>Number.isFinite(x.value)));
a.throws(()=>engine.advance(w,{foreign:'reveal'}));v=go('finish');a.equal(v.negotiation,null);
a.equal(w.players.filter(p=>p.id===c.id).length,1);
a.ok(!v.candidates.some(x=>x.id===c.id));console.log('PASS actual foreign scouting, research and interpreter charges, dialogue, deferred response, one registration, reveal and duplicate guards');
